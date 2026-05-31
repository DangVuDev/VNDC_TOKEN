package dao

type CreateDAORequest struct {
	Name            string `json:"name" binding:"required"`
	Description     string `json:"description"`
	MetadataURI     string `json:"metadata_uri"`
	GovernanceToken string `json:"governance_token" binding:"required"`
	QuorumBps       uint64 `json:"quorum_bps"`
	VotingDelaySec  uint64 `json:"voting_delay_sec"`
	VotingPeriodSec uint64 `json:"voting_period_sec"`
	TimelockSec     uint64 `json:"timelock_sec"`
}

type SetDAOStatusRequest struct {
	Active bool `json:"active" binding:"required"`
}

type CreateProposalRequest struct {
	Title             string `json:"title" binding:"required"`
	Description       string `json:"description" binding:"required"`
	Target            string `json:"target"`
	Value             string `json:"value"`
	Calldata          string `json:"calldata"`
	VotingPeriodHours uint64 `json:"voting_period_hours"`
}

// CastVoteRequest — Weight is NOT accepted from the client.
// Vote power is calculated server-side from token balance and NFT tier.
type CastVoteRequest struct {
	Support *uint8 `json:"support" binding:"required"`
}

type QueueProposalRequest struct {
	TotalVotingPower string `json:"total_voting_power" binding:"required"`
}

type CancelProposalRequest struct {
	Reason string `json:"reason"`
}
