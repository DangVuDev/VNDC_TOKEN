package domain

import "time"

// CampaignStatus is the lifecycle of a crowdfunding campaign.
type CampaignStatus string

const (
	CampaignStatusActive      CampaignStatus = "ACTIVE"
	CampaignStatusGoalReached CampaignStatus = "GOAL_REACHED"
	CampaignStatusSucceeded   CampaignStatus = "SUCCEEDED"
	CampaignStatusFailed      CampaignStatus = "FAILED"
)

// ContributionStatus tracks the lifecycle of a single contribution.
type ContributionStatus string

const (
	ContributionStatusPending   ContributionStatus = "PENDING"
	ContributionStatusConfirmed ContributionStatus = "CONFIRMED"
	ContributionStatusRefunded  ContributionStatus = "REFUNDED"
)

// FundraisingCampaign is a time-bounded crowdfunding campaign with an optional goal.
// When the deadline passes:
//   - totalContributed >= goalAmount → SUCCEEDED (creator receives funds)
//   - totalContributed <  goalAmount → FAILED    (all contributors are refunded)
type FundraisingCampaign struct {
	BaseEntity `bson:",inline"`

	CreatorWallet string `bson:"creator_wallet"    json:"creator_wallet"`
	Title         string `bson:"title"             json:"title"`
	Description   string `bson:"description"       json:"description"`
	// GoalAmount and TotalContributed are wei amounts encoded as decimal strings.
	GoalAmount       string         `bson:"goal_amount"        json:"goal_amount"`
	TotalContributed string         `bson:"total_contributed"  json:"total_contributed"`
	Deadline         time.Time      `bson:"deadline"           json:"deadline"`
	Status           CampaignStatus `bson:"status"             json:"status"`
	DistributedAt    *time.Time     `bson:"distributed_at,omitempty"  json:"distributed_at,omitempty"`
	RefundedAt       *time.Time     `bson:"refunded_at,omitempty"     json:"refunded_at,omitempty"`
}

// FundraisingContribution is a single token pledge inside a campaign.
type FundraisingContribution struct {
	BaseEntity `bson:",inline"`

	CampaignID        string `bson:"campaign_id"         json:"campaign_id"`
	ContributorWallet string `bson:"contributor_wallet"  json:"contributor_wallet"`
	// Amount is in wei as a decimal string.
	Amount string             `bson:"amount"              json:"amount"`
	Status ContributionStatus `bson:"status"              json:"status"`
}
