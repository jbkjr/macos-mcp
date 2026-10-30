# Guarded calendar writes

These additive tools immediately save one of Jack's guest-free, non-recurring events.
Generic calendar tools and their read outputs retain their existing behavior.

| Tool | Strict input fields |
| --- | --- |
| `guarded_calendar_create_event` | `calendar_id, title, start, end, time_zone, is_all_day`, optional `notes, location` |
| `guarded_calendar_reschedule_event` | `event_id, start, end, time_zone` |
| `guarded_calendar_update_event` | `event_id`, at least one of `title, notes, location` |

Unknown fields are refused. Omitted update fields are preserved; empty notes/location
clears them. Titles are nonempty, at most 300 Unicode scalars; location 500, notes 4000.
Control/invisible characters are refused, except newline/tab in notes.
Timed dates require RFC 3339 with a known offset matching an IANA `time_zone`.
All-day dates are floating `YYYY-MM-DD`, resolved in the Mac's default zone, with
an exclusive end; `time_zone` is required but may be null and never shifts these dates.
Reschedule preserves the existing all-day/timed kind. End must follow start by at most
31 calendar days; start must be within -365/+3650 calendar days of now.

Set `MACOS_MCP_CALENDAR_POLICY` in the server's launch environment to an absolute
file path. The file and every ancestor must be owned by the current user or root,
not group/world writable, and not symlinks; the regular file must have one hard link.
Example policy: `{"enabled":true,"allowed_calendar_ids":["CALENDAR_ID"],"expected_source_ids":{"CALENDAR_ID":"SOURCE_ID"}}`.
Missing, empty, disabled or invalid policy refuses guarded writes. Policy is loaded
once per bridge process. LaunchServices receives it via `open --env`, never bridge argv.
Guarded payloads occupy argv position 3 (`--action`, operation, JSON), bypassing the
legacy parser. Full Calendar access must already exist; guarded tools never request it.

Swift checks the actual EventKit object immediately before saving with `.thisEvent`:
calendar and expected source must match policy; calendar must permit modification,
support events, and be local/CalDAV, neither subscribed, birthday nor Exchange.
Both attendee signals must be empty, organizer nil, and all recurrence signals absent
(ordinary `occurrenceDate == startDate` is allowed). It never deletes, moves calendars,
or sets attendees, alarms, URL or recurrence. Existing alarms remain and relative
alarms may follow a rescheduled event.

Response: `{outcome:"saved"|"refused"|"unverified", event_id, calendar_id,
changed_fields, previous, reason?}`. IDs may be null if unavailable. `saved` means a
fresh EventKit-store fetch confirmed requested fields and eligibility. `refused`
means validation/initial eligibility failed; `unverified` means save was attempted
but threw or could not be confirmed. Do not automatically retry an unverified create.
`changed_fields` lists actual requested changes; `previous` contains their old values
(null for creates), including date-only all-day dates. The gateway logs this undo
record like reminder writes. There is no journal, lock, revision token or idempotency
store; concurrent external edits and process crashes can prevent a complete audit.

## Live checks (manual, separately authorized)

1. Timed event: create, reschedule and update a guest-free event; check Calendar and the gateway's previous-values log, then undo.
2. All-day event: create and reschedule across a DST boundary; confirm floating dates, exclusive end and nil time zone, then undo.
3. Received invitation on the jbkjr calendar: attempt update/reschedule; confirm refusal and no calendar change.
