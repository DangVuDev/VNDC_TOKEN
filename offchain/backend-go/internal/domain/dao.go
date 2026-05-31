package domain

import "time"

type DAOStatus string

const (
	DAOStatusActive   DAOStatus = "ACTIVE"
	DAOStatusInactive DAOStatus = "INACTIVE"
)

type DAOProposalStatus string

const (
	DAOProposalPending   DAOProposalStatus = "PENDING"
	DAOProposalActive    DAOProposalStatus = "ACTIVE"
	DAOProposalSucceeded DAOProposalStatus = "SUCCEEDED"
	DAOProposalDefeated  DAOProposalStatus = "DEFEATED"
	DAOProposalQueued    DAOProposalStatus = "QUEUED"
	DAOProposalExecuted  DAOProposalStatus = "EXECUTED"
	DAOProposalCancelled DAOProposalStatus = "CANCELLED"
	DAOProposalExpired   DAOProposalStatus = "EXPIRED"
)

type DAOOrganization struct {
	BaseEntity `bson:",inline"`

	Name            string    `bson:"name"               json:"name"`
	Description     string    `bson:"description"        json:"description"`
	MetadataURI     string    `bson:"metadata_uri"       json:"metadata_uri"`
	GovernanceToken string    `bson:"governance_token"   json:"governance_token"`
	FounderWallet   string    `bson:"founder_wallet"     json:"founder_wallet"`
	OnchainDAOID    string    `bson:"onchain_dao_id"     json:"onchain_dao_id"`
	ContractAddress string    `bson:"contract_address"   json:"contract_address"`
	CreateTxHash    string    `bson:"create_tx_hash"     json:"create_tx_hash"`
	QuorumBps       uint64    `bson:"quorum_bps"         json:"quorum_bps"`
	VotingDelaySec  uint64    `bson:"voting_delay_sec"   json:"voting_delay_sec"`
	VotingPeriodSec uint64    `bson:"voting_period_sec"  json:"voting_period_sec"`
	TimelockSec     uint64    `bson:"timelock_sec"       json:"timelock_sec"`
	Status          DAOStatus `bson:"status"             json:"status"`
}

type DAOProposal struct {
	BaseEntity `bson:",inline"`

	DAOID             string            `bson:"dao_id"              json:"dao_id"`
	OnchainProposalID string            `bson:"onchain_proposal_id" json:"onchain_proposal_id"`
	ProposerWallet    string            `bson:"proposer_wallet"     json:"proposer_wallet"`
	Title             string            `bson:"title"               json:"title"`
	Target            string            `bson:"target"              json:"target"`
	Value             string            `bson:"value"               json:"value"`
	Calldata          string            `bson:"calldata"            json:"calldata"`
	Description       string            `bson:"description"         json:"description"`
	DescriptionHash   string            `bson:"description_hash"    json:"description_hash"`
	Status            DAOProposalStatus `bson:"status"              json:"status"`
	ForVotes          string            `bson:"for_votes"           json:"for_votes"`
	AgainstVotes      string            `bson:"against_votes"       json:"against_votes"`
	AbstainVotes      string            `bson:"abstain_votes"       json:"abstain_votes"`
	StartTime         *time.Time        `bson:"start_time,omitempty" json:"start_time,omitempty"`
	EndTime           *time.Time        `bson:"end_time,omitempty"   json:"end_time,omitempty"`
	Eta               *time.Time        `bson:"eta,omitempty"        json:"eta,omitempty"`
	CreateTxHash      string            `bson:"create_tx_hash"      json:"create_tx_hash"`
	QueueTxHash       string            `bson:"queue_tx_hash,omitempty" json:"queue_tx_hash,omitempty"`
	ExecuteTxHash     string            `bson:"execute_tx_hash,omitempty" json:"execute_tx_hash,omitempty"`
	CancelTxHash      string            `bson:"cancel_tx_hash,omitempty" json:"cancel_tx_hash,omitempty"`
}

type DAOVote struct {
	BaseEntity `bson:",inline"`

	ProposalID    string `bson:"proposal_id"    json:"proposal_id"`
	VoterWallet   string `bson:"voter_wallet"   json:"voter_wallet"`
	Support       uint8  `bson:"support"        json:"support"` // 0=against, 1=for, 2=abstain
	Weight        string `bson:"weight"         json:"weight"`
	OnchainTxHash string `bson:"onchain_tx_hash" json:"onchain_tx_hash"`
}
