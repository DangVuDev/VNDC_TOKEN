package timeutil

import "time"

var utcPlus7 = time.FixedZone("UTC+7", 7*60*60)

// FormatRFC3339UTC7 formats a time in RFC3339 with UTC+7 offset.
func FormatRFC3339UTC7(t time.Time) string {
	return t.In(utcPlus7).Format(time.RFC3339)
}
