package domain

import (
	"time"
)

// TaskStatus represents the status of a task
type TaskStatus string

const (
	TaskStatusActive  TaskStatus = "ACTIVE"
	TaskStatusPaused  TaskStatus = "PAUSED"
	TaskStatusClosed  TaskStatus = "CLOSED"
	TaskStatusExpired TaskStatus = "EXPIRED"
)

// TaskCluster represents the cluster/category of a task
type TaskCluster string

const (
	TaskClusterLearning TaskCluster = "LEARNING" // Cluster 1: reading, video, quiz
	TaskClusterActivity TaskCluster = "ACTIVITY" // Cluster 2: physical proof code
)

// TaskType is the specific type within a cluster
type TaskType string

const (
	TaskTypeReading  TaskType = "READING"
	TaskTypeVideo    TaskType = "VIDEO"
	TaskTypeQuiz     TaskType = "QUIZ"
	TaskTypePhysical TaskType = "PHYSICAL" // physical proof code
)

// TaskRequirements holds the validation rules for completing a task
type TaskRequirements struct {
	MinTimeSeconds int64 `bson:"min_time_seconds" json:"min_time_seconds"` // minimum seconds required (Cluster 1)
	MinQuizScore   int   `bson:"min_quiz_score"   json:"min_quiz_score"`   // minimum quiz score out of 10 (Cluster 1 quiz)
}

// QuizQuestion represents a single quiz question for QUIZ type tasks
type QuizQuestion struct {
	ID           string   `bson:"id"              json:"id"`            // unique question ID
	Question     string   `bson:"question"        json:"question"`      // question text
	Options      []string `bson:"options"         json:"options"`       // answer options
	CorrectIndex int      `bson:"correct_index"   json:"correct_index"` // index of correct answer in options
}

// Task represents a reward task on the blockchain
type Task struct {
	BaseEntity `bson:",inline"`

	// Task metadata
	Title       string `bson:"title"       json:"title"`
	Description string `bson:"description" json:"description"`

	// Task classification
	Cluster      TaskCluster      `bson:"cluster"       json:"cluster"`
	TaskType     TaskType         `bson:"task_type"     json:"task_type"`
	Requirements TaskRequirements `bson:"requirements"  json:"requirements"`

	// Content (for READING/VIDEO/QUIZ)
	ContentURL    string         `bson:"content_url,omitempty" json:"content_url,omitempty"`       // URL for READING/VIDEO
	QuizQuestions []QuizQuestion `bson:"quiz_questions,omitempty" json:"quiz_questions,omitempty"` // Questions for QUIZ type

	// Reward configuration
	RewardAmount string `bson:"reward_amount" json:"reward_amount"` // wei as string
	MaxSlots     int64  `bson:"max_slots"     json:"max_slots"`

	// Current state
	CurrentSlots int64      `bson:"current_slots" json:"current_slots"`
	Status       TaskStatus `bson:"status"        json:"status"`

	// On-chain reference
	OnchainTaskId string `bson:"onchain_task_id" json:"onchain_task_id"` // keccak256 hash
	ContractAddr  string `bson:"contract_addr"   json:"contract_addr"`

	// Timestamps
	ExpiresAt *time.Time `bson:"expires_at,omitempty" json:"expires_at,omitempty"`
}

// GetID returns the task ID
func (t *Task) GetID() string { return t.ID }

// SetID sets the task ID
func (t *Task) SetID(id string) { t.ID = id }

// ─────────────────────────────────────────────
//  ProofCode — Cluster 2 (Physical activity)
// ─────────────────────────────────────────────

// ProofCode is a one-time physical proof code distributed to students for Cluster 2 tasks.
type ProofCode struct {
	BaseEntity `bson:",inline"`

	Code       string     `bson:"code"        json:"code"` // e.g. "VNDC-SUMMER-2024-XYZ"
	TaskID     string     `bson:"task_id"     json:"task_id"`
	IsUsed     bool       `bson:"is_used"     json:"is_used"`
	AssignedTo *string    `bson:"assigned_to" json:"assigned_to"` // wallet address of claimer
	UsedAt     *time.Time `bson:"used_at,omitempty" json:"used_at,omitempty"`
}

// GetID returns the proof code ID
func (p *ProofCode) GetID() string { return p.ID }

// SetID sets the proof code ID
func (p *ProofCode) SetID(id string) { p.ID = id }

// ─────────────────────────────────────────────
//  UserProgress — Cluster 1 (Learning sessions)
// ─────────────────────────────────────────────

// ProgressStatus tracks the state of a learning session
type ProgressStatus string

const (
	ProgressStatusInProgress ProgressStatus = "IN_PROGRESS"
	ProgressStatusCompleted  ProgressStatus = "COMPLETED"
	ProgressStatusClaimed    ProgressStatus = "CLAIMED"
	ProgressStatusExpired    ProgressStatus = "EXPIRED"
)

// UserProgress tracks a student's progress through a learning task.
type UserProgress struct {
	BaseEntity `bson:",inline"`

	UserWallet string         `bson:"user_wallet" json:"user_wallet"`
	TaskID     string         `bson:"task_id"     json:"task_id"`
	Status     ProgressStatus `bson:"status"      json:"status"`

	// Tracking
	StartTime      time.Time  `bson:"start_time"      json:"start_time"`
	LastHeartbeat  *time.Time `bson:"last_heartbeat,omitempty"  json:"last_heartbeat,omitempty"`
	HeartbeatCount int        `bson:"heartbeat_count" json:"heartbeat_count"`
	CompletedAt    *time.Time `bson:"completed_at,omitempty"   json:"completed_at,omitempty"`

	// Quiz results (optional — only for TaskTypeQuiz)
	QuizScore *int `bson:"quiz_score,omitempty" json:"quiz_score,omitempty"`
}

// GetID returns the progress ID
func (p *UserProgress) GetID() string { return p.ID }

// SetID sets the progress ID
func (p *UserProgress) SetID(id string) { p.ID = id }

// ElapsedSeconds returns how many seconds have elapsed since the session started.
func (p *UserProgress) ElapsedSeconds() int64 {
	return int64(time.Since(p.StartTime).Seconds())
}

// ─────────────────────────────────────────────
//  StudentClaim
// ─────────────────────────────────────────────

// Claim status constants.
const (
	ClaimStatusApproved      = "APPROVED"       // proof verified, waiting for on-chain settlement
	ClaimStatusTokenReceived = "TOKEN_RECEIVED" // on-chain tx confirmed, tokens transferred
	ClaimStatusFailed        = "FAILED"         // on-chain settlement failed
)

// StudentClaim represents a student's claim for a task reward
type StudentClaim struct {
	BaseEntity `bson:",inline"`

	// Reference
	TaskID        string `bson:"task_id"   json:"task_id"`
	StudentWallet string `bson:"student_wallet" json:"student_wallet"`

	// Proof data
	Nonce    string `bson:"nonce"     json:"nonce"`    // uint256 as string
	Deadline int64  `bson:"deadline"  json:"deadline"` // Unix timestamp
	Proof    string `bson:"proof"     json:"proof"`    // JSON data to verify

	// Signature from backend (EIP-712)
	Signature string `bson:"signature" json:"signature"` // EIP-712 signature

	// On-chain tx
	TxHash string `bson:"tx_hash,omitempty"  json:"tx_hash,omitempty"`
	Status string `bson:"status"             json:"status"` // PENDING, SUCCESS, FAILED, EXPIRED

	// Result
	RewardAmount   string `bson:"reward_amount,omitempty" json:"reward_amount,omitempty"`
	ActivityPoints int64  `bson:"activity_points,omitempty" json:"activity_points,omitempty"`
	ErrorMsg       string `bson:"error_msg,omitempty"   json:"error_msg,omitempty"`
}

// GetID returns the claim ID
func (c *StudentClaim) GetID() string { return c.ID }

// SetID sets the claim ID
func (c *StudentClaim) SetID(id string) { c.ID = id }
