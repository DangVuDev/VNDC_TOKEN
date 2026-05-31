package task

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Admin â€” Task management
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// CreateTaskRequest is the request body for POST /v1/tasks/admin.
// The onchain_task_id should be keccak256(id) â€” typically set by the caller
// after creating the task offchain and registering it on-chain.
type CreateTaskRequest struct {
	Title         string `json:"title"          binding:"required,min=1,max=255"`
	Description   string `json:"description"    binding:"required,min=1,max=2000"`
	Cluster       string `json:"cluster"        binding:"required,oneof=LEARNING ACTIVITY"`
	TaskType      string `json:"task_type"      binding:"required,oneof=READING VIDEO QUIZ PHYSICAL"`
	RewardAmount  string `json:"reward_amount"  binding:"required"` // VNDC wei as decimal string
	MaxSlots      int64  `json:"max_slots"      binding:"required,gt=0"`
	OnchainTaskId string `json:"onchain_task_id"`      // bytes32 hex â€” set after on-chain registerTask()
	ContractAddr  string `json:"contract_addr"`        // TaskManager contract address
	ExpiresIn     *int64 `json:"expires_in,omitempty"` // seconds from now (optional)
	// Requirements for Cluster 1 (LEARNING)
	MinTimeSeconds *int64 `json:"min_time_seconds,omitempty"` // seconds of engagement required
	MinQuizScore   *int   `json:"min_quiz_score,omitempty"`   // min quiz score out of 10
	// Content URLs (for READING/VIDEO)
	ContentURL *string `json:"content_url,omitempty"` // URL to document or video
	// Quiz questions (for QUIZ type)
	QuizQuestions []QuizQuestionRequest `json:"quiz_questions,omitempty"` // Array of quiz questions
}

// QuizQuestionRequest represents a quiz question in the API request
type QuizQuestionRequest struct {
	ID           string   `json:"id"`            // unique question ID
	Question     string   `json:"question"`      // question text
	Options      []string `json:"options"`       // answer options
	CorrectIndex int      `json:"correct_index"` // index of correct answer in options
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Admin â€” Proof code management (Cluster 2)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// CreateProofCodesRequest is used by admins to generate proof codes for a task.
type CreateProofCodesRequest struct {
	Codes []string `json:"codes" binding:"required,min=1,max=1000"` // list of unique code strings
}

// ProofCodeResponse is the API representation of a ProofCode.
type ProofCodeResponse struct {
	ID         string  `json:"id"`
	Code       string  `json:"code"`
	TaskID     string  `json:"task_id"`
	IsUsed     bool    `json:"is_used"`
	AssignedTo *string `json:"assigned_to,omitempty"`
	UsedAt     *string `json:"used_at,omitempty"`
	CreatedAt  string  `json:"created_at"`
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Student â€” Cluster 1 (Learning session)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// StartSessionRequest is the body for POST /v1/tasks/:taskId/session/start.
type StartSessionRequest struct {
	// No body fields required â€” session starts upon request.
}

// StartSessionResponse is returned when a learning session begins.
type StartSessionResponse struct {
	ProgressID string `json:"progress_id"`
	TaskID     string `json:"task_id"`
	Status     string `json:"status"`
	StartTime  string `json:"start_time"`
	Message    string `json:"message"`
}

// HeartbeatRequest is sent periodically while a student engages with content.
type HeartbeatRequest struct {
	ProgressID string `json:"progress_id" binding:"required"`
}

// HeartbeatResponse confirms receipt of a heartbeat.
type HeartbeatResponse struct {
	ProgressID     string `json:"progress_id"`
	HeartbeatCount int    `json:"heartbeat_count"`
	ElapsedSeconds int64  `json:"elapsed_seconds"`
	Status         string `json:"status"`
}

// CompleteTaskRequest finalises a learning session (with optional quiz score).
type CompleteTaskRequest struct {
	ProgressID string `json:"progress_id" binding:"required"`
	QuizScore  *int   `json:"quiz_score,omitempty"` // 0â€“10, required only for QUIZ tasks
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Student â€” Cluster 2 (Physical proof code)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// SubmitProofCodeRequest is the body for POST /v1/tasks/:taskId/proof-code.
type SubmitProofCodeRequest struct {
	Code string `json:"code" binding:"required,min=1,max=128"`
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Student â€” Submit generic claim
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// SubmitClaimRequest is the request body for POST /v1/tasks/:taskId/claims.
type SubmitClaimRequest struct {
	Proof string `json:"proof" binding:"required"` // Free-form JSON or text describing task completion
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Responses
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// TaskResponse is the JSON representation of a Task for API consumers.
type TaskResponse struct {
	ID              string            `json:"id"`
	Title           string            `json:"title"`
	Description     string            `json:"description"`
	Cluster         string            `json:"cluster"`
	TaskType        string            `json:"task_type"`
	Requirements    RequirementsDTO   `json:"requirements"`
	RewardAmount    string            `json:"reward_amount"`
	MaxSlots        int64             `json:"max_slots"`
	CurrentSlots    int64             `json:"current_slots"`
	RemainingSlots  int64             `json:"remaining_slots"`
	Status          string            `json:"status"`
	OnchainTaskId   string            `json:"onchain_task_id"`
	ContractAddress string            `json:"contract_address"`
	ContentURL      string            `json:"content_url,omitempty"`    // URL for READING/VIDEO
	QuizQuestions   []QuizQuestionDTO `json:"quiz_questions,omitempty"` // Questions for QUIZ
	ExpiresAt       *string           `json:"expires_at,omitempty"`
	CreatedAt       string            `json:"created_at"`
	UpdatedAt       string            `json:"updated_at"`
	// DIAGNOSTIC: This field should appear if binary has latest code
	DiagnosticTestField string `json:"diagnostic_test_field"`
}

// RequirementsDTO exposes task completion requirements.
type RequirementsDTO struct {
	MinTimeSeconds int64 `json:"min_time_seconds"`
	MinQuizScore   int   `json:"min_quiz_score"`
}

// QuizQuestionDTO is the JSON representation of a QuizQuestion
type QuizQuestionDTO struct {
	ID           string   `json:"id"`
	Question     string   `json:"question"`
	Options      []string `json:"options"`
	CorrectIndex int      `json:"correct_index"`
}

// StudentClaimResponse is the JSON representation of a StudentClaim.
// After submission, backend will handle onchain claim automatically.
type StudentClaimResponse struct {
	ID             string `json:"id"`
	TaskID         string `json:"task_id"`
	StudentWallet  string `json:"student_wallet"`
	Nonce          string `json:"nonce"`               // uint256 as decimal string (for idempotency)
	Deadline       int64  `json:"deadline"`            // Unix timestamp
	Signature      string `json:"signature,omitempty"` // EIP-712 backend signature
	Status         string `json:"status"`              // APPROVED | SUCCESS | FAILED
	RewardAmount   string `json:"reward_amount,omitempty"`
	ActivityPoints int64  `json:"activity_points,omitempty"`
	TxHash         string `json:"tx_hash,omitempty"`
	ErrorMessage   string `json:"error_message,omitempty"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  UC10: Create Activity (Admin/Lecturer)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// CreateActivityRequest is the body for POST /api/v1/activities
type CreateActivityRequest struct {
	Title        string `json:"title"       binding:"required,min=1,max=255"`
	Description  string `json:"description" binding:"required,min=1,max=2000"`
	Cluster      string `json:"cluster"     binding:"required,oneof=LEARNING ACTIVITY"`
	ActivityType string `json:"activity_type" binding:"omitempty,oneof=READING VIDEO QUIZ PHYSICAL"`

	// Points per rating
	PointsPoor    *int `json:"points_poor,omitempty"`                                   // defaults to 0
	PointsAverage int  `json:"points_average" binding:"required,min=1"`                 // e.g. 5
	PointsGood    int  `json:"points_good"    binding:"required,gtfield=PointsAverage"` // e.g. 10

	// Optional constraints
	MaxSlots       *int64  `json:"max_slots,omitempty"`
	ExpiresAt      *string `json:"expires_at,omitempty"` // ISO 8601 timestamp
	EventEndsAt    *string `json:"event_ends_at,omitempty"`
	MinTimeSeconds *int64  `json:"min_time_seconds,omitempty"`
	MinQuizScore   *int    `json:"min_quiz_score,omitempty"`

	// Class targeting: nil/empty = visible to ALL, otherwise specific class codes
	TargetClasses []string `json:"target_classes,omitempty"`

	// Content
	ContentURL    *string               `json:"content_url,omitempty"`
	QuizQuestions []QuizQuestionRequest `json:"quiz_questions,omitempty"`
}

// ActivityResponse is the JSON representation of an Activity
type ActivityResponse struct {
	ID              string             `json:"id"`
	Title           string             `json:"title"`
	Description     string             `json:"description"`
	Cluster         string             `json:"cluster"`
	ActivityType    string             `json:"activity_type"`
	PointsPerRating PointsPerRatingDTO `json:"points_per_rating"`
	CreatedBy       string             `json:"created_by"`
	Status          string             `json:"status"`
	MaxSlots        *int64             `json:"max_slots,omitempty"`
	ExpiresAt       *string            `json:"expires_at,omitempty"`
	EventEndsAt     *string            `json:"event_ends_at,omitempty"`
	MinTimeSeconds  *int64             `json:"min_time_seconds,omitempty"`
	MinQuizScore    *int               `json:"min_quiz_score,omitempty"`
	TargetClasses   []string           `json:"target_classes,omitempty"`
	ContentURL      *string            `json:"content_url,omitempty"`
	QuizQuestions   []QuizQuestionDTO  `json:"quiz_questions,omitempty"`
	CreatedAt       string             `json:"created_at"`
	UpdatedAt       string             `json:"updated_at"`
}

// PointsPerRatingDTO represents points for each rating
type PointsPerRatingDTO struct {
	Poor    int `json:"poor"`
	Average int `json:"average"`
	Good    int `json:"good"`
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  UC11: Record Activity (Lecturer/Admin)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// RecordActivityRequest is the body for POST /api/v1/activities/{activityId}/record
type RecordActivityRequest struct {
	StudentAddress string  `json:"student_address" binding:"required"` // wallet address
	Rating         string  `json:"rating"         binding:"required,oneof=POOR AVERAGE GOOD"`
	Note           *string `json:"note,omitempty"`
}

// ActivityRecordResponse is the JSON representation of an ActivityRecord
type ActivityRecordResponse struct {
	RecordID        string `json:"record_id"`
	ActivityID      string `json:"activity_id"`
	ActivityTitle   string `json:"activity_title,omitempty"` // populated when listing student's own records
	StudentAddress  string `json:"student_address"`
	LecturerAddress string `json:"lecturer_address"`
	Rating          string `json:"rating"`
	Points          int    `json:"points"`
	Status          string `json:"status"`
	CanEdit         bool   `json:"can_edit"`
	TimeRemaining   int64  `json:"time_remaining"` // seconds until edit deadline
	EditDeadline    string `json:"edit_deadline"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  UC12: Edit Activity Record (Lecturer/Admin)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// EditActivityRecordRequest is the body for PATCH /api/v1/activities/{activityId}/record/{recordId}
type EditActivityRecordRequest struct {
	Rating string  `json:"rating" binding:"required,oneof=POOR AVERAGE GOOD"`
	Note   *string `json:"note,omitempty"`
}

// EditActivityRecordResponse is returned after edit
type EditActivityRecordResponse struct {
	RecordID      string           `json:"record_id"`
	ActivityID    string           `json:"activity_id"`
	Rating        string           `json:"rating"`
	Points        int              `json:"points"`
	OldPoints     int              `json:"old_points"`
	PointsDelta   int              `json:"points_delta"` // new - old (can be negative)
	Status        string           `json:"status"`
	CanEdit       bool             `json:"can_edit"`
	TimeRemaining int64            `json:"time_remaining"` // seconds until edit deadline
	EditDeadline  string           `json:"edit_deadline"`
	EditHistory   []EditHistoryDTO `json:"edit_history"`
	UpdatedAt     string           `json:"updated_at"`
}

// EditHistoryDTO represents a single edit in the audit trail
type EditHistoryDTO struct {
	ChangedBy string `json:"changed_by"`
	OldRating string `json:"old_rating"`
	NewRating string `json:"new_rating"`
	OldPoints int    `json:"old_points"`
	NewPoints int    `json:"new_points"`
	ChangedAt string `json:"changed_at"`
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  UC13: Enroll in Activity (Student â€” ACTIVITY cluster)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// EnrollmentResponse is the JSON representation of an ActivityEnrollment
type EnrollmentResponse struct {
	ID             string `json:"id"`
	ActivityID     string `json:"activity_id"`
	StudentAddress string `json:"student_address"`
	Status         string `json:"status"` // REGISTERED, ATTENDED, ABSENT, CANCELLED
	EnrolledAt     string `json:"enrolled_at"`
	UpdatedAt      string `json:"updated_at"`
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  UC14: Submit Learning (Student â€” LEARNING cluster)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// QuizAnswerItem is a single student quiz answer
type QuizAnswerItem struct {
	QuestionID  string `json:"question_id"`
	AnswerIndex int    `json:"answer_index"` // 0-3
}

// SubmitLearningRequest is the body for POST /api/v1/activities/:id/submit-learning
type SubmitLearningRequest struct {
	TimeSpentSeconds int64            `json:"time_spent_seconds" binding:"required,min=1"`
	QuizAnswers      []QuizAnswerItem `json:"quiz_answers,omitempty"`
}

// SubmitLearningResponse is returned after learning submission
type SubmitLearningResponse struct {
	RecordID       string `json:"record_id"`
	ActivityID     string `json:"activity_id"`
	Rating         string `json:"rating"`
	Points         int    `json:"points"`
	QuizScore      *int   `json:"quiz_score,omitempty"` // 0-100
	QuizPassed     *bool  `json:"quiz_passed,omitempty"`
	Message        string `json:"message"`
	ActivityPoints int64  `json:"activity_points"` // updated total activity_points of the student
}

// ─────────────────────────────────────────────
//  Ranking
// ─────────────────────────────────────────────

// RankEntry represents one student in the activity-points leaderboard.
type RankEntry struct {
	Rank           int    `json:"rank"`
	StudentWallet  string `json:"student_wallet"`
	StudentName    string `json:"student_name,omitempty"`
	AvatarURI      string `json:"avatar_uri,omitempty"`
	Class          string `json:"class,omitempty"`
	ActivityPoints int64  `json:"activity_points"`
}

// RankingResponse is the paginated leaderboard response.
type RankingResponse struct {
	Entries    []RankEntry `json:"entries"`
	Total      int64       `json:"total"`
	Page       int64       `json:"page"`
	Limit      int64       `json:"limit"`
	TotalPages int64       `json:"total_pages"`
}
