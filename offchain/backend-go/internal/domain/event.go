package domain

import "time"

// EventStatus is the lifecycle state of an event.
type EventStatus string

const (
	EventStatusBookingOpen   EventStatus = "BOOKING_OPEN"
	EventStatusBookingClosed EventStatus = "BOOKING_CLOSED"
	EventStatusCompleted     EventStatus = "COMPLETED"
	EventStatusCancelled     EventStatus = "CANCELLED"
)

// TicketStatus tracks a single event ticket.
type TicketStatus string

const (
	TicketStatusAvailable TicketStatus = "AVAILABLE"
	TicketStatusSold      TicketStatus = "SOLD"
	TicketStatusCheckedIn TicketStatus = "CHECKED_IN"
)

// Event represents a scheduled event with a fixed ticket capacity.
type Event struct {
	BaseEntity `bson:",inline"`

	CreatorWallet string    `bson:"creator_wallet"  json:"creator_wallet"`
	Name          string    `bson:"name"            json:"name"`
	Description   string    `bson:"description"     json:"description"`
	EventDate     time.Time `bson:"event_date"      json:"event_date"`
	Capacity      int64     `bson:"capacity"        json:"capacity"`
	// TicketPrice is the cost in wei (decimal string). "0" means free.
	TicketPrice    string      `bson:"ticket_price"    json:"ticket_price"`
	TotalSold      int64       `bson:"total_sold"      json:"total_sold"`
	TotalCheckedIn int64       `bson:"total_checked_in" json:"total_checked_in"`
	Status         EventStatus `bson:"status"          json:"status"`
}

// EventTicket is a single seat/entry entitlement for an event.
// Tickets are pre-generated for all seats when the event is created.
type EventTicket struct {
	BaseEntity `bson:",inline"`

	EventID     string       `bson:"event_id"                json:"event_id"`
	OwnerWallet string       `bson:"owner_wallet,omitempty"  json:"owner_wallet,omitempty"`
	Status      TicketStatus `bson:"status"                  json:"status"`
	PurchasedAt *time.Time   `bson:"purchased_at,omitempty"  json:"purchased_at,omitempty"`
	CheckedInAt *time.Time   `bson:"checked_in_at,omitempty" json:"checked_in_at,omitempty"`
	CheckedInBy string       `bson:"checked_in_by,omitempty" json:"checked_in_by,omitempty"`
	// QRData is the AES-256-GCM encrypted QR payload encoded as base64.
	// It is populated at purchase time and used for check-in validation.
	QRData string `bson:"qr_data,omitempty"       json:"qr_data,omitempty"`
}
