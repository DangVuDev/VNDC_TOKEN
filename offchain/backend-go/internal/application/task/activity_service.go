package task

import (
	"context"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/google/uuid"
	"github.com/vndc/backend/internal/domain"
	"github.com/vndc/backend/internal/ports"
	apperr "github.com/vndc/backend/pkg/errors"
	"github.com/vndc/backend/pkg/logger"
	"github.com/vndc/backend/pkg/timeutil"
)

// formatTimeUTC7 formats timestamps into the timezone/display convention used by activity-facing responses.
// Centralizing this keeps response DTO helpers consistent across activity, enrollment, and learning submission flows.
func formatTimeUTC7(t time.Time) string { return timeutil.FormatRFC3339UTC7(t) }

// -----------------------------------------------------------------------------
// ActivityService - UC10: Create Activity
// -----------------------------------------------------------------------------

// ActivityService manages activity-template creation, retrieval, listing, and leaderboard reads.
// It owns rules around cluster-specific fields, class visibility, and lecturer/admin creation authority.
type ActivityService struct {
	activityRepo ports.ActivityRepository
	userRepo     ports.UserRepository
	log          logger.Logger
}

// NewActivityService constructs the activity service with repositories for activities and user lookups.
// User access is needed here because creation and listing rules depend on the actor's roles and class metadata.
func NewActivityService(
	activityRepo ports.ActivityRepository,
	userRepo ports.UserRepository,
	log logger.Logger,
) *ActivityService {
	return &ActivityService{
		activityRepo: activityRepo,
		userRepo:     userRepo,
		log:          log.Named("activity_service"),
	}
}

// CreateActivity creates a new activity template after validating actor privileges and cluster-specific requirements.
// It supports both LEARNING and ACTIVITY clusters while enforcing required timing and quiz-related fields appropriately.
func (s *ActivityService) CreateActivity(
	ctx context.Context,
	lecturerID string,
	req *CreateActivityRequest,
) (*ActivityResponse, error) {
	// Get lecturer info (validate exists)
	lecturer, err := s.userRepo.FindByID(ctx, lecturerID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}

	// Validate role (LECTURER or ADMIN)
	isLecturer := false
	for _, role := range lecturer.Roles {
		if role == "LECTURER" || role == "ADMIN" {
			isLecturer = true
			break
		}
	}
	if !isLecturer {
		return nil, apperr.New(apperr.ErrCodeForbidden, "Only lecturers or admins can create activities")
	}

	// Validate input
	if req.Title == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Title is required")
	}
	if req.Description == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Description is required")
	}

	// Validate activity_type is required for LEARNING cluster
	if req.Cluster == string(domain.ActivityClusterLearning) && req.ActivityType == "" {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "activity_type is required for LEARNING cluster")
	}

	// Set default points for poor if not provided
	pointsPoor := 0
	if req.PointsPoor != nil {
		pointsPoor = *req.PointsPoor
	}

	// Parse expiration time if provided
	var expiresAt *time.Time
	if req.ExpiresAt != nil {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid expiresAt format, use ISO 8601")
		}
		expiresAt = &t
	}

	// Parse event end time if provided (used for ACTIVITY cluster)
	var eventEndsAt *time.Time
	if req.EventEndsAt != nil {
		t, err := time.Parse(time.RFC3339, *req.EventEndsAt)
		if err != nil {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid event_ends_at format, use ISO 8601")
		}
		eventEndsAt = &t
	}

	if req.Cluster == string(domain.ActivityClusterActivity) {
		if eventEndsAt == nil {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "event_ends_at is required for ACTIVITY cluster")
		}
		if expiresAt != nil && eventEndsAt.Before(*expiresAt) {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "event_ends_at must be after expires_at")
		}
	}

	// Create domain object
	activity := &domain.Activity{
		BaseEntity: domain.BaseEntity{
			ID: uuid.New().String(),
		},
		Title:        req.Title,
		Description:  req.Description,
		Cluster:      domain.ActivityCluster(req.Cluster),
		ActivityType: domain.ActivityType(req.ActivityType),
		PointsPerRating: struct {
			Poor    int `bson:"poor"    json:"poor"`
			Average int `bson:"average" json:"average"`
			Good    int `bson:"good"    json:"good"`
		}{
			Poor:    pointsPoor,
			Average: req.PointsAverage,
			Good:    req.PointsGood,
		},
		CreatedBy:      lecturer.WalletAddress,
		Status:         domain.ActivityStatusActive,
		MaxSlots:       req.MaxSlots,
		ExpiresAt:      expiresAt,
		EventEndsAt:    eventEndsAt,
		MinTimeSeconds: req.MinTimeSeconds,
		MinQuizScore:   req.MinQuizScore,
		ContentURL:     req.ContentURL,
		TargetClasses:  req.TargetClasses,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	// Convert quiz questions if present
	if len(req.QuizQuestions) > 0 {
		activity.QuizQuestions = make([]domain.QuizQuestion, len(req.QuizQuestions))
		for i, q := range req.QuizQuestions {
			activity.QuizQuestions[i] = domain.QuizQuestion{
				ID:           q.ID,
				Question:     q.Question,
				Options:      q.Options,
				CorrectIndex: q.CorrectIndex,
			}
		}
	}

	// Store in database
	if err := s.activityRepo.Create(ctx, activity); err != nil {
		s.log.Error("Failed to create activity", logger.Err(err))
		return nil, apperr.New(apperr.ErrCodeDatabase, "Failed to create activity")
	}

	return toActivityResponse(activity), nil
}

// GetActivity returns one activity template by ID.
// This is the primary detail lookup used by activity pages, enrollment flows, and lecturer review screens.
func (s *ActivityService) GetActivity(ctx context.Context, activityID string) (*ActivityResponse, error) {
	activity, err := s.activityRepo.FindByID(ctx, activityID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}
	return toActivityResponse(activity), nil
}

// ListActivities returns activities visible to the requesting viewer class or privilege level.
// Students are restricted by registration deadlines and target-class filters, while privileged viewers may see the broader set.
func (s *ActivityService) ListActivities(ctx context.Context, userClass string) ([]ActivityResponse, int64, error) {
	activities, _, err := s.activityRepo.FindAll(ctx)
	if err != nil {
		s.log.Error("Failed to list activities", logger.Err(err))
		return nil, 0, apperr.New(apperr.ErrCodeDatabase, "Failed to list activities")
	}

	now := time.Now()
	normalizedUserClass := normalizeClassCode(userClass)
	isPrivilegedViewer := normalizedUserClass == "ALL" || normalizedUserClass == ""
	results := make([]ActivityResponse, 0, len(activities))
	for _, a := range activities {
		// Students only see activities before registration deadline.
		if !isPrivilegedViewer && a.ExpiresAt != nil && now.After(*a.ExpiresAt) {
			continue
		}
		// Filter by class (skip if userClass provided and activity targets specific classes)
		if len(a.TargetClasses) > 0 && !isClassAllowed(a.TargetClasses, normalizedUserClass) {
			continue
		}
		results = append(results, *toActivityResponse(a))
	}
	return results, int64(len(results)), nil
}

// -----------------------------------------------------------------------------
// ActivityRecordService - UC11, UC12
// -----------------------------------------------------------------------------

// ActivityRecordService manages lecturer/admin recording of student participation and later time-bounded edits.
// It also queues reward records derived from activity participation scores.
type ActivityRecordService struct {
	activityRepo       ports.ActivityRepository
	activityRecordRepo ports.ActivityRecordRepository
	rewardPendingRepo  ports.RewardRepository
	userRepo           ports.UserRepository
	rewardRate         *big.Int
	log                logger.Logger
}

// NewActivityRecordService constructs the service responsible for activity-record writes and pending-reward creation.
// The reward rate is normalized here once so later record flows can convert points into token amounts consistently.
func NewActivityRecordService(
	activityRepo ports.ActivityRepository,
	activityRecordRepo ports.ActivityRecordRepository,
	rewardPendingRepo ports.RewardRepository,
	userRepo ports.UserRepository,
	rewardRateWeiPerPoint *big.Int,
	log logger.Logger,
) *ActivityRecordService {
	if rewardRateWeiPerPoint == nil || rewardRateWeiPerPoint.Sign() <= 0 {
		rewardRateWeiPerPoint = big.NewInt(1)
	}
	return &ActivityRecordService{
		activityRepo:       activityRepo,
		activityRecordRepo: activityRecordRepo,
		rewardPendingRepo:  rewardPendingRepo,
		userRepo:           userRepo,
		rewardRate:         new(big.Int).Set(rewardRateWeiPerPoint),
		log:                log.Named("activity_record_service"),
	}
}

// RecordActivity records one student's participation in an activity after validating actor role, activity state, and duplicate constraints.
// For successful records it also creates a pending reward entry so token distribution can be processed asynchronously.
func (s *ActivityRecordService) RecordActivity(
	ctx context.Context,
	lecturerID string,
	activityID string,
	req *RecordActivityRequest,
) (*ActivityRecordResponse, error) {
	// Validate lecturer
	lecturer, err := s.userRepo.FindByID(ctx, lecturerID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}

	// Check role
	isLecturer := false
	for _, role := range lecturer.Roles {
		if role == "LECTURER" || role == "ADMIN" {
			isLecturer = true
			break
		}
	}
	if !isLecturer {
		return nil, apperr.New(apperr.ErrCodeForbidden, "Only lecturers or admins can record activities")
	}

	// Validate activity exists
	activity, err := s.activityRepo.FindByID(ctx, activityID)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeNotFound, "Activity not found")
	}

	// Validate student exists (by wallet address)
	// Note: We don't require a registered student, just validate address format
	if !isValidEthereumAddress(req.StudentAddress) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid student address format")
	}

	if activity.Cluster == domain.ActivityClusterActivity {
		if activity.EventEndsAt == nil || time.Now().Before(*activity.EventEndsAt) {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "Can only record ACTIVITY after event ends")
		}
	}

	// Check for duplicate record
	existing, _ := s.activityRecordRepo.FindByActivityAndStudent(ctx, activityID, req.StudentAddress)
	if existing != nil {
		return nil, apperr.New(apperr.ErrCodeConflict, "Record already exists for this student in this activity")
	}

	// Convert rating to domain type
	rating := domain.Rating(req.Rating)

	// Calculate points based on rating
	var points int
	switch rating {
	case domain.RatingGood:
		points = activity.PointsPerRating.Good
	case domain.RatingAverage:
		points = activity.PointsPerRating.Average
	case domain.RatingPoor:
		points = activity.PointsPerRating.Poor
	default:
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid rating")
	}

	// Create record
	now := time.Now()
	editDeadline := now.Add(24 * time.Hour)

	record := &domain.ActivityRecord{
		BaseEntity: domain.BaseEntity{
			ID: uuid.New().String(),
		},
		ActivityID:      activityID,
		StudentAddress:  req.StudentAddress,
		LecturerAddress: lecturer.WalletAddress,
		Rating:          rating,
		Points:          points,
		Status:          domain.ActivityRecordStatusPending,
		EditDeadline:    editDeadline,
		EditHistory:     []domain.EditRecord{},
		Note:            req.Note,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	// Store in database
	if err := s.activityRecordRepo.Create(ctx, record); err != nil {
		s.log.Error("Failed to create activity record", logger.Err(err))
		return nil, apperr.New(apperr.ErrCodeDatabase, "Failed to record activity")
	}

	if err := s.createPendingReward(ctx, record, req.StudentAddress, points, activityID, "Activity participation reward"); err != nil {
		s.log.Error("failed to queue pending reward for recorded activity",
			logger.String("record_id", record.ID),
			logger.String("wallet", req.StudentAddress),
			logger.Err(err),
		)
	}

	return toActivityRecordResponse(record), nil
}

// createPendingReward materializes a queued reward record from an activity record and point total.
// This helper keeps reward-enqueue logic shared across manual record creation and enrollment evaluation flows.
func (s *ActivityRecordService) createPendingReward(
	ctx context.Context,
	record *domain.ActivityRecord,
	studentWallet string,
	points int,
	activityID string,
	description string,
) error {
	if s.rewardPendingRepo == nil || points <= 0 {
		return nil
	}

	addr := common.HexToAddress(studentWallet)
	if addr == (common.Address{}) {
		return apperr.New(apperr.ErrCodeBadRequest, "Invalid student address format")
	}

	rewardAmountWei := new(big.Int).Mul(big.NewInt(int64(points)), s.rewardRate)
	recordID := record.ID
	contextID := activityID
	now := time.Now()

	reward := &domain.RewardPending{
		BaseEntity:       domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		StudentWallet:    addr.Hex(),
		RewardAmount:     rewardAmountWei.String(),
		RewardPoints:     points,
		RewardSource:     domain.RewardSourceActivityCompletion,
		Status:           domain.RewardStatusPending,
		ActivityRecordID: &recordID,
		ContextID:        &contextID,
		Description:      description,
		RetryCount:       0,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := s.rewardPendingRepo.Create(ctx, reward); err != nil {
		return err
	}

	s.log.Info("queued pending reward from admin record",
		logger.String("reward_id", reward.ID),
		logger.String("record_id", recordID),
		logger.String("wallet", reward.StudentWallet),
		logger.Int("points", points),
		logger.String("amount_wei", reward.RewardAmount),
	)

	return nil
}

// EditActivityRecord allows a lecturer or admin to correct a recently created activity record while the edit window is still open.
// The method preserves an edit history trail so later audits can reconstruct what changed and who changed it.
func (s *ActivityRecordService) EditActivityRecord(
	ctx context.Context,
	lecturerID string,
	activityID string,
	recordID string,
	req *EditActivityRecordRequest,
) (*EditActivityRecordResponse, error) {
	// Validate lecturer
	lecturer, err := s.userRepo.FindByID(ctx, lecturerID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}

	// Check role
	isLecturer := false
	for _, role := range lecturer.Roles {
		if role == "LECTURER" || role == "ADMIN" {
			isLecturer = true
			break
		}
	}
	if !isLecturer {
		return nil, apperr.New(apperr.ErrCodeForbidden, "Only lecturers or admins can edit activities")
	}

	// Get activity
	activity, err := s.activityRepo.FindByID(ctx, activityID)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeNotFound, "Activity not found")
	}

	// Get record
	record, err := s.activityRecordRepo.FindByID(ctx, recordID)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeNotFound, "Record not found")
	}

	// Verify record belongs to this activity
	if record.ActivityID != activityID {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Record does not belong to this activity")
	}

	// Check edit window (must be < 24h old and status = PENDING)
	if !record.IsEditWindowOpen() {
		return nil, apperr.New(apperr.ErrCodeNotFound, "Cannot edit, edit window closed (24 hours passed)")
	}

	// Convert new rating
	newRating := domain.Rating(req.Rating)
	var newPoints int
	switch newRating {
	case domain.RatingGood:
		newPoints = activity.PointsPerRating.Good
	case domain.RatingAverage:
		newPoints = activity.PointsPerRating.Average
	case domain.RatingPoor:
		newPoints = activity.PointsPerRating.Poor
	default:
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Invalid rating")
	}

	// Track old values for audit
	oldRating := record.Rating
	oldPoints := record.Points

	// Create edit history entry
	editEntry := domain.EditRecord{
		ChangedBy: lecturer.WalletAddress,
		OldRating: oldRating,
		NewRating: newRating,
		OldPoints: oldPoints,
		NewPoints: newPoints,
		ChangedAt: time.Now(),
	}

	// Prepare updates
	updates := map[string]any{
		"rating":       newRating,
		"points":       newPoints,
		"note":         req.Note,
		"updated_at":   time.Now(),
		"edit_history": append(record.EditHistory, editEntry), // Append to history
	}

	// Update database
	if err := s.activityRecordRepo.Update(ctx, recordID, updates); err != nil {
		s.log.Error("Failed to update activity record", logger.Err(err))
		return nil, apperr.New(apperr.ErrCodeDatabase, "Failed to update record")
	}

	// Fetch updated record to return
	updated, err := s.activityRecordRepo.FindByID(ctx, recordID)
	if err != nil {
		return nil, apperr.New(apperr.ErrCodeDatabase, "Failed to fetch updated record")
	}

	return toEditActivityRecordResponse(updated, oldPoints), nil
}

// GetStudentRecords returns all activity records belonging to a student and enriches them with activity-title metadata.
// Batch title lookup avoids repeated repository round-trips when preparing the response list.
func (s *ActivityRecordService) GetStudentRecords(
	ctx context.Context,
	studentID string,
) ([]ActivityRecordResponse, error) {
	// Get student wallet address from user ID
	student, err := s.userRepo.FindByID(ctx, studentID)
	if err != nil {
		return nil, apperr.ErrNotFound
	}

	records, _, err := s.activityRecordRepo.FindByStudentAddress(ctx, student.WalletAddress)
	if err != nil {
		return nil, err
	}

	// Collect unique activity IDs for title lookup
	idsSet := make(map[string]struct{}, len(records))
	for _, r := range records {
		idsSet[r.ActivityID] = struct{}{}
	}
	ids := make([]string, 0, len(idsSet))
	for id := range idsSet {
		ids = append(ids, id)
	}

	// Batch-fetch activity titles
	titleMap := make(map[string]string, len(ids))
	if len(ids) > 0 {
		activities, fetchErr := s.activityRepo.FindByIDs(ctx, ids)
		if fetchErr == nil {
			for _, a := range activities {
				titleMap[a.ID] = a.Title
			}
		}
	}

	results := make([]ActivityRecordResponse, len(records))
	for i, record := range records {
		resp := toActivityRecordResponse(record)
		resp.ActivityTitle = titleMap[record.ActivityID]
		results[i] = *resp
	}

	return results, nil
}

// ListActivityRecords returns all participation records attached to one activity.
// It is the main lecturer-side read path for attendance and scoring review.
func (s *ActivityRecordService) ListActivityRecords(
	ctx context.Context,
	activityID string,
) ([]ActivityRecordResponse, int64, error) {
	records, total, err := s.activityRecordRepo.FindByActivityID(ctx, activityID)
	if err != nil {
		s.log.Error("Failed to list activity records", logger.Err(err))
		return nil, 0, apperr.New(apperr.ErrCodeDatabase, "Failed to list records")
	}

	results := make([]ActivityRecordResponse, len(records))
	for i, record := range records {
		results[i] = *toActivityRecordResponse(record)
	}
	return results, total, nil
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

// isValidEthereumAddress performs a lightweight syntactic validation of an Ethereum address string.
// It is intentionally cheaper than deeper chain-aware validation because these flows only need format sanity.
func isValidEthereumAddress(addr string) bool {
	// Basic Ethereum address validation (0x followed by 40 hex characters)
	if len(addr) != 42 || addr[:2] != "0x" {
		return false
	}
	for _, c := range addr[2:] {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

// normalizeClassCode canonicalizes class identifiers for case-insensitive comparisons in visibility checks.
func normalizeClassCode(v string) string {
	return strings.ToUpper(strings.TrimSpace(v))
}

// isClassAllowed reports whether a user class matches the activity's target-class restrictions.
// Empty target classes mean unrestricted access, while ALL bypasses class-specific filtering.
func isClassAllowed(targetClasses []string, userClass string) bool {
	if len(targetClasses) == 0 {
		return true
	}
	normUser := normalizeClassCode(userClass)
	if normUser == "ALL" {
		return true
	}
	for _, tc := range targetClasses {
		normTC := normalizeClassCode(tc)
		if normTC == "" {
			continue
		}
		if normTC == "ALL" || normTC == normUser {
			return true
		}
	}
	return false
}

// toActivityResponse converts the domain activity model into the API response DTO used by handlers.
// It also formats optional timestamps and quiz-question payloads into transport-friendly shapes.
func toActivityResponse(activity *domain.Activity) *ActivityResponse {
	var expiresAt *string
	if activity.ExpiresAt != nil {
		s := formatTimeUTC7(*activity.ExpiresAt)
		expiresAt = &s
	}
	var eventEndsAt *string
	if activity.EventEndsAt != nil {
		s := formatTimeUTC7(*activity.EventEndsAt)
		eventEndsAt = &s
	}

	quizQuestions := make([]QuizQuestionDTO, len(activity.QuizQuestions))
	for i, q := range activity.QuizQuestions {
		quizQuestions[i] = QuizQuestionDTO{
			ID:           q.ID,
			Question:     q.Question,
			Options:      q.Options,
			CorrectIndex: q.CorrectIndex,
		}
	}

	return &ActivityResponse{
		ID:           activity.ID,
		Title:        activity.Title,
		Description:  activity.Description,
		Cluster:      string(activity.Cluster),
		ActivityType: string(activity.ActivityType),
		PointsPerRating: PointsPerRatingDTO{
			Poor:    activity.PointsPerRating.Poor,
			Average: activity.PointsPerRating.Average,
			Good:    activity.PointsPerRating.Good,
		},
		CreatedBy:      activity.CreatedBy,
		Status:         string(activity.Status),
		MaxSlots:       activity.MaxSlots,
		ExpiresAt:      expiresAt,
		EventEndsAt:    eventEndsAt,
		MinTimeSeconds: activity.MinTimeSeconds,
		MinQuizScore:   activity.MinQuizScore,
		ContentURL:     activity.ContentURL,
		TargetClasses:  activity.TargetClasses,
		QuizQuestions:  quizQuestions,
		CreatedAt:      formatTimeUTC7(activity.CreatedAt),
		UpdatedAt:      formatTimeUTC7(activity.UpdatedAt),
	}
}

// toActivityRecordResponse converts an activity record into the standard response DTO and derives editability metadata.
// The derived time-remaining field saves clients from duplicating edit-window countdown logic.
func toActivityRecordResponse(record *domain.ActivityRecord) *ActivityRecordResponse {
	now := time.Now()
	canEdit := record.IsEditWindowOpen()
	timeRemaining := int64(record.EditDeadline.Sub(now).Seconds())
	if timeRemaining < 0 {
		timeRemaining = 0
	}

	return &ActivityRecordResponse{
		RecordID:        record.ID,
		ActivityID:      record.ActivityID,
		StudentAddress:  record.StudentAddress,
		LecturerAddress: record.LecturerAddress,
		Rating:          string(record.Rating),
		Points:          record.Points,
		Status:          string(record.Status),
		CanEdit:         canEdit,
		TimeRemaining:   timeRemaining,
		EditDeadline:    formatTimeUTC7(record.EditDeadline),
		CreatedAt:       formatTimeUTC7(record.CreatedAt),
		UpdatedAt:       formatTimeUTC7(record.UpdatedAt),
	}
}

// toEditActivityRecordResponse builds the richer response returned after an edit, including point delta and edit history.
// This response is intentionally more verbose than the base record response because edit UIs need before/after context.
func toEditActivityRecordResponse(record *domain.ActivityRecord, oldPoints int) *EditActivityRecordResponse {
	now := time.Now()
	canEdit := record.IsEditWindowOpen()
	timeRemaining := int64(record.EditDeadline.Sub(now).Seconds())
	if timeRemaining < 0 {
		timeRemaining = 0
	}

	editHistory := make([]EditHistoryDTO, len(record.EditHistory))
	for i, edit := range record.EditHistory {
		editHistory[i] = EditHistoryDTO{
			ChangedBy: edit.ChangedBy,
			OldRating: string(edit.OldRating),
			NewRating: string(edit.NewRating),
			OldPoints: edit.OldPoints,
			NewPoints: edit.NewPoints,
			ChangedAt: formatTimeUTC7(edit.ChangedAt),
		}
	}

	pointsDelta := record.Points - oldPoints

	return &EditActivityRecordResponse{
		RecordID:      record.ID,
		ActivityID:    record.ActivityID,
		Rating:        string(record.Rating),
		Points:        record.Points,
		OldPoints:     oldPoints,
		PointsDelta:   pointsDelta,
		Status:        string(record.Status),
		CanEdit:       canEdit,
		TimeRemaining: timeRemaining,
		EditDeadline:  formatTimeUTC7(record.EditDeadline),
		EditHistory:   editHistory,
		UpdatedAt:     formatTimeUTC7(record.UpdatedAt),
	}
}

// -----------------------------------------------------------------------------
// ActivityEnrollmentService - UC13: Enroll in ACTIVITY
// -----------------------------------------------------------------------------

// ActivityEnrollmentService manages registration, cancellation, evaluation, and reward side effects for ACTIVITY-cluster items.
// It bridges attendance workflows with later activity-record and reward creation.
type ActivityEnrollmentService struct {
	activityRepo       ports.ActivityRepository
	enrollmentRepo     ports.ActivityEnrollmentRepository
	activityRecordRepo ports.ActivityRecordRepository
	rewardPendingRepo  ports.RewardRepository
	userRepo           ports.UserRepository
	rewardRate         *big.Int
	log                logger.Logger
}

// NewActivityEnrollmentService constructs the enrollment service and normalizes the reward conversion rate.
// The combined dependencies let enrollment evaluation create both record and reward artifacts in one workflow.
func NewActivityEnrollmentService(
	activityRepo ports.ActivityRepository,
	enrollmentRepo ports.ActivityEnrollmentRepository,
	activityRecordRepo ports.ActivityRecordRepository,
	rewardPendingRepo ports.RewardRepository,
	userRepo ports.UserRepository,
	rewardRateWeiPerPoint *big.Int,
	log logger.Logger,
) *ActivityEnrollmentService {
	if rewardRateWeiPerPoint == nil || rewardRateWeiPerPoint.Sign() <= 0 {
		rewardRateWeiPerPoint = big.NewInt(1)
	}
	return &ActivityEnrollmentService{
		activityRepo:       activityRepo,
		enrollmentRepo:     enrollmentRepo,
		activityRecordRepo: activityRecordRepo,
		rewardPendingRepo:  rewardPendingRepo,
		userRepo:           userRepo,
		rewardRate:         new(big.Int).Set(rewardRateWeiPerPoint),
		log:                log.Named("enrollment_service"),
	}
}

// Enroll registers a student for an ACTIVITY-cluster activity after validating class eligibility, deadlines, and slot capacity.
// Previously cancelled enrollments are revived instead of duplicated so enrollment history stays normalized.
func (s *ActivityEnrollmentService) Enroll(ctx context.Context, studentID, activityID string) (*EnrollmentResponse, error) {
	student, err := s.userRepo.FindByID(ctx, studentID)
	if err != nil || student == nil {
		return nil, apperr.ErrNotFound
	}

	activity, err := s.activityRepo.FindByID(ctx, activityID)
	if err != nil || activity == nil {
		return nil, apperr.ErrNotFound
	}

	if activity.Cluster != domain.ActivityClusterActivity {
		return nil, apperr.New("WRONG_CLUSTER", "Chá»‰ cÃ³ thá»ƒ Ä‘Äƒng kÃ½ hoáº¡t Ä‘á»™ng ngoáº¡i khÃ³a")
	}
	if activity.ExpiresAt != nil && time.Now().After(*activity.ExpiresAt) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ÄÃ£ háº¿t háº¡n Ä‘Äƒng kÃ½ hoáº¡t Ä‘á»™ng")
	}
	if len(activity.TargetClasses) > 0 && !isClassAllowed(activity.TargetClasses, student.Class) {
		return nil, apperr.New(apperr.ErrCodeForbidden, "Báº¡n khÃ´ng thuá»™c lá»›p Ä‘Æ°á»£c phÃ©p tham gia hoáº¡t Ä‘á»™ng nÃ y")
	}

	// Check already enrolled
	existing, err := s.enrollmentRepo.FindByActivityAndStudent(ctx, activityID, student.WalletAddress)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		if existing.Status == domain.EnrollmentStatusCancelled {
			now := time.Now()
			if err := s.enrollmentRepo.Update(ctx, existing.ID, map[string]any{
				"status":      domain.EnrollmentStatusRegistered,
				"enrolled_at": now,
				"updated_at":  now,
			}); err != nil {
				return nil, err
			}
			return &EnrollmentResponse{
				ID:             existing.ID,
				ActivityID:     existing.ActivityID,
				StudentAddress: existing.StudentAddress,
				Status:         string(domain.EnrollmentStatusRegistered),
				EnrolledAt:     formatTimeUTC7(now),
				UpdatedAt:      formatTimeUTC7(now),
			}, nil
		}
		return &EnrollmentResponse{
			ID:             existing.ID,
			ActivityID:     existing.ActivityID,
			StudentAddress: existing.StudentAddress,
			Status:         string(existing.Status),
			EnrolledAt:     formatTimeUTC7(existing.EnrolledAt),
			UpdatedAt:      formatTimeUTC7(existing.UpdatedAt),
		}, nil
	}
	// Check max_slots limit
	if activity.MaxSlots != nil && *activity.MaxSlots > 0 {
		enrollments, _, err := s.enrollmentRepo.FindByActivityID(ctx, activityID)
		if err != nil {
			return nil, err
		}
		var count int64
		for _, e := range enrollments {
			if e.Status == domain.EnrollmentStatusRegistered {
				count++
			}
		}
		if count >= *activity.MaxSlots {
			return nil, apperr.New(apperr.ErrCodeBadRequest, "Hoáº¡t Ä'á»™ng Ä'Ã£ Ä'á»§ sá»' lÆ°á»£ng Ä'Äƒng kÃ½ tá»'i Ä'a")
		}
	}
	now := time.Now()
	enrollment := &domain.ActivityEnrollment{
		BaseEntity:     domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now},
		ActivityID:     activityID,
		StudentAddress: student.WalletAddress,
		Status:         domain.EnrollmentStatusRegistered,
		EnrolledAt:     now,
		UpdatedAt:      now,
	}

	if err := s.enrollmentRepo.Create(ctx, enrollment); err != nil {
		return nil, err
	}

	return &EnrollmentResponse{
		ID:             enrollment.ID,
		ActivityID:     enrollment.ActivityID,
		StudentAddress: enrollment.StudentAddress,
		Status:         string(enrollment.Status),
		EnrolledAt:     formatTimeUTC7(enrollment.EnrolledAt),
		UpdatedAt:      formatTimeUTC7(enrollment.UpdatedAt),
	}, nil
}

// CancelEnrollment allows a student to withdraw from an activity before the registration window closes.
// Once attendance has already been evaluated, cancellation is intentionally blocked to preserve academic integrity.
func (s *ActivityEnrollmentService) CancelEnrollment(ctx context.Context, studentID, activityID string) (*EnrollmentResponse, error) {
	student, err := s.userRepo.FindByID(ctx, studentID)
	if err != nil || student == nil {
		return nil, apperr.ErrNotFound
	}

	activity, err := s.activityRepo.FindByID(ctx, activityID)
	if err != nil || activity == nil {
		return nil, apperr.ErrNotFound
	}
	if activity.Cluster != domain.ActivityClusterActivity {
		return nil, apperr.New("WRONG_CLUSTER", "Chá»‰ cÃ³ thá»ƒ há»§y Ä‘Äƒng kÃ½ hoáº¡t Ä‘á»™ng ngoáº¡i khÃ³a")
	}
	if activity.ExpiresAt != nil && time.Now().After(*activity.ExpiresAt) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ÄÃ£ háº¿t háº¡n Ä‘Äƒng kÃ½, khÃ´ng thá»ƒ há»§y")
	}

	enrollment, err := s.enrollmentRepo.FindByActivityAndStudent(ctx, activityID, student.WalletAddress)
	if err != nil || enrollment == nil {
		return nil, apperr.New(apperr.ErrCodeNotFound, "KhÃ´ng tÃ¬m tháº¥y Ä‘Äƒng kÃ½")
	}
	if enrollment.Status == domain.EnrollmentStatusAttended || enrollment.Status == domain.EnrollmentStatusAbsent {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "ÄÃ£ Ä‘Æ°á»£c admin ghi nháº­n, khÃ´ng thá»ƒ há»§y Ä‘Äƒng kÃ½")
	}

	now := time.Now()
	if err := s.enrollmentRepo.Update(ctx, enrollment.ID, map[string]any{
		"status":     domain.EnrollmentStatusCancelled,
		"updated_at": now,
	}); err != nil {
		return nil, err
	}

	return &EnrollmentResponse{
		ID:             enrollment.ID,
		ActivityID:     enrollment.ActivityID,
		StudentAddress: enrollment.StudentAddress,
		Status:         string(domain.EnrollmentStatusCancelled),
		EnrolledAt:     formatTimeUTC7(enrollment.EnrolledAt),
		UpdatedAt:      formatTimeUTC7(now),
	}, nil
}

// GetMyEnrollments returns all ACTIVITY enrollments belonging to one student.
// This is the self-service read path for viewing upcoming or past extracurricular participation.
func (s *ActivityEnrollmentService) GetMyEnrollments(ctx context.Context, studentID string) ([]EnrollmentResponse, int64, error) {
	student, err := s.userRepo.FindByID(ctx, studentID)
	if err != nil || student == nil {
		return nil, 0, apperr.ErrNotFound
	}

	enrollments, total, err := s.enrollmentRepo.FindByStudentAddress(ctx, student.WalletAddress)
	if err != nil {
		return nil, 0, err
	}

	results := make([]EnrollmentResponse, len(enrollments))
	for i, e := range enrollments {
		results[i] = EnrollmentResponse{
			ID:             e.ID,
			ActivityID:     e.ActivityID,
			StudentAddress: e.StudentAddress,
			Status:         string(e.Status),
			EnrolledAt:     formatTimeUTC7(e.EnrolledAt),
			UpdatedAt:      formatTimeUTC7(e.UpdatedAt),
		}
	}
	return results, total, nil
}

// GetActivityEnrollments returns every enrollment attached to one activity for operator-side review.
// It is used by administrative and lecturer workflows before evaluation is applied.
func (s *ActivityEnrollmentService) GetActivityEnrollments(ctx context.Context, activityID string) ([]EnrollmentResponse, int64, error) {
	enrollments, total, err := s.enrollmentRepo.FindByActivityID(ctx, activityID)
	if err != nil {
		return nil, 0, err
	}

	results := make([]EnrollmentResponse, len(enrollments))
	for i, e := range enrollments {
		results[i] = EnrollmentResponse{
			ID:             e.ID,
			ActivityID:     e.ActivityID,
			StudentAddress: e.StudentAddress,
			Status:         string(e.Status),
			EnrolledAt:     formatTimeUTC7(e.EnrolledAt),
			UpdatedAt:      formatTimeUTC7(e.UpdatedAt),
		}
	}
	return results, total, nil
}

// EvaluateEnrollment records the attendance outcome of an enrollment and creates the corresponding activity record.
// Successful evaluation can also enqueue a reward and increment the student's activity-points total.
func (s *ActivityEnrollmentService) EvaluateEnrollment(ctx context.Context, adminID, enrollmentID, rating string) (*ActivityRecordResponse, error) {
	admin, err := s.userRepo.FindByID(ctx, adminID)
	if err != nil || admin == nil {
		return nil, apperr.ErrNotFound
	}

	enrollment, err := s.enrollmentRepo.FindByID(ctx, enrollmentID)
	if err != nil || enrollment == nil {
		return nil, apperr.ErrNotFound
	}

	activity, err := s.activityRepo.FindByID(ctx, enrollment.ActivityID)
	if err != nil || activity == nil {
		return nil, apperr.ErrNotFound
	}

	if activity.EventEndsAt == nil || time.Now().Before(*activity.EventEndsAt) {
		return nil, apperr.New(apperr.ErrCodeBadRequest, "Chá»‰ cÃ³ thá»ƒ ghi nháº­n sau khi sá»± kiá»‡n káº¿t thÃºc")
	}

	// Prevent duplicate evaluation/reward for the same student in one activity.
	existingRecord, _ := s.activityRecordRepo.FindByActivityAndStudent(ctx, enrollment.ActivityID, enrollment.StudentAddress)
	if existingRecord != nil {
		return nil, apperr.New(apperr.ErrCodeConflict, "Record already exists for this student in this activity")
	}

	// Determine points by rating
	var points int
	switch domain.Rating(rating) {
	case domain.RatingGood:
		points = activity.PointsPerRating.Good
	case domain.RatingAverage:
		points = activity.PointsPerRating.Average
	default:
		points = activity.PointsPerRating.Poor
	}

	now := time.Now()
	editDeadline := now.Add(24 * time.Hour)
	record := &domain.ActivityRecord{
		BaseEntity:      domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now},
		ActivityID:      enrollment.ActivityID,
		StudentAddress:  enrollment.StudentAddress,
		LecturerAddress: admin.WalletAddress,
		Rating:          domain.Rating(rating),
		Points:          points,
		Status:          domain.ActivityRecordStatusPending,
		EditDeadline:    editDeadline,
		UpdatedAt:       now,
	}

	if err := s.activityRecordRepo.Create(ctx, record); err != nil {
		return nil, err
	}

	if err := s.createPendingReward(ctx, record, enrollment.StudentAddress, points, enrollment.ActivityID, "Activity enrollment evaluation reward"); err != nil {
		s.log.Error("failed to queue pending reward for evaluated enrollment",
			logger.String("record_id", record.ID),
			logger.String("wallet", enrollment.StudentAddress),
			logger.Err(err),
		)
	}

	// Update enrollment status
	status := domain.EnrollmentStatusAttended
	if rating == string(domain.RatingPoor) {
		status = domain.EnrollmentStatusAbsent
	}
	_ = s.enrollmentRepo.Update(ctx, enrollmentID, map[string]any{"status": status})

	// Increment activity_points on the student's profile.
	if incErr := s.userRepo.IncrementActivityPoints(ctx, enrollment.StudentAddress, int64(points)); incErr != nil {
		s.log.Error("failed to increment activity_points after evaluation",
			logger.String("wallet", enrollment.StudentAddress),
			logger.Err(incErr),
		)
	}

	return &ActivityRecordResponse{
		RecordID:        record.ID,
		ActivityID:      record.ActivityID,
		StudentAddress:  record.StudentAddress,
		LecturerAddress: record.LecturerAddress,
		Rating:          string(record.Rating),
		Points:          record.Points,
		Status:          string(record.Status),
		CanEdit:         false,
		TimeRemaining:   0,
		EditDeadline:    formatTimeUTC7(editDeadline),
		CreatedAt:       formatTimeUTC7(record.CreatedAt),
		UpdatedAt:       formatTimeUTC7(record.UpdatedAt),
	}, nil
}

// createPendingReward queues a reward resulting from enrollment evaluation.
// It mirrors the same reward-enqueue semantics used by other activity-completion paths.
func (s *ActivityEnrollmentService) createPendingReward(
	ctx context.Context,
	record *domain.ActivityRecord,
	studentWallet string,
	points int,
	activityID string,
	description string,
) error {
	if s.rewardPendingRepo == nil || points <= 0 {
		return nil
	}

	addr := common.HexToAddress(studentWallet)
	if addr == (common.Address{}) {
		return apperr.New(apperr.ErrCodeBadRequest, "Invalid student address format")
	}

	rewardAmountWei := new(big.Int).Mul(big.NewInt(int64(points)), s.rewardRate)
	recordID := record.ID
	contextID := activityID
	now := time.Now()

	reward := &domain.RewardPending{
		BaseEntity:       domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		StudentWallet:    addr.Hex(),
		RewardAmount:     rewardAmountWei.String(),
		RewardPoints:     points,
		RewardSource:     domain.RewardSourceActivityCompletion,
		Status:           domain.RewardStatusPending,
		ActivityRecordID: &recordID,
		ContextID:        &contextID,
		Description:      description,
		RetryCount:       0,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := s.rewardPendingRepo.Create(ctx, reward); err != nil {
		return err
	}

	s.log.Info("queued pending reward from enrollment evaluation",
		logger.String("reward_id", reward.ID),
		logger.String("record_id", recordID),
		logger.String("wallet", reward.StudentWallet),
		logger.Int("points", points),
		logger.String("amount_wei", reward.RewardAmount),
	)

	return nil
}

// -----------------------------------------------------------------------------
// LearningSubmissionService - UC14: Submit LEARNING
// -----------------------------------------------------------------------------

// LearningSubmissionService processes completion submissions for LEARNING-cluster activities.
// It turns time-spent and quiz inputs into records, submission rows, rewards, and activity-point updates.
type LearningSubmissionService struct {
	activityRepo       ports.ActivityRepository
	activityRecordRepo ports.ActivityRecordRepository
	submissionRepo     ports.LearningSubmissionRepository
	rewardPendingRepo  ports.RewardRepository
	userRepo           ports.UserRepository
	rewardRate         *big.Int
	log                logger.Logger
}

// NewLearningSubmissionService constructs the LEARNING-cluster submission service and normalizes the reward conversion rate.
// It depends on both submission storage and record storage because completion creates multiple linked artifacts.
func NewLearningSubmissionService(
	activityRepo ports.ActivityRepository,
	activityRecordRepo ports.ActivityRecordRepository,
	submissionRepo ports.LearningSubmissionRepository,
	rewardPendingRepo ports.RewardRepository,
	userRepo ports.UserRepository,
	rewardRateWeiPerPoint *big.Int,
	log logger.Logger,
) *LearningSubmissionService {
	if rewardRateWeiPerPoint == nil || rewardRateWeiPerPoint.Sign() <= 0 {
		rewardRateWeiPerPoint = big.NewInt(1)
	}
	return &LearningSubmissionService{
		activityRepo:       activityRepo,
		activityRecordRepo: activityRecordRepo,
		submissionRepo:     submissionRepo,
		rewardPendingRepo:  rewardPendingRepo,
		userRepo:           userRepo,
		rewardRate:         new(big.Int).Set(rewardRateWeiPerPoint),
		log:                log.Named("learning_submission_service"),
	}
}

// SubmitLearning processes a student's completion evidence for a LEARNING-cluster activity.
// It validates eligibility, computes quiz outcomes and rating, creates the record/submission pair, and queues the reward.
func (s *LearningSubmissionService) SubmitLearning(ctx context.Context, studentID, activityID string, req *SubmitLearningRequest) (*SubmitLearningResponse, error) {
	student, err := s.userRepo.FindByID(ctx, studentID)
	if err != nil || student == nil {
		return nil, apperr.ErrNotFound
	}

	activity, err := s.activityRepo.FindByID(ctx, activityID)
	if err != nil || activity == nil {
		return nil, apperr.ErrNotFound
	}

	if activity.Cluster != domain.ActivityClusterLearning {
		return nil, apperr.New("WRONG_CLUSTER", "Chá»‰ cÃ³ thá»ƒ ná»™p bÃ i cho hoáº¡t Ä‘á»™ng há»c táº­p")
	}
	if len(activity.TargetClasses) > 0 && !isClassAllowed(activity.TargetClasses, student.Class) {
		return nil, apperr.New(apperr.ErrCodeForbidden, "Báº¡n khÃ´ng thuá»™c lá»›p Ä‘Æ°á»£c phÃ©p tham gia hoáº¡t Ä‘á»™ng nÃ y")
	}

	// Check minimum time requirement
	if activity.MinTimeSeconds != nil && req.TimeSpentSeconds < *activity.MinTimeSeconds {
		return nil, apperr.New("INSUFFICIENT_TIME", "ChÆ°a Ä‘á»§ thá»i gian há»c táº­p yÃªu cáº§u")
	}

	// Check if already submitted
	existing, err := s.submissionRepo.FindByActivityAndStudent(ctx, activityID, student.WalletAddress)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, apperr.New("ALREADY_SUBMITTED", "Báº¡n Ä‘Ã£ ná»™p bÃ i cho hoáº¡t Ä‘á»™ng nÃ y rá»“i")
	}

	// Calculate quiz score if there are quiz questions
	var quizScore *int
	var quizPassed *bool
	rating := domain.RatingGood // default if no quiz

	if len(activity.QuizQuestions) > 0 {
		correct := 0
		for _, answer := range req.QuizAnswers {
			for _, q := range activity.QuizQuestions {
				if q.ID == answer.QuestionID && q.CorrectIndex == answer.AnswerIndex {
					correct++
					break
				}
			}
		}
		score := int(float64(correct) / float64(len(activity.QuizQuestions)) * 100)
		quizScore = &score

		minScore := 0
		if activity.MinQuizScore != nil {
			minScore = *activity.MinQuizScore
		}

		passed := score >= minScore
		quizPassed = &passed

		switch {
		case score >= minScore+20:
			rating = domain.RatingGood
		case score >= minScore:
			rating = domain.RatingAverage
		default:
			rating = domain.RatingPoor
		}
	}

	// Determine points
	var points int
	switch rating {
	case domain.RatingGood:
		points = activity.PointsPerRating.Good
	case domain.RatingAverage:
		points = activity.PointsPerRating.Average
	default:
		points = activity.PointsPerRating.Poor
	}

	now := time.Now()
	// Keep LEARNING submit records non-confirmed until reward transfer is settled on-chain.
	// Use a far-future deadline so auto-lock worker does not confirm it before settlement.
	editDeadline := now.AddDate(100, 0, 0)

	// Create activity record
	record := &domain.ActivityRecord{
		BaseEntity:      domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now},
		ActivityID:      activityID,
		StudentAddress:  student.WalletAddress,
		LecturerAddress: "SYSTEM",
		Rating:          rating,
		Points:          points,
		Status:          domain.ActivityRecordStatusPending,
		EditDeadline:    editDeadline,
		UpdatedAt:       now,
	}
	if err := s.activityRecordRepo.Create(ctx, record); err != nil {
		return nil, err
	}

	// Create learning submission
	submission := &domain.LearningSubmission{
		BaseEntity:       domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now},
		ActivityID:       activityID,
		StudentAddress:   student.WalletAddress,
		TimeSpentSeconds: req.TimeSpentSeconds,
		QuizScore:        quizScore,
		QuizPassed:       quizPassed,
		Rating:           rating,
		Points:           points,
		ActivityRecordID: record.ID,
		CompletedAt:      now,
	}
	if err := s.submissionRepo.Create(ctx, submission); err != nil {
		return nil, err
	}

	// Queue token reward for worker-based on-chain settlement.
	rewardAmountWei := new(big.Int).Mul(big.NewInt(int64(points)), s.rewardRate)
	contextID := activityID
	activityRecordID := record.ID
	reward := &domain.RewardPending{
		BaseEntity:       domain.BaseEntity{ID: uuid.NewString(), CreatedAt: now, UpdatedAt: now},
		StudentWallet:    student.WalletAddress,
		RewardAmount:     rewardAmountWei.String(),
		RewardPoints:     points,
		RewardSource:     domain.RewardSourceActivityCompletion,
		Status:           domain.RewardStatusPending,
		ActivityRecordID: &activityRecordID,
		ContextID:        &contextID,
		Description:      "Learning completion reward",
		RetryCount:       0,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if err := s.rewardPendingRepo.Create(ctx, reward); err != nil {
		s.log.Error("failed to create pending reward", logger.String("record_id", record.ID), logger.Err(err))
	}

	// Increment activity_points on the student's profile immediately.
	// Use $inc for atomicity; log the error but don't fail the response.
	if incErr := s.userRepo.IncrementActivityPoints(ctx, student.WalletAddress, int64(points)); incErr != nil {
		s.log.Error("failed to increment activity_points",
			logger.String("wallet", student.WalletAddress),
			logger.Err(incErr),
		)
	}

	// Reload student to get updated activity_points total.
	updatedStudent, reloadErr := s.userRepo.FindByWallet(ctx, student.WalletAddress)
	updatedTotal := student.ActivityPoints + int64(points)
	if reloadErr == nil && updatedStudent != nil {
		updatedTotal = updatedStudent.ActivityPoints
	}

	msg := "Hoàn thành học tập! Đánh giá: " + string(rating)
	return &SubmitLearningResponse{
		RecordID:       record.ID,
		ActivityID:     activityID,
		Rating:         string(rating),
		Points:         points,
		QuizScore:      quizScore,
		QuizPassed:     quizPassed,
		Message:        msg,
		ActivityPoints: updatedTotal,
	}, nil
}

// GetMySubmissions returns all recorded learning submissions for one student.
// This is the read path behind self-service learning-history views.
func (s *LearningSubmissionService) GetMySubmissions(ctx context.Context, studentID string) ([]*domain.LearningSubmission, int64, error) {
	student, err := s.userRepo.FindByID(ctx, studentID)
	if err != nil || student == nil {
		return nil, 0, apperr.ErrNotFound
	}
	return s.submissionRepo.FindByStudentAddress(ctx, student.WalletAddress)
}

// -----------------------------------------------------------------------------
// RankingService - Activity-points leaderboard
// -----------------------------------------------------------------------------

// GetRanking returns ranked users ordered by accumulated activity points.
// Pagination is applied server-side so leaderboard UIs can request slices without downloading the entire ranking.
func (s *ActivityService) GetRanking(ctx context.Context, page, limit int64) (*RankingResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	users, total, err := s.userRepo.FindRanked(ctx, page, limit)
	if err != nil {
		s.log.Error("failed to fetch ranking", logger.Err(err))
		return nil, apperr.New(apperr.ErrCodeDatabase, "Failed to fetch ranking")
	}

	entries := make([]RankEntry, len(users))
	for i, u := range users {
		rank := int((page-1)*limit) + i + 1
		entries[i] = RankEntry{
			Rank:           rank,
			StudentWallet:  u.WalletAddress,
			StudentName:    u.FullName,
			AvatarURI:      u.AvatarURI,
			Class:          u.Class,
			ActivityPoints: u.ActivityPoints,
		}
	}

	totalPages := (total + limit - 1) / limit
	return &RankingResponse{
		Entries:    entries,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}
