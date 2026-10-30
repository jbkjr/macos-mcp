import Foundation

public enum AuditValue: Encodable, Equatable {
    case text(String), boolean(Bool), null
    public func encode(to encoder: Encoder) throws {
        var box = encoder.singleValueContainer()
        switch self { case .text(let v): try box.encode(v); case .boolean(let v): try box.encode(v); case .null: try box.encodeNil() }
    }
}
public struct EventState {
    public var id = "", calendarID: String, sourceID: String
    public var writable = true, subscribed = false, calendarType = "local", supportsEvents = true
    public var title = "", notes: String?, location: String?, zone: String?
    public var start = Date(), end = Date(), allDay = false
    public var hasAttendees = false, attendeeCount = 0, hasOrganizer = false
    public var hasRecurrence = false, recurrenceCount = 0, detached = false, occurrence: Date?
    public init(calendarID: String, sourceID: String) { self.calendarID = calendarID; self.sourceID = sourceID }
    public func check(_ policy: WriterPolicy) throws {
        guard policy.enabled, policy.allowed_calendar_ids.contains(calendarID), !calendarID.isEmpty,
              sourceID != "", policy.expected_source_ids[calendarID] == sourceID else { throw GuardFailure("calendar or source not allowlisted") }
        guard writable, !subscribed, supportsEvents, ["local", "calDAV"].contains(calendarType) else { throw GuardFailure("calendar type or permissions refused (Exchange unsupported in v1)") }
        guard !hasAttendees, attendeeCount == 0, !hasOrganizer else { throw GuardFailure("attendees or organizer present") }
        guard !hasRecurrence, recurrenceCount == 0, !detached, occurrence == nil || occurrence == start else { throw GuardFailure("recurring or detached event") }
        guard allDay || zone.flatMap(guardedTimeZone) != nil else { throw GuardFailure("timed event has no IANA time zone") }
    }
    var values: [String: AuditValue] {
        func date(_ value: Date) -> String {
            if !allDay {
                let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                return f.string(from: value)
            }
            let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.calendar = Calendar(identifier: .gregorian)
            f.timeZone = NSTimeZone.default; f.dateFormat = "yyyy-MM-dd"; return f.string(from: value)
        }
        return ["title": .text(title), "notes": notes.map(AuditValue.text) ?? .null,
                "location": location.map(AuditValue.text) ?? .null, "start": .text(date(start)), "end": .text(date(end)),
                "time_zone": zone.map(AuditValue.text) ?? .null, "is_all_day": .boolean(allDay)]
    }
    func matches(_ expected: EventState, fields: [String]) -> Bool {
        fields.allSatisfy { field in
            if field == "start" { return start == expected.start }
            if field == "end" { return end == expected.end }
            if field == "time_zone", !allDay { return zone.flatMap(guardedTimeZone) == expected.zone.flatMap(guardedTimeZone) }
            return values[field] == expected.values[field]
        }
    }
}
public struct GuardedResult: Encodable {
    public var outcome = "refused", event_id: String?, calendar_id: String?
    public var changed_fields: [String] = [], previous: [String: AuditValue] = [:], reason: String?
    public init(reason: String? = nil) { self.reason = reason }
    public func encode(to encoder: Encoder) throws {
        enum Keys: String, CodingKey { case outcome, event_id, calendar_id, changed_fields, previous, reason }
        var box = encoder.container(keyedBy: Keys.self)
        try box.encode(outcome, forKey: .outcome); try box.encode(event_id, forKey: .event_id); try box.encode(calendar_id, forKey: .calendar_id)
        try box.encode(changed_fields, forKey: .changed_fields); try box.encode(previous, forKey: .previous); try box.encodeIfPresent(reason, forKey: .reason)
    }
}
public protocol GuardedEventStore {
    func read(id: String) throws -> EventState
    func draft(calendarID: String) throws -> EventState
    /// Must check the actual current event's eligibility immediately before save.
    func save(_ desired: EventState, fields: [String], policy: WriterPolicy) throws -> String
}
public func writeGuarded(_ request: GuardedRequest, policy: WriterPolicy, store: GuardedEventStore, now: Date = Date()) -> GuardedResult {
    var result = GuardedResult(), attempted = false
    result.event_id = request.event_id; result.calendar_id = request.calendar_id
    do {
        let creating = request.operation == "create"
        let before = try creating ? store.draft(calendarID: request.calendar_id!) : store.read(id: request.event_id!)
        result.calendar_id = before.calendarID
        try before.check(policy)
        var desired = before
        if let title = request.title { desired.title = title }
        if let notes = request.notes { desired.notes = notes.isEmpty ? nil : notes }
        if let location = request.location { desired.location = location.isEmpty ? nil : location }
        if creating { desired.allDay = request.is_all_day! }
        if request.operation != "update" {
            let (start, end, zone) = try request.interval(allDay: desired.allDay, now: now)
            desired.start = start; desired.end = end; desired.zone = desired.allDay ? nil : zone.identifier
        }
        result.changed_fields = request.changedFields.filter { creating || !before.matches(desired, fields: [$0]) }
        for field in result.changed_fields { result.previous[field] = creating ? .null : before.values[field] }
        attempted = true
        let id = try store.save(desired, fields: request.changedFields, policy: policy)
        result.event_id = id
        let after = try store.read(id: id) // Adapter must fetch from a fresh EKEventStore.
        try after.check(policy)
        guard !id.isEmpty, after.id == id, after.calendarID == before.calendarID, after.allDay == desired.allDay,
              after.matches(desired, fields: request.changedFields) else { throw GuardFailure("saved event did not match requested fields") }
        result.outcome = "saved"
    } catch {
        result.outcome = attempted ? "unverified" : "refused"; result.reason = error.localizedDescription
    }
    return result
}
