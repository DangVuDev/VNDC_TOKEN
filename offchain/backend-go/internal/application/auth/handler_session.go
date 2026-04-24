// Package auth — session listing and revocation handlers.
package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"

	_ "github.com/vndc/backend/internal/models" // swagger model registration
	apihttp "github.com/vndc/backend/pkg/http"
	"github.com/vndc/backend/pkg/http/middleware"
)

// ListSessions godoc
//
//	@Summary      List active sessions
//	@Description  Returns all unexpired, un-revoked sessions for the authenticated user.
//	@Description  Each entry includes device fingerprint, IP, and geolocation so users can
//	@Description  identify and revoke sessions they do not recognise.
//	@Tags         Auth
//	@Produce      json
//	@Security     BearerAuth
//	@Success      200  {object}  models.SessionListResponse
//	@Failure      401  {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      500  {object}  models.ErrorResponse  "Internal server error"
//	@Router       /auth/sessions [get]
func (h *Handler) ListSessions(c *gin.Context) {
	userID := middleware.UserID(c)
	sessions, err := h.svc.GetActiveSessions(c.Request.Context(), userID)
	if err != nil {
		apihttp.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": sessions})
}

// RevokeSession godoc
//
//	@Summary      Revoke a specific session
//	@Description  Terminates the session identified by `:id`. Users can only revoke their own sessions.
//	@Description  Use this to remotely sign out a specific device.
//	@Tags         Auth
//	@Produce      json
//	@Security     BearerAuth
//	@Param        id   path  string  true  "Session ID (UUID)"  example(9f8e7d6c-5b4a-3210-fedc-ba9876543210)
//	@Success      204  "Session revoked — no content"
//	@Failure      401  {object}  models.ErrorResponse  "Missing or invalid Bearer token"
//	@Failure      403  {object}  models.ErrorResponse  "Session belongs to another user"
//	@Failure      404  {object}  models.ErrorResponse  "Session not found"
//	@Failure      500  {object}  models.ErrorResponse  "Internal server error"
//	@Router       /auth/sessions/{id} [delete]
func (h *Handler) RevokeSession(c *gin.Context) {
	sessionID, ok := apihttp.PathParam(c, "id")
	if !ok {
		return
	}
	userID := middleware.UserID(c)
	if err := h.svc.RevokeSession(c.Request.Context(), userID, sessionID, c.ClientIP(), c.Request.UserAgent()); err != nil {
		apihttp.Fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
