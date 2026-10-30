import XCTest
@testable import GuardedCalendarCore

private let policy = WriterPolicy(enabled: true, allowed_calendar_ids: ["cal"], expected_source_ids: ["cal": "source"])
private let now = ISO8601DateFormatter().date(from: "2026-10-30T12:00:00Z")!
private func request(_ operation: String = "update", _ fields: [String: Any] = ["event_id": "e", "title": "new"]) throws -> GuardedRequest {
    try GuardedRequest(operation: operation, data: JSONSerialization.data(withJSONObject: fields))
}
private func event() -> EventState {
    var e = EventState(calendarID: "cal", sourceID: "source"); e.id = "e"; e.title = "old"
    e.start = now; e.end = now.addingTimeInterval(3600); e.zone = "UTC"
    e.occurrence = e.start // Real EventKit ordinary events have occurrenceDate == startDate.
    return e
}
private final class FakeStore: GuardedEventStore {
    var current = event(), reads = 0, saves = 0, missingAfterSave = false, failSave = false
    var atSave: ((inout EventState) -> Void)?, afterSave: ((inout EventState) -> Void)?
    func read(id: String) throws -> EventState {
        reads += 1
        if missingAfterSave && saves > 0 { throw GuardFailure("not found") }; return current
    }
    func draft(calendarID: String) throws -> EventState { current.id = ""; return current }
    func save(_ desired: EventState, fields: [String], policy: WriterPolicy) throws -> String {
        atSave?(&current); try current.check(policy)
        saves += 1
        if failSave { throw GuardFailure("save failed") }
        current = desired; current.id = "e"; current.occurrence = current.start
        if current.allDay { current.zone = nil } // EventKit floating all-day event.
        afterSave?(&current); return current.id
    }
}
final class GuardedCalendarTests: XCTestCase {
    func testOrdinaryUpdateAndAudit() throws {
        let store = FakeStore(); store.current.notes = "remember"
        let result = writeGuarded(try request(), policy: policy, store: store)
        XCTAssertEqual(result.outcome, "saved"); XCTAssertEqual(store.reads, 2); XCTAssertEqual(store.current.notes, "remember")
        XCTAssertEqual(result.changed_fields, ["title"]); XCTAssertEqual(result.previous, ["title": .text("old")])
        let cleared = writeGuarded(try request("update", ["event_id": "e", "notes": ""]), policy: policy, store: store)
        XCTAssertEqual(cleared.previous["notes"], .text("remember")); XCTAssertNil(store.current.notes)
        let noop = writeGuarded(try request(), policy: policy, store: store)
        XCTAssertTrue(noop.changed_fields.isEmpty); XCTAssertTrue(noop.previous.isEmpty)
    }
    func testEveryEligibilityInvariantBeforeSaveAndOnReadback() throws {
        let ineligible: [(inout EventState) -> Void] = [
            { $0.calendarID = "other" }, { $0.sourceID = "other" }, { $0.writable = false }, { $0.subscribed = true },
            { $0.calendarType = "birthday" }, { $0.calendarType = "subscription" }, { $0.calendarType = "exchange" }, { $0.supportsEvents = false },
            { $0.hasAttendees = true }, { $0.attendeeCount = 1 }, { $0.hasOrganizer = true }, { $0.hasRecurrence = true },
            { $0.recurrenceCount = 1 }, { $0.detached = true }, { $0.occurrence = now.addingTimeInterval(1) }, { $0.zone = nil },
        ]
        for mutation in ineligible {
            let store = FakeStore(); mutation(&store.current)
            XCTAssertEqual(writeGuarded(try request(), policy: policy, store: store).outcome, "refused"); XCTAssertEqual(store.saves, 0)
            store.current = event(); store.atSave = mutation
            XCTAssertEqual(writeGuarded(try request(), policy: policy, store: store).outcome, "unverified"); XCTAssertEqual(store.saves, 0)
            store.current = event(); store.atSave = nil; store.afterSave = mutation
            XCTAssertEqual(writeGuarded(try request(), policy: policy, store: store).outcome, "unverified")
        }
    }
    func testUnverifiedKeepsUndoRecord() throws {
        for mode in 0..<3 {
            let store = FakeStore(); store.failSave = mode == 0; store.missingAfterSave = mode == 1
            if mode == 2 { store.afterSave = { $0.title = "different" } }
            let result = writeGuarded(try request(), policy: policy, store: store)
            XCTAssertEqual(result.outcome, "unverified"); XCTAssertEqual(result.previous["title"], .text("old"))
        }
    }
    func testFloatingAllDayCreateRescheduleAndUpdate() throws {
        let originalZone = NSTimeZone.default; NSTimeZone.default = TimeZone(identifier: "America/Denver")!; defer { NSTimeZone.default = originalZone }
        let store = FakeStore()
        let create = try request("create", ["calendar_id": "cal", "title": "day", "start": "2026-11-01", "end": "2026-11-02", "time_zone": NSNull(), "is_all_day": true])
        let result = writeGuarded(create, policy: policy, store: store, now: now)
        XCTAssertEqual(result.outcome, "saved"); XCTAssertNil(store.current.zone); XCTAssertEqual(store.current.values["start"], .text("2026-11-01"))
        XCTAssertTrue(result.previous.values.allSatisfy { $0 == .null })
        let moved = try request("reschedule", ["event_id": "e", "start": "2026-11-03", "end": "2026-11-04", "time_zone": NSNull()])
        let movedResult = writeGuarded(moved, policy: policy, store: store, now: now)
        XCTAssertEqual(movedResult.outcome, "saved"); XCTAssertEqual(movedResult.previous["start"], .text("2026-11-01"))
        XCTAssertEqual(writeGuarded(try request(), policy: policy, store: store).outcome, "saved")
        let timed = try request("reschedule", ["event_id": "e", "start": "2026-11-03T10:00:00Z", "end": "2026-11-03T11:00:00Z", "time_zone": "UTC"])
        XCTAssertEqual(writeGuarded(timed, policy: policy, store: store, now: now).outcome, "refused")
    }
    func testStrictInputsAndAuthoritativeDateValidation() throws {
        for patch: [String: Any] in [["request_id": "old"], ["revision_token": "old"], ["title": NSNull()], ["title": "a\u{200b}b"], ["notes": "a\rb"], ["title": String(repeating: "x", count: 301)], ["location": String(repeating: "x", count: 501)], ["notes": String(repeating: "x", count: 4001)]] {
            XCTAssertThrowsError(try request("update", ["event_id": "e", "title": "x"].merging(patch) { _, new in new }))
        }
        XCTAssertThrowsError(try request("update", ["event_id": "e"]))
        let valid: [String: Any] = ["calendar_id": "cal", "title": "new", "start": "2026-11-01T10:00:00-07:00", "end": "2026-11-01T11:00:00-07:00", "time_zone": "America/Denver", "is_all_day": false]
        let store = FakeStore()
        XCTAssertEqual(writeGuarded(try request("create", valid), policy: policy, store: store, now: now).outcome, "saved")
        for patch: [String: Any] in [["time_zone": NSNull()], ["start": "2026-11-01T10:00:00-06:00"], ["start": "2026-02-30T10:00:00-07:00"], ["start": "2026-11-01T10:00:00"], ["end": "2026-11-01T10:00:00-07:00"], ["end": "2026-12-03T10:00:00-07:00"], ["start": "2025-01-01T10:00:00-07:00"], ["start": "2037-01-01T10:00:00-07:00", "end": "2037-01-01T11:00:00-07:00"]] {
            XCTAssertThrowsError(try request("create", valid.merging(patch) { _, new in new }).interval(allDay: false, now: now))
        }
    }
    func testLaunchEnvironmentPolicyLoadedOnceIncludingFailure() throws {
        var calls = 0
        let launch = GuardedLaunchPolicy(environment: ["MACOS_MCP_CALENDAR_POLICY": "/fixed"]) { path in
            calls += 1; XCTAssertEqual(path, "/fixed"); return policy
        }
        _ = try launch.requirePolicy(); _ = try launch.requirePolicy(); XCTAssertEqual(calls, 1)
        let missing = GuardedLaunchPolicy(environment: [:]) { path in calls += 1; XCTAssertNil(path); throw GuardFailure("missing") }
        XCTAssertThrowsError(try missing.requirePolicy()); XCTAssertThrowsError(try missing.requirePolicy()); XCTAssertEqual(calls, 2)
    }
    func testPrivatePolicyFileAndSymlinks() throws {
        // Use an in-worktree path: /tmp is a symlink on macOS and correctly refused.
        let directory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent(".build/policy-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let file = directory.appendingPathComponent("policy.json")
        try JSONEncoder().encode(policy).write(to: file); try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
        XCTAssertEqual(try PrivateFiles.loadPolicy(path: file.path).allowed_calendar_ids, ["cal"])
        let link = directory.appendingPathComponent("link"); try FileManager.default.createSymbolicLink(at: link, withDestinationURL: file)
        XCTAssertThrowsError(try PrivateFiles.loadPolicy(path: link.path))
        try FileManager.default.setAttributes([.posixPermissions: 0o666], ofItemAtPath: file.path)
        XCTAssertThrowsError(try PrivateFiles.loadPolicy(path: file.path))
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
        try Data().write(to: file); XCTAssertThrowsError(try PrivateFiles.loadPolicy(path: file.path))
        XCTAssertThrowsError(try PrivateFiles.loadPolicy(path: nil))
    }
}
