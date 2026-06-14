// Package adapters contains MongoDB-backed implementations of repository ports and persistence helpers.
// This file groups the activity-related repositories used by activity, claim, enrollment, and learning-submission workflows.
package adapters

import (
	"context"
	"time"

	"github.com/vndc/backend/internal/domain"
	pkgmongodb "github.com/vndc/backend/pkg/database/mongodb"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// ActivityRepository persists top-level activity definitions.
// It is responsible only for storage concerns, leaving validation and lifecycle rules to services.
type ActivityRepository struct {
	col *mongo.Collection
}

// NewActivityRepository initializes the activity repository around the dedicated MongoDB collection.
// Keeping this wiring in one constructor isolates persistence setup from the service layer.
func NewActivityRepository(client *pkgmongodb.Client) *ActivityRepository {
	return &ActivityRepository{
		col: client.Collection("activities"),
	}
}

// Create persists a new activity document without applying business validation or defaulting.
// Any invariants around schedule, ownership, or publication status should already be enforced before reaching the repository.
func (r *ActivityRepository) Create(ctx context.Context, activity *domain.Activity) error {
	_, err := r.col.InsertOne(ctx, activity)
	return err
}

// FindByID loads a single activity by its document ID and returns nil when the record does not exist.
// That allows callers to differentiate between a missing entity and a real storage error.
func (r *ActivityRepository) FindByID(ctx context.Context, id string) (*domain.Activity, error) {
	var activity domain.Activity
	err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&activity)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &activity, nil
}

// FindAll returns the active activity set together with its total count for pagination.
// The repository deliberately fixes the filter to active items only so public-facing lists do not need to replicate visibility logic.
func (r *ActivityRepository) FindAll(ctx context.Context) ([]*domain.Activity, int64, error) {
	filter := bson.M{"status": domain.ActivityStatusActive}

	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var activities []*domain.Activity
	if err = cursor.All(ctx, &activities); err != nil {
		return nil, 0, err
	}

	if activities == nil {
		activities = make([]*domain.Activity, 0)
	}

	return activities, count, nil
}

// FindByCreator returns activities authored by a given lecturer together with the matching count.
// This query supports creator dashboards, lecturer management views, and ownership-scoped reporting.
func (r *ActivityRepository) FindByCreator(ctx context.Context, createdBy string) ([]*domain.Activity, int64, error) {
	filter := bson.M{"created_by": createdBy}

	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var activities []*domain.Activity
	if err = cursor.All(ctx, &activities); err != nil {
		return nil, 0, err
	}

	if activities == nil {
		activities = make([]*domain.Activity, 0)
	}

	return activities, count, nil
}

// Update applies a partial update to an activity and refreshes its updated_at timestamp.
// Keeping timestamp management here prevents duplicated bookkeeping across handlers and services.
func (r *ActivityRepository) Update(ctx context.Context, id string, updates map[string]any) error {
	updates["updated_at"] = time.Now()
	_, err := r.col.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updates})
	return err
}

// Delete removes an activity document by ID.
// The repository intentionally does not cascade related records because that policy belongs to higher-level workflow code.
func (r *ActivityRepository) Delete(ctx context.Context, id string) error {
	_, err := r.col.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

// FindByIDs bulk-loads activities for a known list of IDs, preserving empty-slice semantics.
// It is primarily used to resolve titles, labels, or related metadata for associated records in bulk.
func (r *ActivityRepository) FindByIDs(ctx context.Context, ids []string) ([]*domain.Activity, error) {
	if len(ids) == 0 {
		return []*domain.Activity{}, nil
	}
	filter := bson.M{"_id": bson.M{"$in": ids}}
	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var activities []*domain.Activity
	if err = cursor.All(ctx, &activities); err != nil {
		return nil, err
	}
	if activities == nil {
		activities = []*domain.Activity{}
	}
	return activities, nil
}

// ─────────────────────────────────────────────
//  ActivityRecordRepository
// ─────────────────────────────────────────────

// ActivityRecordRepository persists per-student activity participation and review state.
// It serves as the main storage surface for submissions, approvals, and record-level status transitions.
type ActivityRecordRepository struct {
	col *mongo.Collection
}

// NewActivityRecordRepository wires activity-record persistence to the dedicated MongoDB collection.
// This centralizes storage access for student participation records and review state.
func NewActivityRecordRepository(client *pkgmongodb.Client) *ActivityRecordRepository {
	return &ActivityRecordRepository{
		col: client.Collection("activity_records"),
	}
}

// Create stores a new activity record exactly as provided.
// Validation, ownership checks, duplicate prevention, and initial status selection belong to upstream services.
func (r *ActivityRecordRepository) Create(ctx context.Context, record *domain.ActivityRecord) error {
	_, err := r.col.InsertOne(ctx, record)
	return err
}

// FindByID loads a single activity record by ID and returns nil for a missing document.
// That keeps repository semantics consistent with the rest of the persistence layer.
func (r *ActivityRecordRepository) FindByID(ctx context.Context, id string) (*domain.ActivityRecord, error) {
	var record domain.ActivityRecord
	err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&record)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

// FindByActivityID returns all records for a given activity together with the total count.
// The count lets higher layers paginate or summarize participation without issuing a second aggregate query.
func (r *ActivityRecordRepository) FindByActivityID(ctx context.Context, activityID string) ([]*domain.ActivityRecord, int64, error) {
	filter := bson.M{"activity_id": activityID}

	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var records []*domain.ActivityRecord
	if err = cursor.All(ctx, &records); err != nil {
		return nil, 0, err
	}

	if records == nil {
		records = make([]*domain.ActivityRecord, 0)
	}

	return records, count, nil
}

// FindByStudentAddress returns all records owned by a student together with the total count.
// This is the student-scoped lookup used by dashboards, submission histories, and personal progress views.
func (r *ActivityRecordRepository) FindByStudentAddress(ctx context.Context, address string) ([]*domain.ActivityRecord, int64, error) {
	filter := bson.M{"student_address": address}

	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var records []*domain.ActivityRecord
	if err = cursor.All(ctx, &records); err != nil {
		return nil, 0, err
	}

	if records == nil {
		records = make([]*domain.ActivityRecord, 0)
	}

	return records, count, nil
}

// FindByActivityAndStudent resolves the unique record for one activity/student pair.
// It is the canonical lookup for preventing duplicate submissions, duplicate participation rows, or repeated review records.
func (r *ActivityRecordRepository) FindByActivityAndStudent(ctx context.Context, activityID, studentAddress string) (*domain.ActivityRecord, error) {
	var record domain.ActivityRecord
	err := r.col.FindOne(ctx, bson.M{
		"activity_id":     activityID,
		"student_address": studentAddress,
	}).Decode(&record)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

// FindByStatus returns records matching a specific workflow status together with the count.
// This supports moderation queues, operational review screens, and background processing jobs.
func (r *ActivityRecordRepository) FindByStatus(ctx context.Context, status domain.ActivityRecordStatus) ([]*domain.ActivityRecord, int64, error) {
	filter := bson.M{"status": status}

	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var records []*domain.ActivityRecord
	if err = cursor.All(ctx, &records); err != nil {
		return nil, 0, err
	}

	if records == nil {
		records = make([]*domain.ActivityRecord, 0)
	}

	return records, count, nil
}

// FindExpiredRecords returns pending records whose edit deadline has already passed.
// Callers use this set to auto-lock, finalize, or escalate records that were left unfinished beyond their allowed edit window.
func (r *ActivityRecordRepository) FindExpiredRecords(ctx context.Context) ([]*domain.ActivityRecord, error) {
	filter := bson.M{
		"status":        domain.ActivityRecordStatusPending,
		"edit_deadline": bson.M{"$lt": time.Now()},
	}

	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var records []*domain.ActivityRecord
	if err = cursor.All(ctx, &records); err != nil {
		return nil, err
	}

	if records == nil {
		records = make([]*domain.ActivityRecord, 0)
	}

	return records, nil
}

// Update applies a partial field update to an activity record and refreshes updated_at automatically.
// This keeps timestamp maintenance centralized inside the persistence layer.
func (r *ActivityRecordRepository) Update(ctx context.Context, id string, updates map[string]any) error {
	updates["updated_at"] = time.Now()
	_, err := r.col.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updates})
	return err
}

// BulkUpdateStatus transitions multiple records to the same status in a single write.
// This is used for batch state changes where per-document updates would be too expensive or operationally noisy.
func (r *ActivityRecordRepository) BulkUpdateStatus(ctx context.Context, ids []string, newStatus domain.ActivityRecordStatus) error {
	filter := bson.M{"_id": bson.M{"$in": ids}}
	update := bson.M{
		"$set": bson.M{
			"status":     newStatus,
			"updated_at": time.Now(),
		},
	}
	_, err := r.col.UpdateMany(ctx, filter, update)
	return err
}

// Delete permanently removes an activity record by ID.
// The repository intentionally does not cascade into related claims or enrollments.
func (r *ActivityRecordRepository) Delete(ctx context.Context, id string) error {
	_, err := r.col.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

// ─────────────────────────────────────────────
//  ActivityClaimRepository
// ─────────────────────────────────────────────

// ActivityClaimRepository persists reward or completion claims tied to activity participation.
// It stores the claim documents that downstream review or payout flows operate on.
type ActivityClaimRepository struct {
	col *mongo.Collection
}

// NewActivityClaimRepository wires activity-claim persistence to the claims collection.
func NewActivityClaimRepository(client *pkgmongodb.Client) *ActivityClaimRepository {
	return &ActivityClaimRepository{
		col: client.Collection("activity_claims"),
	}
}

// Create stores a new activity claim document without mutating the payload.
// Higher layers are responsible for enforcing claim eligibility, idempotency, and any required approval preconditions.
func (r *ActivityClaimRepository) Create(ctx context.Context, claim *domain.ActivityClaim) error {
	_, err := r.col.InsertOne(ctx, claim)
	return err
}

// FindByID loads a single claim by ID and returns nil when it does not exist.
// This keeps claim lookup semantics aligned with other repositories that treat absence as a non-error case.
func (r *ActivityClaimRepository) FindByID(ctx context.Context, id string) (*domain.ActivityClaim, error) {
	var claim domain.ActivityClaim
	err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&claim)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &claim, nil
}

// FindByStudentAddress returns all claims for a student together with the matching count.
// The count is useful for pagination, summary cards, and operational visibility into claim volume.
func (r *ActivityClaimRepository) FindByStudentAddress(ctx context.Context, address string) ([]*domain.ActivityClaim, int64, error) {
	filter := bson.M{"student_address": address}

	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var claims []*domain.ActivityClaim
	if err = cursor.All(ctx, &claims); err != nil {
		return nil, 0, err
	}

	if claims == nil {
		claims = make([]*domain.ActivityClaim, 0)
	}

	return claims, count, nil
}

// Update applies a partial update to a claim document without replacing the whole record.
// This is typically used for claim status transitions and reviewer-side metadata updates.
func (r *ActivityClaimRepository) Update(ctx context.Context, id string, updates map[string]any) error {
	_, err := r.col.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updates})
	return err
}

// ─────────────────────────────────────────────
//  ActivityEnrollmentRepository
// ─────────────────────────────────────────────

// ActivityEnrollmentRepository persists student enrollments for activities.
// It supports roster views, duplicate-enrollment checks, and participation counts.
type ActivityEnrollmentRepository struct {
	col *mongo.Collection
}

// NewActivityEnrollmentRepository wires enrollment persistence to the activity_enrollments collection.
// It provides the storage entry point for roster-building and participation registration workflows.
func NewActivityEnrollmentRepository(client *pkgmongodb.Client) *ActivityEnrollmentRepository {
	return &ActivityEnrollmentRepository{col: client.Collection("activity_enrollments")}
}

// Create inserts a new enrollment record exactly as provided by the caller.
// Eligibility checks and deduplication must already be handled upstream.
func (r *ActivityEnrollmentRepository) Create(ctx context.Context, e *domain.ActivityEnrollment) error {
	_, err := r.col.InsertOne(ctx, e)
	return err
}

// FindByID loads one enrollment by ID and returns nil when the document is absent.
func (r *ActivityEnrollmentRepository) FindByID(ctx context.Context, id string) (*domain.ActivityEnrollment, error) {
	var e domain.ActivityEnrollment
	err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&e)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	return &e, err
}

// FindByActivityID returns enrollments for an activity together with the total count.
// That keeps the caller free from running a separate count query when rendering rosters or capacity metrics.
func (r *ActivityEnrollmentRepository) FindByActivityID(ctx context.Context, activityID string) ([]*domain.ActivityEnrollment, int64, error) {
	filter := bson.M{"activity_id": activityID}
	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)
	var items []*domain.ActivityEnrollment
	if err = cursor.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	if items == nil {
		items = make([]*domain.ActivityEnrollment, 0)
	}
	return items, count, nil
}

// FindByStudentAddress returns enrollments belonging to a student together with the total count.
// This powers student-specific activity rosters and personal enrollment views.
func (r *ActivityEnrollmentRepository) FindByStudentAddress(ctx context.Context, address string) ([]*domain.ActivityEnrollment, int64, error) {
	filter := bson.M{"student_address": address}
	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)
	var items []*domain.ActivityEnrollment
	if err = cursor.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	if items == nil {
		items = make([]*domain.ActivityEnrollment, 0)
	}
	return items, count, nil
}

// FindByActivityAndStudent resolves the unique enrollment for a specific activity and student pair.
// Callers use this lookup to prevent duplicate enrollment writes.
func (r *ActivityEnrollmentRepository) FindByActivityAndStudent(ctx context.Context, activityID, studentAddress string) (*domain.ActivityEnrollment, error) {
	var e domain.ActivityEnrollment
	err := r.col.FindOne(ctx, bson.M{"activity_id": activityID, "student_address": studentAddress}).Decode(&e)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	return &e, err
}

// CountByActivityID returns how many enrollments currently exist for a given activity.
// It is a lightweight aggregate used by dashboards and capacity checks.
func (r *ActivityEnrollmentRepository) CountByActivityID(ctx context.Context, activityID string) (int64, error) {
	return r.col.CountDocuments(ctx, bson.M{"activity_id": activityID})
}

// Update applies a partial update to an enrollment and refreshes updated_at.
// Keeping timestamp mutation here prevents duplicated bookkeeping in callers.
func (r *ActivityEnrollmentRepository) Update(ctx context.Context, id string, updates map[string]any) error {
	updates["updated_at"] = time.Now()
	_, err := r.col.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updates})
	return err
}

// ─────────────────────────────────────────────
//  LearningSubmissionRepository
// ─────────────────────────────────────────────

// LearningSubmissionRepository persists learning-specific submissions connected to activity workflows.
// It supports the storage side of submission review and student progress tracking.
type LearningSubmissionRepository struct {
	col *mongo.Collection
}

// NewLearningSubmissionRepository wires learning-submission persistence to the backing MongoDB collection.
// The constructor centralizes access to the collection used by learning-task review workflows.
func NewLearningSubmissionRepository(client *pkgmongodb.Client) *LearningSubmissionRepository {
	return &LearningSubmissionRepository{col: client.Collection("learning_submissions")}
}

// Create stores a learning submission document exactly as received from the caller.
// Validation of content completeness, plagiarism rules, or submission windows stays outside the repository layer.
func (r *LearningSubmissionRepository) Create(ctx context.Context, s *domain.LearningSubmission) error {
	_, err := r.col.InsertOne(ctx, s)
	return err
}

// FindByActivityAndStudent resolves the unique learning submission for one activity and student pair.
// This is the lookup used to prevent duplicate submission records and to resume review of an existing submission.
func (r *LearningSubmissionRepository) FindByActivityAndStudent(ctx context.Context, activityID, studentAddress string) (*domain.LearningSubmission, error) {
	var s domain.LearningSubmission
	err := r.col.FindOne(ctx, bson.M{"activity_id": activityID, "student_address": studentAddress}).Decode(&s)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	return &s, err
}

// FindByStudentAddress returns all submissions for a student together with the total count.
// The count is returned to support dashboards and paginated submission histories.
func (r *LearningSubmissionRepository) FindByStudentAddress(ctx context.Context, address string) ([]*domain.LearningSubmission, int64, error) {
	filter := bson.M{"student_address": address}
	count, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)
	var items []*domain.LearningSubmission
	if err = cursor.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	if items == nil {
		items = make([]*domain.LearningSubmission, 0)
	}
	return items, count, nil
}
