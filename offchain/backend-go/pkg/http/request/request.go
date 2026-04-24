// Package request provides shared base types and injection helpers for HTTP request DTOs.
//
// Any request struct that the service layer needs server-side context (IP, User-Agent) from
// should embed Meta and call Inject in the HTTP handler immediately after body binding.
//
// Usage pattern:
//
//	type LoginRequest struct {
//	    Wallet    string `json:"wallet" validate:"required,eth_addr"`
//	    Signature string `json:"signature" validate:"required"`
//	    request.Meta
//	}
//
//	func (h *Handler) Login(c *gin.Context) {
//	    req, ok := apihttp.Bind[LoginRequest](c)
//	    if !ok { return }
//	    request.Inject(c, &req.Meta)
//	    // req.IPAddress and req.UserAgent are now populated
//	    result, err := h.svc.Login(c.Request.Context(), req)
//	    ...
//	}
package request

import "github.com/gin-gonic/gin"

// Meta holds server-injected request context fields.
// These are never parsed from the JSON body (tagged json:"-").
// Embed in any request struct that the service needs IP/UA from.
type Meta struct {
	// IPAddress is the client IP, resolved by the reverse-proxy chain or Gin.
	IPAddress string `json:"-" form:"-"`
	// UserAgent is the raw User-Agent header value.
	UserAgent string `json:"-" form:"-"`
}

// Inject populates Meta fields from the current gin request context.
// Call this immediately after binding the JSON body in every handler that uses Meta.
func Inject(c *gin.Context, m *Meta) {
	m.IPAddress = c.ClientIP()
	m.UserAgent = c.Request.UserAgent()
}
