package marketplace

import (
	"context"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/google/uuid"

	transactionapp "github.com/vndc/backend/internal/application/transaction"
	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/blockchain"
	"github.com/vndc/backend/pkg/database"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

type transferSubmitter interface {
	SubmitTransfer(ctx context.Context, req *transactionapp.SubmitTransferRequest) (*domain.Transaction, error)
	CancelTransaction(ctx context.Context, id string, callerWallet string) (*domain.Transaction, error)
}

type Service struct {
	listingRepo         ports.MarketplaceListingRepository
	purchaseRepo        ports.MarketplacePurchaseRepository
	nftRepo             ports.NFTRepository
	userRepo            ports.UserRepository
	market              ports.MarketplaceContractPort
	erc721              ports.ERC721CollectionPort
	transferSvc         transferSubmitter
	defaultNFTContract  string
	defaultPaymentToken string
	relayerWallet       string
	log                 logger.Logger
}

// NewService constructs the marketplace application service with repository, contract, NFT, and transfer dependencies.
// The service can handle both fully off-chain products and NFT-backed on-chain listings through the same boundary.
func NewService(
	listingRepo ports.MarketplaceListingRepository,
	purchaseRepo ports.MarketplacePurchaseRepository,
	nftRepo ports.NFTRepository,
	userRepo ports.UserRepository,
	market ports.MarketplaceContractPort,
	erc721 ports.ERC721CollectionPort,
	transferSvc transferSubmitter,
	defaultNFTContract string,
	defaultPaymentToken string,
	relayerWallet string,
	log logger.Logger,
) *Service {
	return &Service{
		listingRepo:         listingRepo,
		purchaseRepo:        purchaseRepo,
		nftRepo:             nftRepo,
		userRepo:            userRepo,
		market:              market,
		erc721:              erc721,
		transferSvc:         transferSvc,
		defaultNFTContract:  normalizeWallet(defaultNFTContract),
		defaultPaymentToken: normalizeWallet(defaultPaymentToken),
		relayerWallet:       normalizeWallet(relayerWallet),
		log:                 log.Named("marketplace_service"),
	}
}

// CreateListing creates a new marketplace listing and, for NFT listings, mirrors it to the on-chain marketplace contract.
// Off-chain product listings stay fully in persistence while NFT listings additionally manage escrow-oriented on-chain state.
func (s *Service) CreateListing(ctx context.Context, req *CreateListingRequest, actorWallet string) (*domain.MarketplaceListing, error) {
	seller := normalizeWallet(actorWallet)
	if seller == "" {
		return nil, apperr.ErrForbidden
	}

	isNFTListing := strings.EqualFold(strings.TrimSpace(req.Category), "nft")
	nftContract := ""
	if isNFTListing {
		nftContract = firstNonEmpty(normalizeWallet(req.NFTContractAddress), s.defaultNFTContract)
	}
	paymentToken := firstNonEmpty(normalizeWallet(req.PaymentTokenAddress), s.defaultPaymentToken)
	if req.TokenID != "" {
		if _, err := parseNonNegativeInteger(req.TokenID, "token_id"); err != nil {
			return nil, err
		}
	}
	if _, err := parsePositiveAmount(req.Amount, "amount"); err != nil {
		return nil, err
	}
	if isNFTListing {
		if _, err := parseNonNegativeInteger(req.Price, "price"); err != nil {
			return nil, err
		}
	} else {
		if _, err := parsePositiveAmount(req.Price, "price"); err != nil {
			return nil, err
		}
	}
	if req.RoyaltyPercentage < 0 || req.RoyaltyPercentage > 50 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "royalty_percentage must be between 0 and 50")
	}

	marketAddr := ""
	if isNFTListing && s.market != nil {
		marketAddr = s.market.Address()
	}

	now := time.Now().UTC()
	listing := &domain.MarketplaceListing{
		BaseEntity:                 domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		SellerWallet:               seller,
		NFTContractAddress:         nftContract,
		PaymentTokenAddress:        paymentToken,
		MarketplaceContractAddress: marketAddr,
		TokenID:                    strings.TrimSpace(req.TokenID),
		Amount:                     strings.TrimSpace(req.Amount),
		Price:                      strings.TrimSpace(req.Price),
		RoyaltyPercentage:          req.RoyaltyPercentage,
		Status:                     domain.MarketplaceListingActive,
		Title:                      strings.TrimSpace(req.Title),
		Description:                strings.TrimSpace(req.Description),
		ImageURI:                   strings.TrimSpace(req.ImageURI),
		MetadataURI:                strings.TrimSpace(req.MetadataURI),
		Category:                   strings.TrimSpace(req.Category),
	}
	if isNFTListing {
		listing.OnchainListingID = toOnchainID(listing.ID)
	}

	if err := s.listingRepo.Create(ctx, listing); err != nil {
		return nil, err
	}

	// Non-NFT products are fully off-chain. Only NFT listings are mirrored on-chain.
	if isNFTListing && s.market != nil && nftContract != "" {
		if strings.TrimSpace(req.ApprovalSignature) != "" && s.erc721 != nil {
			sigBytes, err := blockchain.HexToBytes(req.ApprovalSignature)
			if err != nil {
				_ = s.listingRepo.Delete(ctx, listing.ID)
				return nil, apperr.New(apperr.ErrCodeInvalidSignature, "invalid nft approval signature")
			}
			if _, err := s.erc721.ApproveWithSignature(ctx, seller, s.market.Address(), listing.TokenID, req.ApprovalDeadline, sigBytes); err != nil {
				_ = s.listingRepo.Delete(ctx, listing.ID)
				return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "approve marketplace escrow with signature failed", err)
			}
		}
		txHash, err := s.market.CreateListing(ctx, listing.OnchainListingID, seller, nftContract, paymentToken, listing.TokenID, listing.Amount, listing.Price)
		if err != nil {
			_ = s.listingRepo.Delete(ctx, listing.ID)
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "create marketplace listing on-chain failed", err)
		}
		listing.EscrowTxHash = txHash
		if err := s.listingRepo.Update(ctx, listing); err != nil {
			return nil, err
		}
	}
	if isNFTListing {
		if err := s.retirePreviousNFTListings(ctx, nftContract, listing.TokenID, listing.ID); err != nil {
			return nil, err
		}
	}
	return listing, nil
}

// MintAndListNFT mints an NFT through the configured ERC-721 adapter and immediately lists it in the marketplace.
// This flow is useful for creators who want a one-step mint-plus-list operation instead of separate issuance and listing steps.
func (s *Service) MintAndListNFT(ctx context.Context, req *MintAndListNFTRequest, actorWallet string) (*domain.MarketplaceListing, error) {
	seller := normalizeWallet(actorWallet)
	if seller == "" {
		return nil, apperr.ErrForbidden
	}
	if s.erc721 == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "erc721 mint adapter is unavailable")
	}
	imageURI := strings.TrimSpace(req.ImageURI)
	if !isLikelyIPFSURI(imageURI) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "image_uri must be an ipfs:// link or IPFS gateway URL")
	}
	metadataURI := strings.TrimSpace(req.MetadataURI)
	if metadataURI == "" {
		metadataURI = imageURI
	}

	mintRecipient := firstNonEmpty(s.relayerWallet, seller)
	if mintRecipient == "" {
		return nil, apperr.New(apperr.ErrCodeInternal, "relayer wallet is not configured for nft escrow mint")
	}

	tokenID, mintTxHash, err := s.erc721.Mint(ctx, mintRecipient, metadataURI)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "mint nft on-chain failed", err)
	}
	if s.market != nil {
		if _, err := s.erc721.Approve(ctx, s.market.Address(), tokenID); err != nil {
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "approve marketplace escrow failed", err)
		}
	}

	createReq := &CreateListingRequest{
		Title:               strings.TrimSpace(req.Title),
		Description:         strings.TrimSpace(req.Description),
		ImageURI:            imageURI,
		MetadataURI:         metadataURI,
		NFTContractAddress:  firstNonEmpty(normalizeWallet(req.NFTContractAddress), s.defaultNFTContract),
		PaymentTokenAddress: strings.TrimSpace(req.PaymentTokenAddress),
		TokenID:             tokenID,
		Amount:              "1",
		Price:               "0",
		RoyaltyPercentage:   req.RoyaltyPercentage,
		Category:            "nft",
	}

	listing, err := s.CreateListing(ctx, createReq, seller)
	if err != nil {
		return nil, err
	}

	if s.nftRepo != nil {
		now := time.Now().UTC()
		nft := &domain.NFT{
			BaseEntity:  domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
			TokenID:     tokenID,
			Type:        domain.NFTTypeAchievement,
			Owner:       seller,
			Creator:     seller,
			Name:        strings.TrimSpace(req.Title),
			Description: strings.TrimSpace(req.Description),
			ImageURI:    imageURI,
			MetadataURI: metadataURI,
			Supply:      "1",
			TxHash:      mintTxHash,
			BlockNumber: 0,
			Attributes:  nil,
		}
		if err := s.nftRepo.Create(ctx, nft); err != nil {
			s.log.Warn("create nft metadata record failed", logger.String("token_id", tokenID), logger.Err(err))
		}
	}

	return listing, nil
}

// MintCollectionToken mints an ERC-721 collection token and optionally records matching off-chain NFT metadata.
// It is intended for administrative or curated collection mint flows rather than end-user listing flows.
func (s *Service) MintCollectionToken(ctx context.Context, req *AdminMintCollectionRequest) (string, string, error) {
	if s.erc721 == nil {
		return "", "", apperr.New(apperr.ErrCodeInternal, "erc721 mint adapter is unavailable")
	}
	to := normalizeWallet(req.To)
	if to == "" {
		return "", "", apperr.New(apperr.ErrCodeBadRequest, "to must be a valid wallet address")
	}
	tokenURI := strings.TrimSpace(req.TokenURI)
	if tokenURI == "" {
		return "", "", apperr.New(apperr.ErrCodeBadRequest, "token_uri is required")
	}

	tokenID, txHash, err := s.erc721.Mint(ctx, to, tokenURI)
	if err != nil {
		return "", "", apperr.Wrap(apperr.ErrCodeBlockchain, "mint nft collection token failed", err)
	}

	if s.nftRepo != nil {
		now := time.Now().UTC()
		nft := &domain.NFT{
			BaseEntity:  domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
			TokenID:     tokenID,
			Type:        domain.NFTTypeAchievement,
			Owner:       to,
			Creator:     firstNonEmpty(s.relayerWallet, to),
			Name:        "VNDC NFT #" + tokenID,
			ImageURI:    tokenURI,
			MetadataURI: tokenURI,
			Supply:      "1",
			TxHash:      txHash,
			BlockNumber: 0,
		}
		if err := s.nftRepo.Create(ctx, nft); err != nil {
			s.log.Warn("create nft record after admin mint failed", logger.String("token_id", tokenID), logger.Err(err))
		}
	}

	return tokenID, txHash, nil
}

// ApproveCollectionToken grants ERC-721 approval for one token to the requested spender address.
// This is primarily used when preparing collection tokens for escrow or marketplace transfer.
func (s *Service) ApproveCollectionToken(ctx context.Context, req *AdminApproveCollectionRequest) (string, error) {
	if s.erc721 == nil {
		return "", apperr.New(apperr.ErrCodeInternal, "erc721 approve adapter is unavailable")
	}
	spender := normalizeWallet(req.Spender)
	if spender == "" {
		return "", apperr.New(apperr.ErrCodeBadRequest, "spender must be a valid wallet address")
	}
	if _, err := parseNonNegativeInteger(req.TokenID, "token_id"); err != nil {
		return "", err
	}

	txHash, err := s.erc721.Approve(ctx, spender, strings.TrimSpace(req.TokenID))
	if err != nil {
		return "", apperr.Wrap(apperr.ErrCodeBlockchain, "approve nft collection token failed", err)
	}
	return txHash, nil
}

// ListOwnedNFTs returns paginated NFT metadata records owned by the acting wallet.
// It powers wallet inventory views and seller-side asset management screens.
func (s *Service) ListOwnedNFTs(ctx context.Context, actorWallet string, pageReq pagination.Request) ([]*domain.NFT, int64, error) {
	wallet := normalizeWallet(actorWallet)
	if wallet == "" {
		return nil, 0, apperr.ErrForbidden
	}
	if s.nftRepo == nil {
		return []*domain.NFT{}, 0, nil
	}
	opts := []database.QueryOption{
		database.WithSkip(pageReq.Offset()),
		database.WithLimit(pageReq.PageSize),
		database.WithSort(sortField(pageReq.SortBy, "created_at"), sortDirection(pageReq.SortDir)),
	}
	return s.nftRepo.FindByOwner(ctx, wallet, opts...)
}

// UpdateListingPrice updates the sale price of an active NFT listing and mirrors the change on-chain when applicable.
// Only active NFT listings may use this flow because off-chain physical products follow a different pricing lifecycle.
func (s *Service) UpdateListingPrice(ctx context.Context, id, actorWallet string, req *UpdateListingPriceRequest) (*domain.MarketplaceListing, error) {
	seller := normalizeWallet(actorWallet)
	if seller == "" {
		return nil, apperr.ErrForbidden
	}
	listing, err := s.listingRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(listing.SellerWallet, seller) {
		return nil, apperr.ErrForbidden
	}
	if !strings.EqualFold(strings.TrimSpace(listing.Category), "nft") {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "price update endpoint is only for nft listing")
	}
	if listing.Status != domain.MarketplaceListingActive {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "listing is not active")
	}
	if _, err := parsePositiveAmount(req.Price, "price"); err != nil {
		return nil, err
	}

	if s.market != nil && listing.OnchainListingID != "" {
		txHash, err := s.market.UpdateListingPrice(ctx, listing.OnchainListingID, strings.TrimSpace(req.Price))
		if err != nil {
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "update marketplace price on-chain failed", err)
		}
		listing.FinalizeTxHash = txHash
	}

	listing.Price = strings.TrimSpace(req.Price)
	if err := s.listingRepo.Update(ctx, listing); err != nil {
		return nil, err
	}
	return listing, nil
}

// CancelListing cancels an active listing after confirming there is no conflicting pending purchase.
// For escrowed NFT listings, it also attempts the corresponding on-chain cancellation before persisting the off-chain status change.
func (s *Service) CancelListing(ctx context.Context, id, actorWallet string) (*domain.MarketplaceListing, error) {
	listing, err := s.listingRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(listing.SellerWallet, normalizeWallet(actorWallet)) {
		return nil, apperr.ErrForbidden
	}
	if listing.Status != domain.MarketplaceListingActive {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "listing is not active")
	}
	if pending, err := s.hasPendingPurchase(ctx, listing.ID); err != nil {
		return nil, err
	} else if pending {
		return nil, apperr.New(apperr.ErrCodeConflict, "listing has a pending purchase")
	}

	// Optional onchain cancel — only when market adapter and escrow exist
	if s.market != nil && listing.OnchainListingID != "" && listing.EscrowTxHash != "" {
		txHash, err := s.market.CancelListing(ctx, listing.OnchainListingID)
		if err != nil {
			return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "cancel marketplace listing on-chain failed", err)
		}
		listing.CancelTxHash = txHash
	}

	listing.Status = domain.MarketplaceListingCancelled
	listing.BuyerWallet = ""
	if err := s.listingRepo.Update(ctx, listing); err != nil {
		return nil, err
	}
	return listing, nil
}

// BuyListing creates a purchase order for a listing and, for token-paid flows, submits the corresponding payment transaction.
// NFT purchases may also finalize immediately on-chain, whereas physical-good purchases continue through an order-status workflow.
func (s *Service) BuyListing(ctx context.Context, listingID, actorWallet string, req *BuyListingRequest) (*domain.MarketplacePurchase, error) {
	paymentMethod := strings.ToUpper(strings.TrimSpace(req.PaymentMethod))
	if paymentMethod == "" {
		paymentMethod = "TOKEN"
	}

	buyer := normalizeWallet(actorWallet)
	if buyer == "" {
		return nil, apperr.ErrForbidden
	}

	if paymentMethod == "TOKEN" {
		if s.transferSvc == nil {
			return nil, apperr.New(apperr.ErrCodeInternal, "transaction service is unavailable")
		}
		fromWallet := normalizeWallet(req.FromWallet)
		if fromWallet == "" || !strings.EqualFold(buyer, fromWallet) {
			return nil, apperr.ErrForbidden
		}
		if req.Nonce == "" || req.Deadline == 0 || req.Signature == "" {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "nonce, deadline, and signature are required for token payment")
		}
	}

	listing, err := s.listingRepo.FindByID(ctx, listingID)
	if err != nil {
		return nil, err
	}
	isNFTListing := strings.EqualFold(strings.TrimSpace(listing.Category), "nft")
	if isNFTListing && paymentMethod != "TOKEN" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "nft purchase only supports TOKEN payment")
	}

	recipientName := strings.TrimSpace(req.RecipientName)
	recipientPhone := strings.TrimSpace(req.RecipientPhone)
	shippingAddress := strings.TrimSpace(req.ShippingAddress)
	if !isNFTListing && (recipientName == "" || recipientPhone == "" || shippingAddress == "") {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "recipient_name, recipient_phone, and shipping_address are required")
	}
	if isNFTListing {
		recipientName = buyer
		recipientPhone = "-"
		shippingAddress = "NFT_TRANSFER"
	}
	if listing.Status != domain.MarketplaceListingActive {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "listing is not active")
	}
	if price, ok := new(big.Int).SetString(strings.TrimSpace(listing.Price), 10); !ok || price.Sign() <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "listing is not available for sale yet")
	}
	if strings.EqualFold(listing.SellerWallet, buyer) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "seller cannot buy own listing")
	}
	if pending, err := s.hasPendingPurchase(ctx, listing.ID); err != nil {
		return nil, err
	} else if pending {
		return nil, apperr.New(apperr.ErrCodeConflict, "listing already has a pending purchase")
	}

	// Physical goods follow order workflow. NFT can be completed immediately after finalize.
	purchaseStatus := domain.MarketplacePurchasePendingCOD
	if paymentMethod == "TOKEN" {
		purchaseStatus = domain.MarketplacePurchasePendingPayment
	}

	now := time.Now().UTC()
	purchase := &domain.MarketplacePurchase{
		BaseEntity:        domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		ListingID:         listing.ID,
		BuyerWallet:       buyer,
		SellerWallet:      listing.SellerWallet,
		PaymentToken:      listing.PaymentTokenAddress,
		Amount:            listing.Amount,
		Price:             listing.Price,
		Status:            purchaseStatus,
		PaymentMethod:     paymentMethod,
		OnchainPurchaseID: toOnchainID(uuid.NewString() + ":" + listing.ID + ":" + buyer),
		ListingTitle:      listing.Title,
		ListingImageURI:   listing.ImageURI,
		ListingCategory:   listing.Category,
		RecipientName:     recipientName,
		RecipientPhone:    recipientPhone,
		ShippingAddress:   shippingAddress,
		DeliveryNote:      strings.TrimSpace(req.DeliveryNote),
	}
	if !isNFTListing {
		est := now.Add(72 * time.Hour)
		purchase.ExpectedDelivery = &est
	}
	if err := s.purchaseRepo.Create(ctx, purchase); err != nil {
		return nil, err
	}

	listing.BuyerWallet = buyer
	if err := s.listingRepo.Update(ctx, listing); err != nil {
		purchase.Status = domain.MarketplacePurchaseFailed
		purchase.FailureReason = err.Error()
		_ = s.purchaseRepo.Update(ctx, purchase)
		return nil, err
	}

	// TOKEN payment: submit EIP-712 signed transfer directly to seller's wallet
	if paymentMethod == "TOKEN" {
		txRecord, err := s.transferSvc.SubmitTransfer(ctx, &transactionapp.SubmitTransferRequest{
			FromWallet:  buyer,
			ToWallet:    listing.SellerWallet,
			Amount:      listing.Price,
			Nonce:       req.Nonce,
			Deadline:    req.Deadline,
			Signature:   req.Signature,
			Type:        string(domain.TxTypeMarketplaceBuy),
			ContextType: "MARKETPLACE_PURCHASE",
			ContextID:   purchase.ID,
			ContextRef:  listing.ID,
		})
		if err != nil {
			listing.BuyerWallet = ""
			_ = s.listingRepo.Update(ctx, listing)
			purchase.Status = domain.MarketplacePurchaseFailed
			purchase.FailureReason = err.Error()
			_ = s.purchaseRepo.Update(ctx, purchase)
			return nil, err
		}
		purchase.PaymentTxID = txRecord.ID

		if isNFTListing {
			if s.market == nil || listing.OnchainListingID == "" || listing.EscrowTxHash == "" {
				listing.BuyerWallet = ""
				_ = s.listingRepo.Update(ctx, listing)
				purchase.Status = domain.MarketplacePurchaseFailed
				purchase.FailureReason = "marketplace on-chain listing is unavailable"
				_ = s.purchaseRepo.Update(ctx, purchase)
				return nil, apperr.New(apperr.ErrCodeBlockchain, "nft listing cannot be finalized")
			}

			finalizeTxHash, err := s.market.FinalizeSale(ctx, listing.OnchainListingID, purchase.OnchainPurchaseID, purchase.BuyerWallet, txRecord.TxHash)
			if err != nil {
				listing.BuyerWallet = ""
				_ = s.listingRepo.Update(ctx, listing)
				purchase.Status = domain.MarketplacePurchaseFailed
				purchase.FailureReason = err.Error()
				_ = s.purchaseRepo.Update(ctx, purchase)
				return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "finalize nft purchase on-chain failed", err)
			}

			now := time.Now().UTC()
			purchase.Status = domain.MarketplacePurchaseCompleted
			purchase.FinalizeTxHash = finalizeTxHash
			purchase.FailureReason = ""
			if txRecord.TxHash != "" {
				purchase.PaymentTxHash = txRecord.TxHash
			}
			if err := s.purchaseRepo.Update(ctx, purchase); err != nil {
				return nil, err
			}

			listing.Status = domain.MarketplaceListingSold
			listing.BuyerWallet = buyer
			listing.FinalizeTxHash = finalizeTxHash
			listing.SoldAt = &now
			if err := s.listingRepo.Update(ctx, listing); err != nil {
				return nil, err
			}

			if s.nftRepo != nil {
				if nft, nftErr := s.nftRepo.FindByTokenID(ctx, listing.TokenID); nftErr == nil && nft != nil {
					nft.Owner = buyer
					nft.UpdatedAt = time.Now().UTC()
					if err := s.nftRepo.Update(ctx, nft.ID, map[string]interface{}{"owner": buyer, "updated_at": nft.UpdatedAt}); err != nil {
						s.log.Warn("update nft owner failed", logger.String("token_id", listing.TokenID), logger.String("buyer", buyer), logger.Err(err))
					}
				} else if apperr.IsNotFound(nftErr) {
					nft := &domain.NFT{
						BaseEntity:  domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
						TokenID:     listing.TokenID,
						Type:        domain.NFTTypeAchievement,
						Owner:       buyer,
						Creator:     listing.SellerWallet,
						Name:        listing.Title,
						Description: listing.Description,
						ImageURI:    listing.ImageURI,
						MetadataURI: listing.MetadataURI,
						Supply:      listing.Amount,
						TxHash:      finalizeTxHash,
						BlockNumber: 0,
					}
					if err := s.nftRepo.Create(ctx, nft); err != nil {
						s.log.Warn("create nft owner record failed", logger.String("token_id", listing.TokenID), logger.String("buyer", buyer), logger.Err(err))
					}
				}
			}

			return purchase, nil
		}

		if err := s.purchaseRepo.Update(ctx, purchase); err != nil {
			return nil, err
		}
	}

	return purchase, nil
}

// CancelPurchase allows the buyer to cancel eligible non-token-paid orders before they progress too far.
// It also clears the temporary buyer binding on the underlying listing when cancellation succeeds.
func (s *Service) CancelPurchase(ctx context.Context, id, actorWallet string) (*domain.MarketplacePurchase, error) {
	wallet := normalizeWallet(actorWallet)
	if wallet == "" {
		return nil, apperr.ErrForbidden
	}
	purchase, err := s.purchaseRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(purchase.BuyerWallet, wallet) {
		return nil, apperr.ErrForbidden
	}
	if strings.EqualFold(strings.TrimSpace(purchase.PaymentMethod), "TOKEN") {
		return nil, apperr.New(apperr.ErrCodeForbidden, "buyer cannot cancel token-paid orders")
	}
	if purchase.Status != domain.MarketplacePurchasePendingCOD && purchase.Status != domain.MarketplacePurchasePendingPayment {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "order cannot be cancelled at current status")
	}

	purchase.Status = domain.MarketplacePurchaseCancelled
	purchase.UpdatedAt = time.Now().UTC()
	if err := s.purchaseRepo.Update(ctx, purchase); err != nil {
		return nil, err
	}

	if listing, err := s.listingRepo.FindByID(ctx, purchase.ListingID); err == nil && listing != nil {
		if strings.EqualFold(listing.BuyerWallet, purchase.BuyerWallet) {
			listing.BuyerWallet = ""
			_ = s.listingRepo.Update(ctx, listing)
		}
	}

	return purchase, nil
}

// CancelPurchaseBySeller lets the seller cancel an order and, for token-paid flows, trigger or attempt a refund path.
// This method handles both cancel-the-original-payment and explicit refund-transfer fallback flows.
func (s *Service) CancelPurchaseBySeller(ctx context.Context, id, actorWallet string, req *CancelOrderBySellerRequest) (*domain.MarketplacePurchase, error) {
	wallet := normalizeWallet(actorWallet)
	if wallet == "" {
		return nil, apperr.ErrForbidden
	}
	purchase, err := s.purchaseRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(purchase.SellerWallet, wallet) {
		return nil, apperr.ErrForbidden
	}

	if purchase.Status == domain.MarketplacePurchaseCompleted ||
		purchase.Status == domain.MarketplacePurchaseDelivered ||
		purchase.Status == domain.MarketplacePurchaseCancelled ||
		purchase.Status == domain.MarketplacePurchaseShipping {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "order cannot be cancelled at current status")
	}

	paymentMethod := strings.ToUpper(strings.TrimSpace(purchase.PaymentMethod))
	if paymentMethod == "TOKEN" {
		if s.transferSvc == nil {
			return nil, apperr.New(apperr.ErrCodeInternal, "transaction service is unavailable")
		}

		refundedByCancelOriginal := false
		if strings.TrimSpace(purchase.PaymentTxID) != "" {
			if _, cancelErr := s.transferSvc.CancelTransaction(ctx, strings.TrimSpace(purchase.PaymentTxID), purchase.BuyerWallet); cancelErr == nil {
				refundedByCancelOriginal = true
			}
		}

		if !refundedByCancelOriginal {
			fromWallet := normalizeWallet(req.FromWallet)
			if fromWallet == "" || !strings.EqualFold(fromWallet, purchase.SellerWallet) {
				return nil, apperr.New(apperr.ErrCodeBadRequest, "from_wallet must be seller wallet for token refund")
			}
			if req.Nonce == "" || req.Deadline == 0 || req.Signature == "" {
				return nil, apperr.New(apperr.ErrCodeBadRequest, "nonce, deadline, and signature are required for token refund")
			}
			if _, refundErr := s.transferSvc.SubmitTransfer(ctx, &transactionapp.SubmitTransferRequest{
				FromWallet:  purchase.SellerWallet,
				ToWallet:    purchase.BuyerWallet,
				Amount:      purchase.Price,
				Nonce:       req.Nonce,
				Deadline:    req.Deadline,
				Signature:   req.Signature,
				Type:        string(domain.TxTypeTokenTransfer),
				ContextType: "MARKETPLACE_REFUND",
				ContextID:   purchase.ID,
				ContextRef:  purchase.ListingID,
			}); refundErr != nil {
				return nil, refundErr
			}
		}
	}

	purchase.Status = domain.MarketplacePurchaseCancelled
	purchase.FailureReason = "cancelled by seller"
	purchase.UpdatedAt = time.Now().UTC()
	if err := s.purchaseRepo.Update(ctx, purchase); err != nil {
		return nil, err
	}

	if listing, err := s.listingRepo.FindByID(ctx, purchase.ListingID); err == nil && listing != nil {
		listing.BuyerWallet = ""
		if listing.Status == domain.MarketplaceListingSold {
			listing.Status = domain.MarketplaceListingActive
		}
		_ = s.listingRepo.Update(ctx, listing)
	}

	return purchase, nil
}

// ListListings returns paginated marketplace listings using the supplied visibility and seller filters.
// It supports public browsing, seller-owned listing views, and seller-specific storefront lookups.
func (s *Service) ListListings(ctx context.Context, actorWallet string, filter *ListListingsQuery, pageReq pagination.Request) ([]*domain.MarketplaceListing, int64, error) {
	opts := buildListingListOptions(filter, pageReq)
	if filter != nil && filter.Mine {
		wallet := normalizeWallet(actorWallet)
		if wallet == "" {
			return nil, 0, apperr.ErrForbidden
		}
		return s.listingRepo.FindBySeller(ctx, wallet, opts...)
	}
	if filter != nil && filter.SellerWallet != "" {
		wallet := normalizeWallet(filter.SellerWallet)
		if wallet == "" {
			return nil, 0, apperr.New(apperr.ErrCodeBadRequest, "invalid seller_wallet")
		}
		return s.listingRepo.FindBySeller(ctx, wallet, opts...)
	}
	return s.listingRepo.Find(ctx, opts...)
}

// GetListing returns one marketplace listing by ID.
// This is the basic detail lookup for listing pages and purchase orchestration.
func (s *Service) GetListing(ctx context.Context, id string) (*domain.MarketplaceListing, error) {
	return s.listingRepo.FindByID(ctx, id)
}

// ListPurchases returns paginated purchases made by the acting buyer.
// It powers buyer-side order history and order-detail drill-down screens.
func (s *Service) ListPurchases(ctx context.Context, actorWallet string, filter *ListPurchasesQuery, pageReq pagination.Request) ([]*domain.MarketplacePurchase, int64, error) {
	wallet := normalizeWallet(actorWallet)
	if wallet == "" {
		return nil, 0, apperr.ErrForbidden
	}
	opts := []database.QueryOption{
		database.WithSkip(pageReq.Offset()),
		database.WithLimit(pageReq.PageSize),
		database.WithSort(sortField(pageReq.SortBy, "created_at"), sortDirection(pageReq.SortDir)),
	}
	if filter != nil && filter.ListingID != "" {
		opts = append(opts, database.WithEq("listing_id", strings.TrimSpace(filter.ListingID)))
	}
	if filter != nil && filter.Status != "" {
		opts = append(opts, database.WithEq("status", strings.ToUpper(strings.TrimSpace(filter.Status))))
	}
	return s.purchaseRepo.FindByBuyer(ctx, wallet, opts...)
}

// ListSellerOrders returns paginated purchase orders where the acting wallet is the seller.
// This is the seller-facing operational order queue for fulfillment and support.
func (s *Service) ListSellerOrders(ctx context.Context, actorWallet string, filter *ListPurchasesQuery, pageReq pagination.Request) ([]*domain.MarketplacePurchase, int64, error) {
	wallet := normalizeWallet(actorWallet)
	if wallet == "" {
		return nil, 0, apperr.ErrForbidden
	}
	opts := []database.QueryOption{
		database.WithSkip(pageReq.Offset()),
		database.WithLimit(pageReq.PageSize),
		database.WithSort(sortField(pageReq.SortBy, "created_at"), sortDirection(pageReq.SortDir)),
	}
	if filter != nil && filter.ListingID != "" {
		opts = append(opts, database.WithEq("listing_id", strings.TrimSpace(filter.ListingID)))
	}
	if filter != nil && filter.Status != "" {
		opts = append(opts, database.WithEq("status", strings.ToUpper(strings.TrimSpace(filter.Status))))
	}
	return s.purchaseRepo.FindBySeller(ctx, wallet, opts...)
}

// GetPurchase returns one purchase order when the acting wallet is either the buyer or the seller.
// The method enforces participant-scoped visibility for order detail retrieval.
func (s *Service) GetPurchase(ctx context.Context, id, actorWallet string) (*domain.MarketplacePurchase, error) {
	wallet := normalizeWallet(actorWallet)
	if wallet == "" {
		return nil, apperr.ErrForbidden
	}
	purchase, err := s.purchaseRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(purchase.BuyerWallet, wallet) && !strings.EqualFold(purchase.SellerWallet, wallet) {
		return nil, apperr.ErrForbidden
	}
	return purchase, nil
}

// UpdatePurchaseStatus advances a seller-managed order through its allowed fulfillment state machine.
// The method enforces valid transition ordering so order states cannot skip or regress arbitrarily.
func (s *Service) UpdatePurchaseStatus(ctx context.Context, id, actorWallet string, req *UpdatePurchaseStatusRequest) (*domain.MarketplacePurchase, error) {
	wallet := normalizeWallet(actorWallet)
	if wallet == "" {
		return nil, apperr.ErrForbidden
	}
	purchase, err := s.purchaseRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(purchase.SellerWallet, wallet) {
		return nil, apperr.ErrForbidden
	}

	next := domain.MarketplacePurchaseStatus(strings.ToUpper(strings.TrimSpace(req.Status)))
	if next != domain.MarketplacePurchaseReceived && next != domain.MarketplacePurchasePacked && next != domain.MarketplacePurchaseShipping && next != domain.MarketplacePurchaseDelivered {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "status must be one of RECEIVED, PACKED, SHIPPING, DELIVERED")
	}

	var expectedNext domain.MarketplacePurchaseStatus
	switch purchase.Status {
	case domain.MarketplacePurchasePendingCOD, domain.MarketplacePurchasePendingPayment:
		expectedNext = domain.MarketplacePurchaseReceived
	case domain.MarketplacePurchaseReceived:
		expectedNext = domain.MarketplacePurchasePacked
	case domain.MarketplacePurchasePacked:
		expectedNext = domain.MarketplacePurchaseShipping
	case domain.MarketplacePurchaseShipping:
		expectedNext = domain.MarketplacePurchaseDelivered
	case domain.MarketplacePurchaseCancelled:
		return nil, apperr.New(apperr.ErrCodeBadRequest, "order was cancelled by buyer")
	default:
		return nil, apperr.New(apperr.ErrCodeBadRequest, "order is not in updatable status")
	}
	if next != expectedNext {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid status transition order")
	}

	now := time.Now().UTC()
	purchase.Status = next
	switch next {
	case domain.MarketplacePurchaseReceived:
		if req.ExpectedDeliveryHours > 0 {
			est := now.Add(time.Duration(req.ExpectedDeliveryHours) * time.Hour)
			purchase.ExpectedDelivery = &est
		}
	case domain.MarketplacePurchasePacked:
		purchase.PackedAt = &now
	case domain.MarketplacePurchaseShipping:
		purchase.ShippingAt = &now
	case domain.MarketplacePurchaseDelivered:
		purchase.DeliveredAt = &now
		purchase.Status = domain.MarketplacePurchaseCompleted
	}

	if err := s.purchaseRepo.Update(ctx, purchase); err != nil {
		return nil, err
	}
	return purchase, nil
}

// GetSellerProfile builds a derived seller profile from listing history, purchase history, and optional user profile data.
// It provides storefront-style summary metrics without requiring a dedicated denormalized seller table.
func (s *Service) GetSellerProfile(ctx context.Context, sellerWallet string) (*SellerProfileResponse, error) {
	wallet := normalizeWallet(sellerWallet)
	if wallet == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid seller wallet")
	}

	listings, _, err := s.listingRepo.FindBySeller(ctx, wallet, database.WithLimit(200))
	if err != nil {
		return nil, err
	}
	purchases, _, err := s.purchaseRepo.FindBySeller(ctx, wallet, database.WithLimit(500))
	if err != nil {
		return nil, err
	}

	activeListings := int64(0)
	for _, listing := range listings {
		if listing.Status == domain.MarketplaceListingActive {
			activeListings++
		}
	}

	totalRevenue := big.NewInt(0)
	delivered := int64(0)
	for _, purchase := range purchases {
		if purchase.Status == domain.MarketplacePurchaseCompleted || purchase.Status == domain.MarketplacePurchaseDelivered {
			delivered++
			if p, ok := new(big.Int).SetString(strings.TrimSpace(purchase.Price), 10); ok {
				totalRevenue.Add(totalRevenue, p)
			}
		}
	}

	profile := &SellerProfileResponse{
		Wallet:            wallet,
		DisplayName:       shortWallet(wallet),
		TotalListings:     int64(len(listings)),
		ActiveListings:    activeListings,
		DeliveredOrders:   delivered,
		TotalRevenueWei:   totalRevenue.String(),
		AverageRatingText: "4.8/5",
	}
	if s.userRepo != nil {
		if user, userErr := s.userRepo.FindByWallet(ctx, wallet); userErr == nil && user != nil {
			name := strings.TrimSpace(user.FullName)
			if name == "" {
				name = strings.TrimSpace(user.Username)
			}
			if name != "" {
				profile.DisplayName = name
			}
			profile.AvatarURI = strings.TrimSpace(user.AvatarURI)
			profile.Bio = strings.TrimSpace(user.Bio)
		}
	}

	return profile, nil
}

// hasPendingPurchase reports whether a listing already has an unresolved purchase that should block conflicting actions.
// It is used to guard listing cancellation and duplicate purchase initiation.
func (s *Service) hasPendingPurchase(ctx context.Context, listingID string) (bool, error) {
	purchases, _, err := s.purchaseRepo.FindByListing(ctx, listingID, database.WithLimit(100))
	if err != nil {
		return false, err
	}
	for _, purchase := range purchases {
		if purchase.Status == domain.MarketplacePurchasePendingPayment || purchase.Status == domain.MarketplacePurchasePendingCOD {
			return true, nil
		}
	}
	return false, nil
}

// retirePreviousNFTListings keeps one marketplace row authoritative for a token.
// Purchase history remains intact through MarketplacePurchase records, while stale listing rows stop surfacing as sellable entries.
func (s *Service) retirePreviousNFTListings(ctx context.Context, nftContract, tokenID, keepID string) error {
	tokenID = strings.TrimSpace(tokenID)
	if tokenID == "" {
		return nil
	}
	opts := []database.QueryOption{
		database.WithEq("category", "nft"),
		database.WithEq("token_id", tokenID),
		database.WithIn("status", []string{string(domain.MarketplaceListingActive), string(domain.MarketplaceListingSold)}),
		database.WithLimit(100),
	}
	if normalizedContract := normalizeWallet(nftContract); normalizedContract != "" {
		opts = append(opts, database.WithEq("nft_contract_address", normalizedContract))
	}
	listings, _, err := s.listingRepo.Find(ctx, opts...)
	if err != nil {
		return err
	}
	for _, previous := range listings {
		if previous == nil || previous.ID == keepID {
			continue
		}
		previous.Status = domain.MarketplaceListingCancelled
		previous.BuyerWallet = ""
		if previous.CancelTxHash == "" {
			previous.CancelTxHash = "relisted"
		}
		if err := s.listingRepo.Update(ctx, previous); err != nil {
			return err
		}
	}
	return nil
}

// buildListingListOptions translates listing filters and pagination settings into repository query options.
// Keeping this translation centralized prevents browse endpoints from drifting in filter behavior.
func buildListingListOptions(filter *ListListingsQuery, pageReq pagination.Request) []database.QueryOption {
	opts := []database.QueryOption{
		database.WithSkip(pageReq.Offset()),
		database.WithLimit(pageReq.PageSize),
		database.WithSort(sortField(pageReq.SortBy, "created_at"), sortDirection(pageReq.SortDir)),
	}
	if filter == nil {
		return opts
	}
	if filter.Status != "" {
		opts = append(opts, database.WithEq("status", strings.ToUpper(strings.TrimSpace(filter.Status))))
	}
	if filter.Search != "" {
		opts = append(opts, database.WithLike("title", strings.TrimSpace(filter.Search)))
	}
	return opts
}

// sortField validates an externally supplied sort key and falls back to a safe default when unsupported.
func sortField(field, fallback string) string {
	field = strings.TrimSpace(field)
	if field == "" {
		return fallback
	}
	switch field {
	case "created_at", "updated_at", "price", "token_id", "status":
		return field
	default:
		return fallback
	}
}

// sortDirection normalizes the requested sort direction and defaults to descending when unspecified or invalid.
func sortDirection(dir string) database.SortOrder {
	if strings.EqualFold(strings.TrimSpace(dir), string(database.SortAsc)) {
		return database.SortAsc
	}
	return database.SortDesc
}

// parsePositiveAmount parses a decimal-string amount and enforces that it is strictly positive.
// Marketplace price and quantity validations use this helper to keep numeric error handling consistent.
func parsePositiveAmount(raw, field string) (*big.Int, error) {
	amount, ok := new(big.Int).SetString(strings.TrimSpace(raw), 10)
	if !ok || amount.Sign() <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, field+" must be a positive integer string")
	}
	return amount, nil
}

// parseNonNegativeInteger parses a decimal-string integer and enforces that it is zero or positive.
// It is used for token IDs and other identifier-like numeric fields that may legitimately be zero.
func parseNonNegativeInteger(raw, field string) (*big.Int, error) {
	value, ok := new(big.Int).SetString(strings.TrimSpace(raw), 10)
	if !ok || value.Sign() < 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, field+" must be a non-negative integer string")
	}
	return value, nil
}

// normalizeWallet trims and canonicalizes a wallet address, returning an empty string when the address is invalid.
// The marketplace service uses this helper to keep address comparison and persistence consistent.
func normalizeWallet(wallet string) string {
	wallet = strings.TrimSpace(wallet)
	if wallet == "" || !common.IsHexAddress(wallet) {
		return ""
	}
	return common.HexToAddress(wallet).Hex()
}

// firstNonEmpty returns the first non-blank string from a list of candidates.
// It is used for fallback resolution of contracts, tokens, relayer wallets, and similar optional inputs.
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

// toOnchainID derives a deterministic hash-based identifier suitable for on-chain use.
// This avoids coupling on-chain IDs directly to raw database identifiers.
func toOnchainID(seed string) string {
	return crypto.Keccak256Hash([]byte(seed)).Hex()
}

// shortWallet formats a wallet into a short human-readable label for storefront and profile display.
func shortWallet(wallet string) string {
	w := normalizeWallet(wallet)
	if len(w) < 10 {
		return w
	}
	return w[:6] + "..." + w[len(w)-4:]
}

// isLikelyIPFSURI checks whether the provided URI appears to reference IPFS content directly or through a gateway.
// The marketplace uses this as a lightweight guard for NFT image inputs before minting.
func isLikelyIPFSURI(uri string) bool {
	u := strings.ToLower(strings.TrimSpace(uri))
	return strings.HasPrefix(u, "ipfs://") || strings.Contains(u, "/ipfs/")
}
