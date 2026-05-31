package dao

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/google/uuid"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/database"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
)

type Service struct {
	daoRepo                ports.DAOOrganizationRepository
	proposalRepo           ports.DAOProposalRepository
	voteRepo               ports.DAOVoteRepository
	nftRepo                ports.NFTRepository     // for NFT-boost vote-power calculation
	tokenPort              ports.TokenContractPort // for on-chain token balance lookup
	balanceCache           ports.BalanceCachePort  // preferred: cached balance
	contract               ports.DAOContractPort
	defaultGovernanceToken string // VNDC token address used as fallback
	log                    logger.Logger
}

// NewService constructs the DAO application service and attaches optional dependencies used for vote-power calculation.
// The extras slice allows the service to remain usable even when NFT, balance-cache, or token adapters are wired later.
func NewService(
	daoRepo ports.DAOOrganizationRepository,
	proposalRepo ports.DAOProposalRepository,
	voteRepo ports.DAOVoteRepository,
	contract ports.DAOContractPort,
	log logger.Logger,
	extras ...interface{},
) *Service {
	svc := &Service{
		daoRepo:      daoRepo,
		proposalRepo: proposalRepo,
		voteRepo:     voteRepo,
		contract:     contract,
		log:          log.Named("dao_service"),
	}
	for _, e := range extras {
		switch v := e.(type) {
		case ports.NFTRepository:
			svc.nftRepo = v
		case ports.TokenContractPort:
			svc.tokenPort = v
		case ports.BalanceCachePort:
			svc.balanceCache = v
		case string:
			if v != "" {
				svc.defaultGovernanceToken = strings.ToLower(v)
			}
		}
	}
	return svc
}

// CreateDAO creates the off-chain DAO record first and then mirrors it onto the current DAO smart contract.
// If the on-chain step fails, the off-chain record is rolled back so the two layers do not drift immediately at creation time.
func (s *Service) CreateDAO(ctx context.Context, req *CreateDAORequest, founderWallet string) (*domain.DAOOrganization, error) {
	if s.contract == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "dao contract adapter is unavailable")
	}
	founder := normalizeWallet(founderWallet)
	if founder == "" {
		return nil, apperr.ErrForbidden
	}
	governanceToken := normalizeWallet(req.GovernanceToken)
	if governanceToken == "" {
		if s.defaultGovernanceToken != "" {
			governanceToken = s.defaultGovernanceToken
		} else {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid governance token address")
		}
	}

	q := req.QuorumBps
	if q == 0 {
		q = 2000
	}
	if q > 10000 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "quorum_bps must be <= 10000")
	}
	votingDelay := req.VotingDelaySec
	votingPeriod := req.VotingPeriodSec
	if votingPeriod == 0 {
		votingPeriod = 3 * 24 * 3600
	}
	timelock := req.TimelockSec
	if timelock == 0 {
		timelock = 3600
	}

	now := time.Now().UTC()
	dao := &domain.DAOOrganization{
		BaseEntity:      domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		Name:            strings.TrimSpace(req.Name),
		Description:     strings.TrimSpace(req.Description),
		MetadataURI:     strings.TrimSpace(req.MetadataURI),
		GovernanceToken: governanceToken,
		FounderWallet:   founder,
		ContractAddress: s.contract.Address(),
		QuorumBps:       q,
		VotingDelaySec:  votingDelay,
		VotingPeriodSec: votingPeriod,
		TimelockSec:     timelock,
		Status:          domain.DAOStatusActive,
	}
	dao.OnchainDAOID = toOnchainID(dao.ID)

	if err := s.daoRepo.Create(ctx, dao); err != nil {
		return nil, err
	}
	txHash, err := s.contract.CreateDAO(
		ctx,
		dao.OnchainDAOID,
		dao.Name,
		dao.MetadataURI,
		dao.GovernanceToken,
		dao.QuorumBps,
		dao.VotingDelaySec,
		dao.VotingPeriodSec,
		dao.TimelockSec,
	)
	if err != nil {
		_ = s.daoRepo.Delete(ctx, dao.ID)
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "create dao on-chain failed", err)
	}
	dao.CreateTxHash = txHash
	if err := s.daoRepo.Update(ctx, dao); err != nil {
		return nil, err
	}
	return dao, nil
}

// SetDAOActive toggles DAO activity state both on-chain and in off-chain persistence.
// Only the founder may perform this operation because it changes whether the DAO can continue governance operations.
func (s *Service) SetDAOActive(ctx context.Context, daoID string, actorWallet string, active bool) (*domain.DAOOrganization, error) {
	dao, err := s.daoRepo.FindByID(ctx, daoID)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(dao.FounderWallet, normalizeWallet(actorWallet)) {
		return nil, apperr.ErrForbidden
	}
	if s.contract == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "dao contract adapter is unavailable")
	}
	txHash, err := s.contract.SetDAOActive(ctx, dao.OnchainDAOID, active)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "set dao status on-chain failed", err)
	}
	if active {
		dao.Status = domain.DAOStatusActive
	} else {
		dao.Status = domain.DAOStatusInactive
	}
	dao.UpdatedAt = time.Now().UTC()
	dao.CreateTxHash = txHash
	if err := s.daoRepo.Update(ctx, dao); err != nil {
		return nil, err
	}
	return dao, nil
}

// CreateProposal creates a governance proposal in off-chain storage and then mirrors it on-chain.
// The method validates proposal metadata, derives scheduling fields, and blocks proposals for outdated DAO contract deployments.
func (s *Service) CreateProposal(ctx context.Context, daoID string, actorWallet string, req *CreateProposalRequest) (*domain.DAOProposal, error) {
	if s.contract == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "dao contract adapter is unavailable")
	}
	dao, err := s.daoRepo.FindByID(ctx, daoID)
	if err != nil {
		return nil, err
	}
	if !s.isCurrentDAOContract(dao.ContractAddress) {
		return nil, apperr.New(
			apperr.ErrCodeBadRequest,
			"DAO was created on an old contract deployment. Please create a new DAO on the current network before creating proposals.",
		)
	}
	if dao.Status != domain.DAOStatusActive {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "dao is inactive")
	}
	proposer := normalizeWallet(actorWallet)
	if proposer == "" {
		return nil, apperr.ErrForbidden
	}
	// Target defaults to the DAO contract address for simple governance proposals
	target := normalizeWallet(req.Target)
	if target == "" {
		target = s.contract.Address()
	}
	value := strings.TrimSpace(req.Value)
	if value == "" {
		value = "0"
	}
	if _, ok := new(big.Int).SetString(value, 10); !ok {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "value must be uint string")
	}
	calldata := strings.TrimSpace(req.Calldata)
	if calldata == "" {
		calldata = "0x"
	}
	if !strings.HasPrefix(calldata, "0x") {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "calldata must start with 0x")
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "title is required")
	}
	desc := strings.TrimSpace(req.Description)
	descHash := crypto.Keccak256Hash([]byte(desc)).Hex()

	now := time.Now().UTC()
	start := now.Add(time.Duration(dao.VotingDelaySec) * time.Second)
	// Override voting period if client sent voting_period_hours
	votingPeriodSec := dao.VotingPeriodSec
	if req.VotingPeriodHours > 0 {
		votingPeriodSec = req.VotingPeriodHours * 3600
	}
	end := start.Add(time.Duration(votingPeriodSec) * time.Second)

	proposal := &domain.DAOProposal{
		BaseEntity:      domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		DAOID:           dao.ID,
		ProposerWallet:  proposer,
		Title:           title,
		Target:          target,
		Value:           value,
		Calldata:        calldata,
		Description:     desc,
		DescriptionHash: descHash,
		Status:          domain.DAOProposalPending,
		ForVotes:        "0",
		AgainstVotes:    "0",
		AbstainVotes:    "0",
		StartTime:       &start,
		EndTime:         &end,
	}
	proposal.Status = deriveProposalStatus(proposal)
	proposal.OnchainProposalID = toOnchainID(proposal.ID)

	if err := s.proposalRepo.Create(ctx, proposal); err != nil {
		return nil, err
	}
	txHash, err := s.contract.CreateProposal(
		ctx,
		proposal.OnchainProposalID,
		dao.OnchainDAOID,
		proposal.ProposerWallet,
		proposal.Target,
		proposal.Value,
		proposal.Calldata,
		proposal.DescriptionHash,
	)
	if err != nil {
		proposal.Status = domain.DAOProposalCancelled
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "create proposal on-chain failed", err)
	}
	proposal.CreateTxHash = txHash
	if err := s.proposalRepo.Update(ctx, proposal); err != nil {
		return nil, err
	}
	return proposal, nil
}

// CastVote records a governance vote after validating proposal status, uniqueness, and voting power.
// Vote weight is computed server-side so on-chain and off-chain vote records share the same derived power basis.
func (s *Service) CastVote(ctx context.Context, proposalID string, actorWallet string, req *CastVoteRequest) (*domain.DAOVote, error) {
	if s.contract == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "dao contract adapter is unavailable")
	}
	proposal, err := s.proposalRepo.FindByID(ctx, proposalID)
	if err != nil {
		return nil, err
	}
	proposal = s.refreshProposalStatus(ctx, proposal)
	if proposal.Status == domain.DAOProposalPending {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "voting has not started yet")
	}
	if proposal.Status == domain.DAOProposalExpired || proposal.Status == domain.DAOProposalCancelled || proposal.Status == domain.DAOProposalExecuted {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "voting has ended")
	}
	if proposal.Status != domain.DAOProposalActive {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "proposal is not in votable status")
	}
	voter := normalizeWallet(actorWallet)
	if voter == "" {
		return nil, apperr.ErrForbidden
	}
	if req.Support == nil {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "support is required")
	}
	support := *req.Support
	if support > 2 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "support must be 0,1,2")
	}

	// Check if already voted
	if _, err := s.voteRepo.FindByProposalAndVoter(ctx, proposal.ID, voter); err == nil {
		return nil, apperr.New(apperr.ErrCodeConflict, "already voted")
	}

	// Calculate vote power server-side: token_balance × (1 + NFT_boost)
	weight, err := s.calculateVotePower(ctx, voter)
	if err != nil {
		return nil, err
	}
	if weight.Sign() <= 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "no voting power: you need tokens to vote")
	}

	txHash, err := s.contract.CastVote(ctx, proposal.OnchainProposalID, voter, support, weight.String())
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "cast vote on-chain failed", err)
	}

	now := time.Now().UTC()
	vote := &domain.DAOVote{
		BaseEntity:    domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		ProposalID:    proposal.ID,
		VoterWallet:   voter,
		Support:       support,
		Weight:        weight.String(),
		OnchainTxHash: txHash,
	}
	if err := s.voteRepo.Create(ctx, vote); err != nil {
		return nil, err
	}

	switch support {
	case 0:
		proposal.AgainstVotes = addBigIntString(proposal.AgainstVotes, weight)
	case 1:
		proposal.ForVotes = addBigIntString(proposal.ForVotes, weight)
	default:
		proposal.AbstainVotes = addBigIntString(proposal.AbstainVotes, weight)
	}
	proposal.Status = deriveProposalStatus(proposal)
	proposal.UpdatedAt = now
	if err := s.proposalRepo.Update(ctx, proposal); err != nil {
		return nil, err
	}

	return vote, nil
}

// calculateVotePower derives effective governance voting weight from token balance plus the strongest NFT-based boost.
// The formula is token_balance × (1 + max_nft_boost_bps / 10000), with integer math to avoid precision drift.
func (s *Service) calculateVotePower(ctx context.Context, wallet string) (*big.Int, error) {
	// 1. Get token balance
	balanceWei := big.NewInt(0)
	if s.balanceCache != nil {
		if snap, err := s.balanceCache.Get(ctx, wallet); err == nil && snap != nil {
			// Use available balance (onChain + pending)
			avail, ok := new(big.Int).SetString(snap.Available, 10)
			if ok {
				balanceWei = avail
			}
		}
	}
	// Fall back to on-chain query if cache miss
	if balanceWei.Sign() == 0 && s.tokenPort != nil {
		onChainStr, err := s.tokenPort.BalanceOf(ctx, wallet)
		if err == nil {
			if b, ok := new(big.Int).SetString(onChainStr, 10); ok {
				balanceWei = b
			}
		}
	}

	// 2. Determine highest NFT tier for boost
	boostBps := int64(0)
	if s.nftRepo != nil {
		nfts, _, err := s.nftRepo.FindByOwner(ctx, wallet, database.WithLimit(100))
		if err == nil {
			for _, nft := range nfts {
				tierBps := nft.Tier.VotePowerBoostBps()
				if tierBps > boostBps {
					boostBps = tierBps
				}
			}
		}
	}

	// 3. votePower = balance × (10000 + boostBps) / 10000
	// Use integer arithmetic to avoid floating-point imprecision.
	denom := big.NewInt(10000)
	numerator := new(big.Int).Add(denom, big.NewInt(boostBps))
	votePower := new(big.Int).Mul(balanceWei, numerator)
	votePower.Div(votePower, denom)
	return votePower, nil
}

// QueueProposal places a successful proposal into the contract timelock queue and records the resulting ETA off-chain.
// Founder authorization is enforced through the shared proposal-and-founder guard helper.
func (s *Service) QueueProposal(ctx context.Context, proposalID, actorWallet string, totalVotingPower string) (*domain.DAOProposal, error) {
	proposal, dao, err := s.requireProposalAndFounder(ctx, proposalID, actorWallet)
	if err != nil {
		return nil, err
	}
	if s.contract == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "dao contract adapter is unavailable")
	}
	txHash, err := s.contract.QueueProposal(ctx, proposal.OnchainProposalID, totalVotingPower)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "queue proposal on-chain failed", err)
	}
	now := time.Now().UTC()
	eta := now.Add(time.Duration(dao.TimelockSec) * time.Second)
	proposal.Status = domain.DAOProposalQueued
	proposal.QueueTxHash = txHash
	proposal.Eta = &eta
	proposal.UpdatedAt = now
	if err := s.proposalRepo.Update(ctx, proposal); err != nil {
		return nil, err
	}
	return proposal, nil
}

// ExecuteProposal executes a queued proposal on-chain and marks it executed in off-chain storage.
// This is the final governance state transition after voting and timelock completion have already succeeded.
func (s *Service) ExecuteProposal(ctx context.Context, proposalID, actorWallet string) (*domain.DAOProposal, error) {
	proposal, _, err := s.requireProposalAndFounder(ctx, proposalID, actorWallet)
	if err != nil {
		return nil, err
	}
	if s.contract == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "dao contract adapter is unavailable")
	}
	txHash, err := s.contract.ExecuteProposal(ctx, proposal.OnchainProposalID)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "execute proposal on-chain failed", err)
	}
	proposal.Status = domain.DAOProposalExecuted
	proposal.ExecuteTxHash = txHash
	proposal.UpdatedAt = time.Now().UTC()
	if err := s.proposalRepo.Update(ctx, proposal); err != nil {
		return nil, err
	}
	return proposal, nil
}

// CancelProposal cancels a proposal on-chain and reflects the cancellation in the off-chain proposal record.
// The reason is forwarded so governance history remains traceable for operators and DAO members.
func (s *Service) CancelProposal(ctx context.Context, proposalID, actorWallet, reason string) (*domain.DAOProposal, error) {
	proposal, _, err := s.requireProposalAndFounder(ctx, proposalID, actorWallet)
	if err != nil {
		return nil, err
	}
	if s.contract == nil {
		return nil, apperr.New(apperr.ErrCodeInternal, "dao contract adapter is unavailable")
	}
	txHash, err := s.contract.CancelProposal(ctx, proposal.OnchainProposalID, strings.TrimSpace(reason))
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeBlockchain, "cancel proposal on-chain failed", err)
	}
	proposal.Status = domain.DAOProposalCancelled
	proposal.CancelTxHash = txHash
	proposal.UpdatedAt = time.Now().UTC()
	if err := s.proposalRepo.Update(ctx, proposal); err != nil {
		return nil, err
	}
	return proposal, nil
}

// ListDAOs returns paginated DAO records and filters out entries tied to outdated contract deployments when a contract adapter is present.
// This keeps end-user listings aligned with the currently active governance contract.
func (s *Service) ListDAOs(ctx context.Context, pageReq pagination.Request) ([]*domain.DAOOrganization, int64, error) {
	items, _, err := s.daoRepo.Find(ctx, database.WithSkip(pageReq.Offset()), database.WithLimit(pageReq.PageSize))
	if err != nil {
		return nil, 0, err
	}

	if s.contract == nil {
		return items, int64(len(items)), nil
	}

	filtered := make([]*domain.DAOOrganization, 0, len(items))
	for _, dao := range items {
		if s.isCurrentDAOContract(dao.ContractAddress) {
			filtered = append(filtered, dao)
		}
	}

	return filtered, int64(len(filtered)), nil
}

// GetDAO returns a single DAO organization by ID.
// It is the basic read path for DAO detail pages and proposal creation flows.
func (s *Service) GetDAO(ctx context.Context, id string) (*domain.DAOOrganization, error) {
	return s.daoRepo.FindByID(ctx, id)
}

// ListProposals returns paginated proposals for a DAO and refreshes each proposal's derived status before returning it.
// This keeps read models reasonably current even if no background synchronizer has persisted the latest derived state yet.
func (s *Service) ListProposals(ctx context.Context, daoID string, pageReq pagination.Request) ([]*domain.DAOProposal, int64, error) {
	if _, err := s.daoRepo.FindByID(ctx, daoID); err != nil {
		return nil, 0, err
	}
	items, total, err := s.proposalRepo.FindByDAO(ctx, daoID, database.WithSkip(pageReq.Offset()), database.WithLimit(pageReq.PageSize))
	if err != nil {
		return nil, 0, err
	}
	for i := range items {
		items[i] = s.refreshProposalStatus(ctx, items[i])
	}
	return items, total, nil
}

// GetProposal returns one proposal and refreshes its derived status before responding.
// This avoids serving stale pending/active/expired state when proposal timing has elapsed.
func (s *Service) GetProposal(ctx context.Context, proposalID string) (*domain.DAOProposal, error) {
	proposal, err := s.proposalRepo.FindByID(ctx, proposalID)
	if err != nil {
		return nil, err
	}
	return s.refreshProposalStatus(ctx, proposal), nil
}

// ListVotes returns paginated votes for a proposal.
// It is the main read path for vote ledgers, tally reviews, and governance transparency views.
func (s *Service) ListVotes(ctx context.Context, proposalID string, pageReq pagination.Request) ([]*domain.DAOVote, int64, error) {
	if _, err := s.proposalRepo.FindByID(ctx, proposalID); err != nil {
		return nil, 0, err
	}
	return s.voteRepo.FindByProposal(ctx, proposalID, database.WithSkip(pageReq.Offset()), database.WithLimit(pageReq.PageSize))
}

// requireProposalAndFounder loads a proposal and its DAO, then verifies the actor is the DAO founder.
// It centralizes the authorization guard used by founder-only governance operations.
func (s *Service) requireProposalAndFounder(ctx context.Context, proposalID, actorWallet string) (*domain.DAOProposal, *domain.DAOOrganization, error) {
	proposal, err := s.proposalRepo.FindByID(ctx, proposalID)
	if err != nil {
		return nil, nil, err
	}
	dao, err := s.daoRepo.FindByID(ctx, proposal.DAOID)
	if err != nil {
		return nil, nil, err
	}
	if !strings.EqualFold(dao.FounderWallet, normalizeWallet(actorWallet)) {
		return nil, nil, apperr.ErrForbidden
	}
	return proposal, dao, nil
}

// normalizeWallet trims and canonicalizes an Ethereum wallet address, returning an empty string when invalid.
// DAO workflows use this helper to avoid inconsistent casing and malformed-address handling.
func normalizeWallet(wallet string) string {
	wallet = strings.TrimSpace(wallet)
	if wallet == "" || !common.IsHexAddress(wallet) {
		return ""
	}
	return common.HexToAddress(wallet).Hex()
}

// isCurrentDAOContract reports whether a stored DAO record points at the currently configured DAO contract deployment.
// This prevents new governance actions from targeting stale contract addresses after redeployments.
func (s *Service) isCurrentDAOContract(contractAddress string) bool {
	if s.contract == nil {
		return true
	}
	current := normalizeWallet(s.contract.Address())
	if current == "" {
		return true
	}
	recordAddr := normalizeWallet(contractAddress)
	return recordAddr != "" && strings.EqualFold(recordAddr, current)
}

// refreshProposalStatus recomputes a proposal's derived lifecycle state from its timestamps and persists the change when needed.
// This keeps proposal reads self-healing when no dedicated background status-sync job has run yet.
func (s *Service) refreshProposalStatus(ctx context.Context, proposal *domain.DAOProposal) *domain.DAOProposal {
	if proposal == nil {
		return proposal
	}
	next := deriveProposalStatus(proposal)
	if proposal.Status == next {
		return proposal
	}
	proposal.Status = next
	proposal.UpdatedAt = time.Now().UTC()
	if err := s.proposalRepo.Update(ctx, proposal); err != nil {
		s.log.Warn(fmt.Sprintf("failed to persist derived proposal status: proposal_id=%s status=%s error=%v", proposal.ID, next, err))
	}
	return proposal
}

// toOnchainID deterministically derives the on-chain identifier from a stable seed string.
// Hash-based IDs avoid leaking internal database IDs directly into contract calls.
func toOnchainID(seed string) string {
	h := crypto.Keccak256Hash([]byte(seed))
	return h.Hex()
}

// addBigIntString adds a big integer increment to a decimal-string accumulator and returns the normalized decimal string.
// This helper keeps vote total arithmetic consistent when the stored value is persisted as text.
func addBigIntString(base string, inc *big.Int) string {
	b, ok := new(big.Int).SetString(base, 10)
	if !ok || b == nil {
		b = big.NewInt(0)
	}
	b = b.Add(b, inc)
	return b.String()
}

// deriveProposalStatus computes the proposal lifecycle state from current time and immutable terminal states.
// It is used to keep status derivation consistent across reads and governance write operations.
func deriveProposalStatus(proposal *domain.DAOProposal) domain.DAOProposalStatus {
	now := time.Now().UTC()
	if proposal.Status == domain.DAOProposalCancelled || proposal.Status == domain.DAOProposalExecuted || proposal.Status == domain.DAOProposalQueued {
		return proposal.Status
	}
	if proposal.StartTime != nil && now.Before(*proposal.StartTime) {
		return domain.DAOProposalPending
	}
	if proposal.EndTime != nil && now.Before(*proposal.EndTime) {
		return domain.DAOProposalActive
	}
	// Voting period ended - proposal is EXPIRED, awaiting queue or cancel
	if proposal.EndTime != nil {
		return domain.DAOProposalExpired
	}
	// Fallback to ACTIVE if no EndTime set
	return domain.DAOProposalActive
}
