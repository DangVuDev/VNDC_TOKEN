package ports

import (
	"context"

	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/pkg/database"
)

// FundraisingCampaignRepository manages crowdfunding campaigns.
type FundraisingCampaignRepository interface {
	Create(ctx context.Context, campaign *domain.FundraisingCampaign) error
	FindByID(ctx context.Context, id string) (*domain.FundraisingCampaign, error)
	Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.FundraisingCampaign, int64, error)
	FindExpiredActive(ctx context.Context) ([]*domain.FundraisingCampaign, error)
	Update(ctx context.Context, campaign *domain.FundraisingCampaign) error
}

// FundraisingContributionRepository manages individual contributions.
type FundraisingContributionRepository interface {
	Create(ctx context.Context, contribution *domain.FundraisingContribution) error
	FindByID(ctx context.Context, id string) (*domain.FundraisingContribution, error)
	FindByCampaign(ctx context.Context, campaignID string) ([]*domain.FundraisingContribution, error)
	FindPendingByCampaign(ctx context.Context, campaignID string) ([]*domain.FundraisingContribution, error)
	UpdateStatus(ctx context.Context, id string, status domain.ContributionStatus) error
}

// EventRepository manages events.
type EventRepository interface {
	Create(ctx context.Context, event *domain.Event) error
	FindByID(ctx context.Context, id string) (*domain.Event, error)
	Find(ctx context.Context, opts ...database.QueryOption) ([]*domain.Event, int64, error)
	Update(ctx context.Context, event *domain.Event) error
}

// EventTicketRepository manages individual event tickets.
type EventTicketRepository interface {
	BulkCreate(ctx context.Context, tickets []*domain.EventTicket) error
	FindAvailable(ctx context.Context, eventID string) (*domain.EventTicket, error)
	FindByID(ctx context.Context, id string) (*domain.EventTicket, error)
	FindByOwner(ctx context.Context, wallet string, opts ...database.QueryOption) ([]*domain.EventTicket, int64, error)
	Update(ctx context.Context, ticket *domain.EventTicket) error
}
