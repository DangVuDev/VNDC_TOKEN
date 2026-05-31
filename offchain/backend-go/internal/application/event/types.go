package event

import "time"

// CreateEventRequest creates a new event with a fixed ticket capacity.
type CreateEventRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	// EventDate as RFC3339 string. Must be at least 48 hours in the future.
	EventDate time.Time `json:"event_date" binding:"required"`
	// Capacity is the total number of tickets (1-10000).
	Capacity int64 `json:"capacity" binding:"required"`
	// TicketPrice in wei as a decimal string. "0" for free events.
	TicketPrice string `json:"ticket_price" binding:"required"`
}

// BuyTicketRequest provides EIP-712 signature for token payment.
type BuyTicketRequest struct {
	Nonce     string `json:"nonce" binding:"required"`
	Deadline  int64  `json:"deadline" binding:"required"`
	Signature string `json:"signature" binding:"required"`
}

// CheckInRequest contains the encrypted QR payload scanned from the attendee's ticket.
type CheckInRequest struct {
	// QRData is the base64-encoded AES-256-GCM encrypted ticket payload.
	QRData string `json:"qr_data" binding:"required"`
}

// BuyTicketResponse is returned after a successful ticket purchase.
type BuyTicketResponse struct {
	TicketID  string `json:"ticket_id"`
	EventName string `json:"event_name"`
	EventDate string `json:"event_date"`
	Price     string `json:"price"`
	// QRData is the encrypted payload the client should render as a QR code image.
	QRData  string `json:"qr_data"`
	Message string `json:"message"`
}

// CheckInResponse is returned after a successful check-in scan.
type CheckInResponse struct {
	TicketID    string `json:"ticket_id"`
	EventName   string `json:"event_name"`
	OwnerWallet string `json:"owner_wallet"`
	Message     string `json:"message"`
}

// ListEventsQuery filters event listings.
type ListEventsQuery struct {
	Status string `form:"status"`
}

// qrPayload is the clear-text payload encrypted inside the QR code.
type qrPayload struct {
	TicketID    string `json:"ticket_id"`
	EventID     string `json:"event_id"`
	OwnerWallet string `json:"owner_wallet"`
	PurchasedAt int64  `json:"purchased_at"` // Unix timestamp
	EventDate   int64  `json:"event_date"`   // Unix timestamp
}
