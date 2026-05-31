// Package event implements the event ticketing module (UC20/UC21/UC22).
// Events have a fixed capacity; tickets are pre-generated at event creation.
// Each purchased ticket receives an AES-256-GCM encrypted QR payload.
// Staff check-in by decrypting and validating the QR payload.
package event

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"

	transactionapp "github.com/vndc/backend/internal/application/transaction"
	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	"github.com/vndc/backend/pkg/database"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/pagination"
	"github.com/vndc/backend/pkg/timeutil"
)

const (
	// checkinWindowBefore is how early before eventDate a QR can be scanned.
	checkinWindowBefore = 2 * time.Hour
	// checkinWindowAfter is how long after eventDate a QR can still be scanned.
	checkinWindowAfter = 4 * time.Hour
	// ticketMaxAge is the maximum age of a purchased ticket for check-in.
	ticketMaxAge = 365 * 24 * time.Hour // 12 months
	// minFutureHours is the minimum advance notice when creating an event.
	minFutureHours = 48 * time.Hour
)

type transferSubmitter interface {
	SubmitTransfer(ctx context.Context, req *transactionapp.SubmitTransferRequest) (*domain.Transaction, error)
}

// Service implements event creation, ticket purchase, encrypted QR issuance, and check-in validation logic.
// It coordinates repositories, optional balance reservation, and transfer submission for paid bookings.
type Service struct {
	eventRepo        ports.EventRepository
	ticketRepo       ports.EventTicketRepository
	balanceCache     ports.BalanceCachePort
	transferSvc      transferSubmitter
	aesKey           []byte // 32-byte AES-256 key derived from config
	defaultTokenAddr string
	log              logger.Logger
}

// NewService constructs the event service and derives the AES key used for QR payload encryption.
// The encryption secret is normalized once here so ticket issuance and scanning share a stable key.
func NewService(
	eventRepo ports.EventRepository,
	ticketRepo ports.EventTicketRepository,
	balanceCache ports.BalanceCachePort,
	transferSvc transferSubmitter,
	encryptionSecret string,
	defaultTokenAddr string,
	log logger.Logger,
) *Service {
	key := deriveAESKey(encryptionSecret)
	return &Service{
		eventRepo:        eventRepo,
		ticketRepo:       ticketRepo,
		balanceCache:     balanceCache,
		transferSvc:      transferSvc,
		aesKey:           key,
		defaultTokenAddr: normalizeWallet(defaultTokenAddr),
		log:              log.Named("event_service"),
	}
}

// ─────────────────────────────────────────────
//  UC20: Create Event
// ─────────────────────────────────────────────

// CreateEvent creates a new event and pre-generates the full ticket pool.
// Pre-generation keeps ticket issuance deterministic and avoids per-purchase ticket document creation races.
func (s *Service) CreateEvent(ctx context.Context, req *CreateEventRequest, creatorWallet string) (*domain.Event, error) {
	creator := normalizeWallet(creatorWallet)
	if creator == "" {
		return nil, apperr.ErrForbidden
	}

	// Validate name
	name := strings.TrimSpace(req.Name)
	if len(name) < 5 || len(name) > 200 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "name must be 5-200 characters")
	}

	// Validate eventDate: must be at least 48 h in the future
	if time.Until(req.EventDate) < minFutureHours {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "event_date must be at least 48 hours in the future")
	}

	// Validate capacity
	if req.Capacity < 1 || req.Capacity > 10000 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "capacity must be between 1 and 10000")
	}

	// Validate ticket price
	price, ok := new(big.Int).SetString(strings.TrimSpace(req.TicketPrice), 10)
	if !ok || price.Sign() < 0 {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ticket_price must be a non-negative decimal string in wei")
	}

	now := time.Now().UTC()
	event := &domain.Event{
		BaseEntity:     domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		CreatorWallet:  creator,
		Name:           name,
		Description:    strings.TrimSpace(req.Description),
		EventDate:      req.EventDate.UTC(),
		Capacity:       req.Capacity,
		TicketPrice:    price.String(),
		TotalSold:      0,
		TotalCheckedIn: 0,
		Status:         domain.EventStatusBookingOpen,
	}

	if err := s.eventRepo.Create(ctx, event); err != nil {
		return nil, err
	}

	// Pre-generate ticket pool
	tickets := make([]*domain.EventTicket, req.Capacity)
	for i := int64(0); i < req.Capacity; i++ {
		tickets[i] = &domain.EventTicket{
			BaseEntity: domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
			EventID:    event.ID,
			Status:     domain.TicketStatusAvailable,
		}
	}
	if err := s.ticketRepo.BulkCreate(ctx, tickets); err != nil {
		return nil, err
	}

	s.log.Info("event created with ticket pool",
		logger.String("event_id", event.ID),
		logger.Int64("capacity", req.Capacity),
	)
	return event, nil
}

// ─────────────────────────────────────────────
//  UC21: Buy Ticket
// ─────────────────────────────────────────────

// BuyTicket purchases one available ticket for the given event.
// For paid events it reserves balance, submits payment, assigns a concrete ticket, and generates the encrypted QR payload.
func (s *Service) BuyTicket(ctx context.Context, eventID string, buyerWallet string, req *BuyTicketRequest) (*BuyTicketResponse, error) {
	buyer := normalizeWallet(buyerWallet)
	if buyer == "" {
		return nil, apperr.ErrForbidden
	}

	// Load event
	event, err := s.eventRepo.FindByID(ctx, eventID)
	if err != nil {
		return nil, err
	}
	if event.Status != domain.EventStatusBookingOpen {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "event is not accepting bookings")
	}

	// Find an available ticket (atomic claim handled by db)
	ticket, err := s.ticketRepo.FindAvailable(ctx, eventID)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeConflict, "tickets are sold out")
	}

	// Check buyer balance when ticket is not free
	price, _ := new(big.Int).SetString(event.TicketPrice, 10)
	if price.Sign() > 0 {
		if s.balanceCache != nil {
			ok, err := s.balanceCache.CheckAndReserve(ctx, buyer, price.String())
			if err != nil || !ok {
				return nil, apperr.New(apperr.ErrCodeInsufficientBalance, "insufficient balance to purchase ticket")
			}
		}
		// Submit payment to event creator
		_, txErr := s.transferSvc.SubmitTransfer(ctx, &transactionapp.SubmitTransferRequest{
			FromWallet:  buyer,
			ToWallet:    event.CreatorWallet,
			Amount:      price.String(),
			Nonce:       req.Nonce,
			Deadline:    req.Deadline,
			Signature:   req.Signature,
			Type:        string(domain.TxTypeServiceTicketBuy),
			ContextType: "event",
			ContextID:   event.ID,
			ContextRef:  ticket.ID,
		})
		if txErr != nil {
			if s.balanceCache != nil {
				_ = s.balanceCache.Rollback(ctx, buyer, price.String())
			}
			return nil, txErr
		}
	}

	// Mark ticket as SOLD
	now := time.Now().UTC()
	ticket.Status = domain.TicketStatusSold
	ticket.OwnerWallet = buyer
	ticket.PurchasedAt = &now

	// Generate AES-256-GCM encrypted QR payload
	payload := qrPayload{
		TicketID:    ticket.ID,
		EventID:     event.ID,
		OwnerWallet: buyer,
		PurchasedAt: now.Unix(),
		EventDate:   event.EventDate.Unix(),
	}
	qrData, err := s.encryptQR(payload)
	if err != nil {
		return nil, apperr.Wrap(apperr.ErrCodeInternal, "QR generation failed", err)
	}
	ticket.QRData = qrData

	if err := s.ticketRepo.Update(ctx, ticket); err != nil {
		return nil, err
	}

	// Increment event total_sold
	event.TotalSold++
	if err := s.eventRepo.Update(ctx, event); err != nil {
		return nil, err
	}

	return &BuyTicketResponse{
		TicketID:  ticket.ID,
		EventName: event.Name,
		EventDate: timeutil.FormatRFC3339UTC7(event.EventDate),
		Price:     event.TicketPrice,
		QRData:    qrData,
		Message:   "Ticket purchased successfully. Present the QR code at the event.",
	}, nil
}

// ─────────────────────────────────────────────
//  UC22: Check-In
// ─────────────────────────────────────────────

// CheckIn validates and processes a ticket check-in via encrypted QR data.
// It verifies QR integrity, event identity, ownership, ticket status, and time-window rules before marking attendance.
func (s *Service) CheckIn(ctx context.Context, eventID string, staffWallet string, req *CheckInRequest) (*CheckInResponse, error) {
	staff := normalizeWallet(staffWallet)
	if staff == "" {
		return nil, apperr.ErrForbidden
	}

	// Decrypt QR payload
	payload, err := s.decryptQR(req.QRData)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "invalid or tampered QR code")
	}

	// Verify event ID matches
	if payload.EventID != eventID {
		return nil, apperr.New(apperr.ErrCodeForbidden, "QR code is for a different event")
	}

	// Load event
	event, err := s.eventRepo.FindByID(ctx, eventID)
	if err != nil {
		return nil, err
	}

	// Validate check-in time window: 2h before to 4h after event date
	now := time.Now().UTC()
	checkInOpen := event.EventDate.Add(-checkinWindowBefore)
	checkInClose := event.EventDate.Add(checkinWindowAfter)
	if now.Before(checkInOpen) || now.After(checkInClose) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "check-in is outside the allowed time window for this event")
	}

	// Load ticket from DB
	ticket, err := s.ticketRepo.FindByID(ctx, payload.TicketID)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ticket not found")
	}

	// Verify ticket belongs to this event
	if ticket.EventID != eventID {
		return nil, apperr.New(apperr.ErrCodeForbidden, "ticket is not valid for this event")
	}

	// Verify ticket ownership
	if !strings.EqualFold(ticket.OwnerWallet, payload.OwnerWallet) {
		return nil, apperr.New(apperr.ErrCodeForbidden, "ticket ownership mismatch")
	}

	// Verify ticket status is SOLD
	if ticket.Status == domain.TicketStatusCheckedIn {
		return nil, apperr.New(apperr.ErrCodeConflict, "ticket has already been checked in")
	}
	if ticket.Status != domain.TicketStatusSold {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ticket is not in a valid state for check-in")
	}

	// Verify ticket purchase age (<= 12 months)
	purchasedAt := time.Unix(payload.PurchasedAt, 0)
	if now.Sub(purchasedAt) > ticketMaxAge {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ticket has expired (over 12 months old)")
	}

	// Mark ticket as CHECKED_IN
	ticket.Status = domain.TicketStatusCheckedIn
	ticket.CheckedInAt = &now
	ticket.CheckedInBy = staff
	if err := s.ticketRepo.Update(ctx, ticket); err != nil {
		return nil, err
	}

	// Increment event total_checked_in
	event.TotalCheckedIn++
	if err := s.eventRepo.Update(ctx, event); err != nil {
		return nil, err
	}

	return &CheckInResponse{
		TicketID:    ticket.ID,
		EventName:   event.Name,
		OwnerWallet: ticket.OwnerWallet,
		Message:     "Check-in successful",
	}, nil
}

// ─────────────────────────────────────────────
//  Read methods
// ─────────────────────────────────────────────

// GetEvent returns one event by ID.
// This is the basic detail lookup used by event pages and ticket purchase flows.
func (s *Service) GetEvent(ctx context.Context, id string) (*domain.Event, error) {
	return s.eventRepo.FindByID(ctx, id)
}

// ListEvents returns paginated events with optional status filtering.
// Events are sorted by event date ascending so upcoming events appear first by default.
func (s *Service) ListEvents(ctx context.Context, filter *ListEventsQuery, pageReq pagination.Request) ([]*domain.Event, int64, error) {
	opts := []database.QueryOption{
		database.WithPagination(pageReq.Page, pageReq.PageSize),
		database.WithSort("event_date", database.SortAsc),
	}
	if filter != nil && filter.Status != "" {
		opts = append(opts, database.WithEq("status", filter.Status))
	}
	return s.eventRepo.Find(ctx, opts...)
}

// ─────────────────────────────────────────────
//  AES-256-GCM helpers
// ─────────────────────────────────────────────

// deriveAESKey derives a 32-byte AES-256 key from an arbitrary secret string using SHA-256.
// This ensures the configured secret always becomes a valid fixed-size AES key.
func deriveAESKey(secret string) []byte {
	hash := sha256.Sum256([]byte(secret))
	return hash[:]
}

// encryptQR serializes and encrypts the QR payload with AES-256-GCM, returning a base64-encoded transport string.
// Authenticated encryption is used so tampering is detected during later check-in processing.
func (s *Service) encryptQR(payload qrPayload) (string, error) {
	plain, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(s.aesKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	// Seal appends the ciphertext + tag to nonce
	ciphertext := gcm.Seal(nonce, nonce, plain, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decryptQR decodes and decrypts a QR payload, failing when the ciphertext is malformed or authentication tags do not verify.
// This is the core integrity check behind QR-based ticket validation.
func (s *Service) decryptQR(encoded string) (*qrPayload, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(s.aesKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err // authentication tag mismatch → tampered QR
	}

	var payload qrPayload
	if err := json.Unmarshal(plain, &payload); err != nil {
		return nil, err
	}
	return &payload, nil
}

// ─────────────────────────────────────────────
//  Misc helpers
// ─────────────────────────────────────────────

// normalizeWallet trims and canonicalizes the wallet string used by event flows, rejecting empty and zero-address values.
// The event module only needs a lightweight canonical form because ownership checks are string-based.
func normalizeWallet(addr string) string {
	addr = strings.TrimSpace(addr)
	if addr == "" || addr == "0x0000000000000000000000000000000000000000" {
		return ""
	}
	return strings.ToLower(addr)
}
