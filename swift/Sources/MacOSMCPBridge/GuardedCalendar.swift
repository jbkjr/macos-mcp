import Foundation
import EventKit
import GuardedCalendarCore

private let launchPolicy = GuardedLaunchPolicy(environment: ProcessInfo.processInfo.environment)
private func requireCalendarAccess() throws {
    let status = EKEventStore.authorizationStatus(for: .event)
    if #available(macOS 14.0, *) {
        guard status == .fullAccess else { throw GuardFailure("full Calendar access required; guarded tools never request access") }; return
    }
    guard status == .authorized else { throw GuardFailure("Calendar access required") }
}
private func snapshot(_ event: EKEvent) throws -> EventState {
    guard let calendar = event.calendar, let start = event.startDate, let end = event.endDate else { throw GuardFailure("event metadata unavailable") }
    var state = EventState(calendarID: calendar.calendarIdentifier, sourceID: calendar.source.sourceIdentifier)
    switch calendar.type {
    case .local: state.calendarType = "local"
    case .calDAV: state.calendarType = "calDAV"
    case .exchange: state.calendarType = "exchange"
    default: state.calendarType = "unsupported"
    }
    state.writable = calendar.allowsContentModifications; state.subscribed = calendar.isSubscribed
    state.supportsEvents = calendar.allowedEntityTypes.contains(.event)
    state.id = event.eventIdentifier ?? ""; state.title = event.title ?? ""
    state.notes = event.notes.flatMap { $0.isEmpty ? nil : $0 }; state.location = event.location.flatMap { $0.isEmpty ? nil : $0 }
    state.start = start; state.end = end; state.allDay = event.isAllDay; state.zone = event.timeZone?.identifier
    state.hasAttendees = event.hasAttendees; state.attendeeCount = event.attendees?.count ?? 0; state.hasOrganizer = event.organizer != nil
    state.hasRecurrence = event.hasRecurrenceRules; state.recurrenceCount = event.recurrenceRules?.count ?? 0
    state.detached = event.isDetached; state.occurrence = event.occurrenceDate
    return state
}
private final class EventKitGuardedStore: GuardedEventStore {
    private var store: EKEventStore?, current: EKEvent?
    private var creating = false
    func read(id: String) throws -> EventState {
        try requireCalendarAccess()
        let fresh = EKEventStore()
        guard let event = fresh.event(withIdentifier: id), event.eventIdentifier == id else { throw GuardFailure("event not found") }
        store = fresh; current = event; creating = false; return try snapshot(event)
    }
    func draft(calendarID: String) throws -> EventState {
        try requireCalendarAccess()
        let fresh = EKEventStore()
        guard let calendar = fresh.calendar(withIdentifier: calendarID) else { throw GuardFailure("calendar not found") }
        let event = EKEvent(eventStore: fresh); event.calendar = calendar
        event.timeZone = NSTimeZone.default
        event.startDate = Date(); event.endDate = event.startDate.addingTimeInterval(3600)
        store = fresh; current = event; creating = true
        var state = try snapshot(event); state.id = ""; return state
    }
    func save(_ desired: EventState, fields: [String], policy: WriterPolicy) throws -> String {
        try requireCalendarAccess()
        guard let store, let event = current else { throw GuardFailure("event unavailable at save") }
        let actual = try snapshot(event)
        try actual.check(policy) // Authoritative save-time check on the actual EventKit object.
        guard actual.calendarID == desired.calendarID,
              creating || (actual.id == desired.id && actual.allDay == desired.allDay) else { throw GuardFailure("event identity or kind changed") }
        if fields.contains("title") { event.title = desired.title }
        if fields.contains("notes") { event.notes = desired.notes }
        if fields.contains("location") { event.location = desired.location }
        if fields.contains("is_all_day") { event.isAllDay = desired.allDay }
        if fields.contains("time_zone") { event.timeZone = desired.allDay ? nil : desired.zone.flatMap(guardedTimeZone) }
        if fields.contains("start") { event.startDate = desired.start }
        if fields.contains("end") { event.endDate = desired.end }
        // Never set calendar on an existing event, attendees, alarms, URL or recurrence.
        try store.save(event, span: .thisEvent, commit: true)
        guard let id = event.eventIdentifier, !id.isEmpty else { throw GuardFailure("saved event identifier unavailable") }
        return id
    }
}
func runGuardedCalendar(arguments: [String]) -> GuardedResult {
    do {
        guard arguments.count == 3, arguments[0] == "--action",
              let operation = ["guarded-calendar-create-event": "create", "guarded-calendar-reschedule-event": "reschedule", "guarded-calendar-update-event": "update"][arguments[1]] else { throw GuardFailure("invalid structured guarded invocation") }
        let request = try GuardedRequest(operation: operation, data: Data(arguments[2].utf8))
        let policy = try launchPolicy.requirePolicy()
        try requireCalendarAccess()
        return writeGuarded(request, policy: policy, store: EventKitGuardedStore())
    } catch { return GuardedResult(reason: error.localizedDescription) }
}
