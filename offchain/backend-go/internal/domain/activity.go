package domain

import "time"

// ─────────────────────────────────────────────
//  Activity — UC10-UC12 Requirement
// ─────────────────────────────────────────────

// ActivityCluster defines the category of activity
type ActivityCluster string

const (
	ActivityClusterLearning ActivityCluster = "LEARNING"
	ActivityClusterActivity ActivityCluster = "ACTIVITY"
)

// ActivityType defines the specific type
type ActivityType string

const (
	ActivityTypeReading  ActivityType = "READING"
	ActivityTypeVideo    ActivityType = "VIDEO"
	ActivityTypeQuiz     ActivityType = "QUIZ"
	ActivityTypePhysical ActivityType = "PHYSICAL"
)

// ActivityStatus represents activity state
type ActivityStatus string

const (
	ActivityStatusActive   ActivityStatus = "ACTIVE"
	ActivityStatusArchived ActivityStatus = "ARCHIVED"
	ActivityStatusDraft    ActivityStatus = "DRAFT"
)

// Activity represents a reward activity template (created by lecturer/admin)
type Activity struct {
	BaseEntity `bson:",inline"`

	// Activity metadata
	Title       string `bson:"title"       json:"title"`       // e.g. "Class Attendance Week 1"
	Description string `bson:"description" json:"description"` // Long form description

	// Classification
	Cluster      ActivityCluster `bson:"cluster"       json:"cluster"`
	ActivityType ActivityType    `bson:"activity_type" json:"activity_type"`

	// Reward configuration: points distributed per rating
	PointsPerRating struct {
		Poor    int `bson:"poor"    json:"poor"`    // e.g. 0
		Average int `bson:"average" json:"average"` // e.g. 5
		Good    int `bson:"good"    json:"good"`    // e.g. 10
	} `bson:"points_per_rating" json:"points_per_rating"`

	// Creator information
	CreatedBy string `bson:"created_by" json:"created_by"` // lecturer wallet address

	// Status
	Status ActivityStatus `bson:"status" json:"status"` // ACTIVE, ARCHIVED, DRAFT

	// Optional constraints
	MaxSlots       *int64     `bson:"max_slots,omitempty"       json:"max_slots,omitempty"`
	ExpiresAt      *time.Time `bson:"expires_at,omitempty"      json:"expires_at,omitempty"`    // registration deadline
	EventEndsAt    *time.Time `bson:"event_ends_at,omitempty"   json:"event_ends_at,omitempty"` // activity event end time (ACTIVITY cluster)
	MinTimeSeconds *int64     `bson:"min_time_seconds,omitempty" json:"min_time_seconds,omitempty"`
	MinQuizScore   *int       `bson:"min_quiz_score,omitempty"   json:"min_quiz_score,omitempty"`

	// Content URLs
	ContentURL *string `bson:"content_url,omitempty" json:"content_url,omitempty"`

	// Quiz questions (for QUIZ type)
	QuizQuestions []QuizQuestion `bson:"quiz_questions,omitempty" json:"quiz_questions,omitempty"`

	// Class targeting: empty/nil = all classes, otherwise list of class codes (e.g. ["CNTT-K2024"])
	// Special value ["ALL"] is equivalent to empty (visible to everyone)
	TargetClasses []string `bson:"target_classes,omitempty" json:"target_classes,omitempty"`

	// Timestamps
	CreatedAt time.Time `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}

// GetID returns the activity ID
func (a *Activity) GetID() string { return a.ID }

// SetID sets the activity ID
func (a *Activity) SetID(id string) { a.ID = id }

// ─────────────────────────────────────────────
//  ActivityRecord — Student participation record
// ─────────────────────────────────────────────

// ActivityRecordStatus tracks the state of a participation record
type ActivityRecordStatus string

const (
	ActivityRecordStatusPending   ActivityRecordStatus = "PENDING"   // < 24h, can edit
	ActivityRecordStatusConfirmed ActivityRecordStatus = "CONFIRMED" // >= 24h, locked
	ActivityRecordStatusLocked    ActivityRecordStatus = "LOCKED"    // explicitly locked
)

// Rating represents participation assessment
type Rating string

const (
	RatingPoor    Rating = "POOR"
	RatingAverage Rating = "AVERAGE"
	RatingGood    Rating = "GOOD"
)

// EditRecord tracks a single edit with full audit trail
type EditRecord struct {
	ChangedBy string    `bson:"changed_by"   json:"changed_by"` // lecturer wallet
	OldRating Rating    `bson:"old_rating"   json:"old_rating"`
	NewRating Rating    `bson:"new_rating"   json:"new_rating"`
	OldPoints int       `bson:"old_points"   json:"old_points"`
	NewPoints int       `bson:"new_points"   json:"new_points"`
	ChangedAt time.Time `bson:"changed_at"   json:"changed_at"`
}

// ActivityRecord represents a single student's participation in an activity
type ActivityRecord struct {
	BaseEntity `bson:",inline"`

	// References
	ActivityID      string `bson:"activity_id"       json:"activity_id"`
	StudentAddress  string `bson:"student_address"   json:"student_address"`  // Student wallet
	LecturerAddress string `bson:"lecturer_address"  json:"lecturer_address"` // Lecturer wallet who recorded

	// Assessment
	Rating Rating `bson:"rating" json:"rating"` // POOR, AVERAGE, GOOD
	Points int    `bson:"points" json:"points"` // Calculated from rating

	// Status tracking
	Status       ActivityRecordStatus `bson:"status"        json:"status"` // PENDING, CONFIRMED, LOCKED
	EditDeadline time.Time            `bson:"edit_deadline" json:"edit_deadline"`

	// Edit history (append-only audit trail)
	EditHistory []EditRecord `bson:"edit_history" json:"edit_history"`

	// Claims tracking
	PointsClaimedAt *time.Time `bson:"points_claimed_at,omitempty" json:"points_claimed_at,omitempty"`
	ClaimedPoints   *int       `bson:"claimed_points,omitempty"     json:"claimed_points,omitempty"`

	// Optional note
	Note *string `bson:"note,omitempty" json:"note,omitempty"`

	// Timestamps
	CreatedAt time.Time `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}

// GetID returns the record ID
func (ar *ActivityRecord) GetID() string { return ar.ID }

// SetID sets the record ID
func (ar *ActivityRecord) SetID(id string) { ar.ID = id }

// IsEditWindowOpen checks if the record can still be edited
func (ar *ActivityRecord) IsEditWindowOpen() bool {
	return ar.Status == ActivityRecordStatusPending && time.Now().Before(ar.EditDeadline)
}

// ─────────────────────────────────────────────
//  ActivityClaim — Track point claims
// ─────────────────────────────────────────────

// ActivityClaim tracks when students claim their activity points
type ActivityClaim struct {
	BaseEntity `bson:",inline"`

	StudentAddress    string    `bson:"student_address"   json:"student_address"`
	ActivityRecordIDs []string  `bson:"activity_record_ids" json:"activity_record_ids"`
	TotalPoints       int       `bson:"total_points"      json:"total_points"`
	ClaimedAt         time.Time `bson:"claimed_at"        json:"claimed_at"`

	TransactionID *string `bson:"transaction_id,omitempty" json:"transaction_id,omitempty"`

	Status string `bson:"status" json:"status"` // PENDING, CONFIRMED
}

// GetID returns the claim ID
func (ac *ActivityClaim) GetID() string { return ac.ID }

// SetID sets the claim ID
func (ac *ActivityClaim) SetID(id string) { ac.ID = id }

// ─────────────────────────────────────────────
//  ActivityEnrollment — Student registration (ACTIVITY cluster)
// ─────────────────────────────────────────────

// EnrollmentStatus tracks state of an event registration
type EnrollmentStatus string

const (
	EnrollmentStatusRegistered EnrollmentStatus = "REGISTERED" // Student registered
	EnrollmentStatusAttended   EnrollmentStatus = "ATTENDED"   // Admin marked as attended
	EnrollmentStatusAbsent     EnrollmentStatus = "ABSENT"     // Admin marked as absent
	EnrollmentStatusCancelled  EnrollmentStatus = "CANCELLED"  // Student cancelled
)

// ActivityEnrollment represents a student's self-registration for an ACTIVITY cluster event
type ActivityEnrollment struct {
	BaseEntity `bson:",inline"`

	ActivityID     string           `bson:"activity_id"     json:"activity_id"`
	StudentAddress string           `bson:"student_address" json:"student_address"`
	Status         EnrollmentStatus `bson:"status"          json:"status"`
	EnrolledAt     time.Time        `bson:"enrolled_at"     json:"enrolled_at"`
	UpdatedAt      time.Time        `bson:"updated_at"      json:"updated_at"`
}

// GetID returns the enrollment ID
func (e *ActivityEnrollment) GetID() string { return e.ID }

// ─────────────────────────────────────────────
//  LearningSubmission — Auto-completion (LEARNING cluster)
// ─────────────────────────────────────────────

// LearningSubmission tracks a student's learning session result (LEARNING cluster)
// Created automatically when student completes VIDEO/READING/QUIZ
type LearningSubmission struct {
	BaseEntity `bson:",inline"`

	ActivityID       string    `bson:"activity_id"        json:"activity_id"`
	StudentAddress   string    `bson:"student_address"    json:"student_address"`
	TimeSpentSeconds int64     `bson:"time_spent_seconds" json:"time_spent_seconds"`
	QuizScore        *int      `bson:"quiz_score,omitempty"        json:"quiz_score,omitempty"` // 0-100 percentage
	QuizPassed       *bool     `bson:"quiz_passed,omitempty"       json:"quiz_passed,omitempty"`
	Rating           Rating    `bson:"rating"             json:"rating"`
	Points           int       `bson:"points"             json:"points"`
	ActivityRecordID string    `bson:"activity_record_id" json:"activity_record_id"` // linked record
	CompletedAt      time.Time `bson:"completed_at"       json:"completed_at"`
}

// GetID returns the submission ID
func (s *LearningSubmission) GetID() string { return s.ID }

// ─────────────────────────────────────────────
//  RewardPending — Pending reward transfer
// ─────────────────────────────────────────────

// RewardSource indicates what triggered the reward (activity, claim, etc.)
type RewardSource string

const (
	RewardSourceActivityCompletion RewardSource = "ACTIVITY_COMPLETION" // Auto-generated when activity completes
	RewardSourceActivityClaim      RewardSource = "ACTIVITY_CLAIM"      // From claim request
	RewardSourceManualGrant        RewardSource = "MANUAL_GRANT"        // Admin manually granted
	RewardSourceBounty             RewardSource = "BOUNTY"              // Task/challenge completion
	RewardSourceReferral           RewardSource = "REFERRAL"            // Referral rewards
)

// RewardStatus represents the state of a pending reward
type RewardStatus string

const (
	RewardStatusPending    RewardStatus = "PENDING"    // Waiting for processing
	RewardStatusQueued     RewardStatus = "QUEUED"     // Added to transaction queue
	RewardStatusProcessing RewardStatus = "PROCESSING" // Being processed by worker
	RewardStatusProcessed  RewardStatus = "PROCESSED"  // Successfully moved to processed collection
	RewardStatusFailed     RewardStatus = "FAILED"     // Failed processing
	RewardStatusCancelled  RewardStatus = "CANCELLED"  // Manually cancelled
)

// RewardPending tracks a reward that needs to be transferred to user wallet
// Workers monitors this collection and processes rewards by creating transactions
type RewardPending struct {
	BaseEntity `bson:",inline"`

	// Reward details
	StudentWallet string       `bson:"student_wallet"  json:"student_wallet"` // Recipient wallet (checksummed)
	RewardAmount  string       `bson:"reward_amount"   json:"reward_amount"`  // Amount in wei (as string)
	RewardPoints  int          `bson:"reward_points"   json:"reward_points"`  // Points earned (for display)
	RewardSource  RewardSource `bson:"reward_source"   json:"reward_source"`
	Status        RewardStatus `bson:"status"          json:"status"`

	// References to source entities
	ActivityRecordID *string `bson:"activity_record_id,omitempty" json:"activity_record_id,omitempty"` // From activity completion
	ActivityClaimID  *string `bson:"activity_claim_id,omitempty"  json:"activity_claim_id,omitempty"`  // From activity claim
	ContextID        *string `bson:"context_id,omitempty"         json:"context_id,omitempty"`         // Generic context reference

	// Processing tracking
	TransactionID *string    `bson:"transaction_id,omitempty"   json:"transaction_id,omitempty"` // Linked transaction (once created)
	ProcessedAt   *time.Time `bson:"processed_at,omitempty"     json:"processed_at,omitempty"`   // When it was processed
	LastError     string     `bson:"last_error,omitempty"       json:"last_error,omitempty"`     // Error message if failed
	RetryCount    int        `bson:"retry_count"                json:"retry_count"`
	NextRetryAt   *time.Time `bson:"next_retry_at,omitempty"    json:"next_retry_at,omitempty"`

	// Descriptive information
	Description string `bson:"description,omitempty" json:"description,omitempty"` // Human readable reason

	// Timestamps
	CreatedAt time.Time  `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time  `bson:"updated_at" json:"updated_at"`
	ExpiresAt *time.Time `bson:"expires_at,omitempty" json:"expires_at,omitempty"` // Optional: reward expires after this date
}

// GetID returns the reward ID
func (r *RewardPending) GetID() string { return r.ID }

// SetID sets the reward ID
func (r *RewardPending) SetID(id string) { r.ID = id }

// IsPending returns true if reward is still waiting for processing
func (r *RewardPending) IsPending() bool {
	return r.Status == RewardStatusPending || r.Status == RewardStatusQueued
}

// ─────────────────────────────────────────────
//  RewardProcessed — Processed reward record
// ─────────────────────────────────────────────

// RewardProcessed is an audit record of a successfully processed reward
// Moved from RewardPending after successful transaction settlement
type RewardProcessed struct {
	BaseEntity `bson:",inline"`

	// Reward details (same as pending)
	StudentWallet string       `bson:"student_wallet"  json:"student_wallet"`
	RewardAmount  string       `bson:"reward_amount"   json:"reward_amount"`
	RewardPoints  int          `bson:"reward_points"   json:"reward_points"`
	RewardSource  RewardSource `bson:"reward_source"   json:"reward_source"`

	// References
	ActivityRecordID *string `bson:"activity_record_id,omitempty" json:"activity_record_id,omitempty"`
	ActivityClaimID  *string `bson:"activity_claim_id,omitempty"  json:"activity_claim_id,omitempty"`
	ContextID        *string `bson:"context_id,omitempty"         json:"context_id,omitempty"`

	// Transaction tracking (from processed)
	TransactionID string `bson:"transaction_id" json:"transaction_id"` // The transaction that settled this
	TxHash        string `bson:"tx_hash,omitempty" json:"tx_hash,omitempty"`
	BlockNumber   uint64 `bson:"block_number,omitempty" json:"block_number,omitempty"`

	// Processing history
	OriginalRewardID string     `bson:"original_reward_id" json:"original_reward_id"` // ID from pending collection
	ProcessedAt      time.Time  `bson:"processed_at"       json:"processed_at"`
	SettledAt        *time.Time `bson:"settled_at,omitempty" json:"settled_at,omitempty"`

	// Final status
	IsSuccessful bool   `bson:"is_successful" json:"is_successful"` // true if on-chain settled, false if failed
	FinalError   string `bson:"final_error,omitempty" json:"final_error,omitempty"`

	// Descriptive information
	Description string `bson:"description,omitempty" json:"description,omitempty"`

	// Timestamps
	CreatedAt time.Time `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}

// GetID returns the ID
func (rp *RewardProcessed) GetID() string { return rp.ID }

// SetID sets the ID
func (rp *RewardProcessed) SetID(id string) { rp.ID = id }
