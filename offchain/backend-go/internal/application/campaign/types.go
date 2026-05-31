package campaign

import "time"

// CreateCampaignRequest creates a new crowdfunding campaign.
type CreateCampaignRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description" binding:"required"`
	// GoalAmount in wei as a decimal string.
	GoalAmount string `json:"goal_amount" binding:"required"`
	// DurationDays sets the campaign deadline relative to now (1-90).
	DurationDays int `json:"duration_days" binding:"required"`
}

// ContributeRequest records a token contribution to a campaign.
type ContributeRequest struct {
	// Amount in wei as a decimal string.
	Amount    string `json:"amount" binding:"required"`
	Nonce     string `json:"nonce" binding:"required"`
	Deadline  int64  `json:"deadline" binding:"required"`
	Signature string `json:"signature" binding:"required"`
}

// ListCampaignsQuery filters campaign listings.
type ListCampaignsQuery struct {
	Status   string `form:"status"`
	Page     int64  `form:"page"`
	PageSize int64  `form:"page_size"`
}

// CampaignResponse is the public-facing campaign DTO.
type CampaignResponse struct {
	ID               string     `json:"id"`
	CreatorWallet    string     `json:"creator_wallet"`
	Title            string     `json:"title"`
	Description      string     `json:"description"`
	GoalAmount       string     `json:"goal_amount"`
	TotalContributed string     `json:"total_contributed"`
	Deadline         time.Time  `json:"deadline"`
	Status           string     `json:"status"`
	PercentComplete  float64    `json:"percent_complete"`
	DistributedAt    *time.Time `json:"distributed_at,omitempty"`
	RefundedAt       *time.Time `json:"refunded_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
}

// ContributeResponse is returned after a successful contribution.
type ContributeResponse struct {
	ContributionID   string  `json:"contribution_id"`
	Amount           string  `json:"amount"`
	TotalContributed string  `json:"total_contributed"`
	GoalAmount       string  `json:"goal_amount"`
	PercentComplete  float64 `json:"percent_complete"`
	Message          string  `json:"message"`
}
