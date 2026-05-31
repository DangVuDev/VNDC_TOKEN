package task

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/vndc/backend/internal/ports"
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
	"github.com/vndc/backend/pkg/logger"
)

// ActivityHandler handles activity-related HTTP endpoints spanning activity templates, records, enrollment, learning submissions, and ranking.
// It coordinates several activity-focused services behind one transport surface.
type ActivityHandler struct {
	activitySvc       *ActivityService
	activityRecordSvc *ActivityRecordService
	enrollmentSvc     *ActivityEnrollmentService
	learningSubmitSvc *LearningSubmissionService
	log               logger.Logger
}

// NewActivityHandler constructs the activity HTTP handler with all activity-domain service collaborators wired in.
func NewActivityHandler(
	activitySvc *ActivityService,
	activityRecordSvc *ActivityRecordService,
	enrollmentSvc *ActivityEnrollmentService,
	learningSubmitSvc *LearningSubmissionService,
	log logger.Logger,
) *ActivityHandler {
	return &ActivityHandler{
		activitySvc:       activitySvc,
		activityRecordSvc: activityRecordSvc,
		enrollmentSvc:     enrollmentSvc,
		learningSubmitSvc: learningSubmitSvc,
		log:               log.Named("activity_handler"),
	}
}

// RegisterActivityRoutes registers all activity-related routes behind JWT authentication.
// Static paths are deliberately placed before wildcard paths to avoid Gin route-shadowing issues.
func (h *ActivityHandler) RegisterActivityRoutes(r *gin.RouterGroup, jwtSecret string, userRepo ports.UserRepository) {
	activities := r.Group("/activities")
	activities.Use(middleware.AuthWithBlacklist(jwtSecret, nil))
	{
		// Static paths MUST be registered before wildcard /:activityId

		// UC10: Create Activity (Lecturer/Admin only)
		activities.POST("", h.CreateActivity)

		// List activities
		activities.GET("", h.ListActivities)

		// View my activities (Student) â€” static path, must come before /:activityId
		activities.GET("/my-records", h.GetMyActivityRecords)

		// UC13: My enrollments (Student)
		activities.GET("/my-enrollments", h.GetMyEnrollments)
		// Activity-points leaderboard
		activities.GET("/ranking", h.GetRanking)
		// View single activity
		activities.GET("/:activityId", h.GetActivity)

		// UC11: Record Activity (Lecturer/Admin only)
		activities.POST("/:activityId/record", h.RecordActivity)

		// UC12: Edit Activity Record (Lecturer/Admin only, within 24h)
		activities.PATCH("/:activityId/record/:recordId", h.EditActivityRecord)

		// View records for an activity (Lecturer dashboard)
		activities.GET("/:activityId/records", h.ListActivityRecords)

		// UC13: Enroll in ACTIVITY cluster event
		activities.POST("/:activityId/enroll", h.EnrollActivity)
		activities.POST("/:activityId/cancel-enroll", h.CancelEnrollment)

		// UC13: Admin view enrollments for an activity
		activities.GET("/:activityId/enrollments", h.GetActivityEnrollments)

		// UC13: Admin evaluate enrollment
		activities.POST("/:activityId/enrollments/:enrollmentId/evaluate", h.EvaluateEnrollment)

		// UC14: Submit LEARNING cluster completion
		activities.POST("/:activityId/submit-learning", h.SubmitLearning)
	}
}

// CreateActivity handles creation of a new activity template, typically by lecturer or admin actors.
// The handler extracts the authenticated user ID and passes it into the activity service for authorization-aware creation.
// CreateActivity godoc
//
//	@Summary      Create activity (UC10)
//	@Description  Creates a new activity template. Requires LECTURER or ADMIN role.
//	@Tags         Activities
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        body  body      CreateActivityRequest  true  "Activity definition"
//	@Success      201   {object}  ActivityResponse            "Activity created"
//	@Failure      400   {object}  models.ErrorResponse        "Validation error"
//	@Failure      401   {object}  models.ErrorResponse        "Missing or invalid Bearer token"
//	@Failure      403   {object}  models.ErrorResponse        "Insufficient permissions (must be LECTURER or ADMIN)"
//	@Failure      500   {object}  models.ErrorResponse        "Internal server error"
//	@Router       /activities [post]
func (h *ActivityHandler) CreateActivity(c *gin.Context) {
	// Extract user from JWT middleware
	userID := middleware.UserID(c)

	// Bind request
	req, ok := apihttp.Bind[CreateActivityRequest](c)
	if !ok {
		return
	}

	// Call service
	activity, err := h.activitySvc.CreateActivity(c.Request.Context(), userID, req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}

	apihttp.Created(c, activity)
}

// GetActivity handles lookup of one activity by ID.
// It is the detail endpoint used by activity pages and enrollment decisions.
// GetActivity retrieves a single activity by ID
//
//	@Summary      Get activity
//	@Tags         Activities
//	@Produce      json
//	@Security     BearerAuth
//	@Param        activityId  path      string  true  "Activity ID"
//	@Success      200         {object}  ActivityResponse
//	@Failure      404         {object}  models.ErrorResponse  "Activity not found"
//	@Router       /activities/{activityId} [get]
func (h *ActivityHandler) GetActivity(c *gin.Context) {
	activityID := c.Param("activityId")
	activity, err := h.activitySvc.GetActivity(c.Request.Context(), activityID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, activity)
}

// ListActivities handles retrieval of visible activities for the current caller.
// It derives class-based visibility from the authenticated user and expands access for privileged roles.
// ListActivities lists all active activities
//
//	@Summary      List activities
//	@Tags         Activities
//	@Produce      json
//	@Security     BearerAuth
//	@Param        page       query  int  false  "Page number (default 1)"
//	@Param        limit      query  int  false  "Limit per page (default 10, max 100)"
//	@Param        cluster    query  string  false  "Filter by cluster: LEARNING or ACTIVITY"
//	@Param        status     query  string  false  "Filter by status: ACTIVE, ARCHIVED, DRAFT"
//	@Success      200        {object}  map[string]any
//	@Router       /activities [get]
func (h *ActivityHandler) ListActivities(c *gin.Context) {
	// Look up calling user's class to enable per-class visibility filtering.
	userID := middleware.UserID(c)
	userClass := ""
	if userID != "" {
		if user, err := h.activitySvc.userRepo.FindByID(c.Request.Context(), userID); err == nil && user != nil {
			isPrivileged := false
			for _, role := range user.Roles {
				if role == "ADMIN" || role == "LECTURER" {
					isPrivileged = true
					break
				}
			}
			if isPrivileged {
				userClass = "ALL"
			} else {
				userClass = user.Class
			}
		}
	}

	activities, total, err := h.activitySvc.ListActivities(c.Request.Context(), userClass)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	c.JSON(200, gin.H{
		"activities": activities,
		"total":      total,
	})
}

// RecordActivity handles lecturer or admin creation of an activity participation record for a student.
// The authenticated actor ID is forwarded so the service can enforce role-based recording policy.
// RecordActivity godoc (UC11)
//
//	@Summary      Record student activity
//	@Description  Records a student's participation in an activity. Requires LECTURER or ADMIN role.
//	@Tags         Activities
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        activityId  path      string                        true  "Activity ID"
//	@Param        body        body      RecordActivityRequest         true  "Record details"
//	@Success      201         {object}  ActivityRecordResponse            "Record created"
//	@Failure      400         {object}  models.ErrorResponse              "Validation error"
//	@Failure      404         {object}  models.ErrorResponse              "Activity or Student not found"
//	@Failure      409         {object}  models.ErrorResponse              "Duplicate record for this student"
//	@Router       /activities/{activityId}/record [post]
func (h *ActivityHandler) RecordActivity(c *gin.Context) {
	lecturerID := middleware.UserID(c)
	activityID := c.Param("activityId")

	req, ok := apihttp.Bind[RecordActivityRequest](c)
	if !ok {
		return
	}

	record, err := h.activityRecordSvc.RecordActivity(c.Request.Context(), lecturerID, activityID, req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}

	apihttp.Created(c, record)
}

// EditActivityRecord handles time-bounded correction of an existing activity record.
// Validation of the 24-hour edit window and point changes stays centralized in the service layer.
// EditActivityRecord godoc (UC12)
//
//	@Summary      Edit activity record
//	@Description  Edits a previously recorded activity within 24-hour window.
//	@Tags         Activities
//	@Accept       json
//	@Produce      json
//	@Security     BearerAuth
//	@Param        activityId  path      string                      true  "Activity ID"
//	@Param        recordId    path      string                      true  "Record ID"
//	@Param        body        body      EditActivityRecordRequest   true  "Updated record details"
//	@Success      200         {object}  EditActivityRecordResponse      "Record updated"
//	@Failure      400         {object}  models.ErrorResponse            "Validation error"
//	@Failure      404         {object}  models.ErrorResponse            "Record not found"
//	@Failure      410         {object}  models.ErrorResponse            "Edit window closed"
//	@Router       /activities/{activityId}/record/{recordId} [patch]
func (h *ActivityHandler) EditActivityRecord(c *gin.Context) {
	lecturerID := middleware.UserID(c)
	activityID := c.Param("activityId")
	recordID := c.Param("recordId")

	req, ok := apihttp.Bind[EditActivityRecordRequest](c)
	if !ok {
		return
	}

	resp, err := h.activityRecordSvc.EditActivityRecord(c.Request.Context(), lecturerID, activityID, recordID, req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}

	apihttp.OK(c, resp)
}

// ListActivityRecords handles lecturer- or admin-facing retrieval of all records tied to one activity.
// It powers dashboard views for attendance, evaluation, and point allocation.
// ListActivityRecords lists records for an activity (lecturer dashboard)
//
//	@Summary      List activity records
//	@Description  Lists all student records for a specific activity.
//	@Tags         Activities
//	@Produce      json
//	@Security     BearerAuth
//	@Param        activityId  path   string  true  "Activity ID"
//	@Param        page        query  int     false  "Page number"
//	@Param        limit       query  int     false  "Limit per page"
//	@Param        status      query  string  false  "Filter: PENDING, CONFIRMED, LOCKED"
//	@Success      200         {object}  map[string]any
//	@Router       /activities/{activityId}/records [get]
func (h *ActivityHandler) ListActivityRecords(c *gin.Context) {
	activityID := c.Param("activityId")
	records, total, err := h.activityRecordSvc.ListActivityRecords(c.Request.Context(), activityID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	c.JSON(200, gin.H{
		"records": records,
		"total":   total,
	})
}

// GetMyActivityRecords handles retrieval of the authenticated student's own activity history.
// This route is scoped entirely by the session user ID rather than any path or query identity input.
// GetMyActivityRecords lists student's own activity records
//
//	@Summary      Get my activity records
//	@Description  Returns all activity records for the authenticated student.
//	@Tags         Activities
//	@Produce      json
//	@Security     BearerAuth
//	@Param        page        query  int     false  "Page number"
//	@Param        limit       query  int     false  "Limit per page"
//	@Success      200         {object}  map[string]any
//	@Router       /activities/my-records [get]
func (h *ActivityHandler) GetMyActivityRecords(c *gin.Context) {
	studentID := middleware.UserID(c)
	records, err := h.activityRecordSvc.GetStudentRecords(c.Request.Context(), studentID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}

	c.JSON(200, gin.H{
		"records": records,
		"total":   len(records),
	})
}

// ─────────────────────────────────────────────
//  UC13: Enrollment (ACTIVITY cluster)
// ─────────────────────────────────────────────

// EnrollActivity handles the student enrollment action for an activity-cluster event.
// The service determines capacity and enrollment eligibility rules.
// EnrollActivity handles POST /activities/:activityId/enroll
func (h *ActivityHandler) EnrollActivity(c *gin.Context) {
	userID := middleware.UserID(c)
	activityID := c.Param("activityId")

	resp, err := h.enrollmentSvc.Enroll(c.Request.Context(), userID, activityID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// CancelEnrollment handles student cancellation of an existing enrollment.
// It is the inverse transport endpoint to EnrollActivity.
// CancelEnrollment handles POST /activities/:activityId/cancel-enroll
func (h *ActivityHandler) CancelEnrollment(c *gin.Context) {
	userID := middleware.UserID(c)
	activityID := c.Param("activityId")

	resp, err := h.enrollmentSvc.CancelEnrollment(c.Request.Context(), userID, activityID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// GetMyEnrollments handles retrieval of the current student's own enrollment list.
// The handler remains thin and returns a simple list-plus-total payload.
// GetMyEnrollments handles GET /activities/my-enrollments
func (h *ActivityHandler) GetMyEnrollments(c *gin.Context) {
	userID := middleware.UserID(c)

	enrollments, total, err := h.enrollmentSvc.GetMyEnrollments(c.Request.Context(), userID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	c.JSON(200, gin.H{"enrollments": enrollments, "total": total})
}

// GetActivityEnrollments handles the operator-side view of all enrollments for one activity.
// This endpoint is intended for administrative or lecturer oversight workflows.
// GetActivityEnrollments handles GET /activities/:activityId/enrollments (admin)
func (h *ActivityHandler) GetActivityEnrollments(c *gin.Context) {
	activityID := c.Param("activityId")

	enrollments, total, err := h.enrollmentSvc.GetActivityEnrollments(c.Request.Context(), activityID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	c.JSON(200, gin.H{"enrollments": enrollments, "total": total})
}

// EvaluateEnrollment handles the scoring or rating decision applied to one enrollment.
// It binds a constrained rating payload and forwards the acting reviewer ID to the service.
// EvaluateEnrollment handles POST /activities/:activityId/enrollments/:enrollmentId/evaluate
func (h *ActivityHandler) EvaluateEnrollment(c *gin.Context) {
	userID := middleware.UserID(c)
	enrollmentID := c.Param("enrollmentId")

	req, ok := apihttp.Bind[struct {
		Rating string `json:"rating" binding:"required,oneof=POOR AVERAGE GOOD"`
	}](c)
	if !ok {
		return
	}

	resp, err := h.enrollmentSvc.EvaluateEnrollment(c.Request.Context(), userID, enrollmentID, req.Rating)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// ─────────────────────────────────────────────
//  UC14: Submit Learning (LEARNING cluster)
// ─────────────────────────────────────────────

// SubmitLearning handles submission of LEARNING-cluster completion evidence for one activity.
// The learning submission service performs the deeper validation of URLs, artifacts, or completion semantics.
// SubmitLearning handles POST /activities/:activityId/submit-learning
func (h *ActivityHandler) SubmitLearning(c *gin.Context) {
	userID := middleware.UserID(c)
	activityID := c.Param("activityId")

	req, ok := apihttp.Bind[SubmitLearningRequest](c)
	if !ok {
		return
	}

	resp, err := h.learningSubmitSvc.SubmitLearning(c.Request.Context(), userID, activityID, req)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}

// ─────────────────────────────────────────────
//  Ranking
// ─────────────────────────────────────────────

// GetRanking handles retrieval of the activity-points leaderboard.
// It binds simple page and limit query parameters and returns the ranking response from the activity service.
// GetRanking handles GET /activities/ranking
//
//	@Summary      Activity-points leaderboard
//	@Description  Returns users ranked by activity_points descending.
//	@Tags         Activities
//	@Produce      json
//	@Security     BearerAuth
//	@Param        page   query  int  false  "Page number (default 1)"
//	@Param        limit  query  int  false  "Entries per page (default 20, max 100)"
//	@Success      200    {object}  RankingResponse
//	@Router       /activities/ranking [get]
func (h *ActivityHandler) GetRanking(c *gin.Context) {
	page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 64)

	resp, err := h.activitySvc.GetRanking(c.Request.Context(), page, limit)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	apihttp.OK(c, resp)
}
