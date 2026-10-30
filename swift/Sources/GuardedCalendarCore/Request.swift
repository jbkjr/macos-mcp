import Foundation
import CoreFoundation

public struct GuardFailure: LocalizedError {
    public let message: String
    public init(_ message: String) { self.message = message }
    public var errorDescription: String? { message }
}

/// Foundation canonicalizes UTC to GMT and accepts IANA aliases that are absent
/// from knownTimeZoneIdentifiers. Reject offset-only/floating zone spellings.
public func guardedTimeZone(_ name: String) -> TimeZone? {
    guard name == "UTC" || name == "GMT" || name.range(of: #"^[A-Za-z_+-]+(?:/[A-Za-z0-9_+.-]+)+$"#, options: .regularExpression) != nil else { return nil }
    return TimeZone(identifier: name)
}

public struct GuardedRequest {
    public let operation: String
    public var calendar_id: String?
    public var event_id: String?
    public var title: String?
    public var notes: String?
    public var location: String?
    public var start: String?
    public var end: String?
    public var time_zone: String?
    public var is_all_day: Bool?

    public init(operation: String, data: Data) throws {
        guard data.count <= 32768,
              let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw GuardFailure("invalid guarded request") }
        let allowed: Set<String>
        switch operation {
        case "create": allowed = ["calendar_id", "title", "start", "end", "time_zone", "is_all_day", "notes", "location"]
        case "reschedule": allowed = ["event_id", "start", "end", "time_zone"]
        case "update": allowed = ["event_id", "title", "notes", "location"]
        default: throw GuardFailure("invalid guarded operation")
        }
        guard Set(object.keys).isSubset(of: allowed), !object.contains(where: { $0.value is NSNull && $0.key != "time_zone" }) else { throw GuardFailure("unknown or null guarded field") }
        for (key, value) in object {
            if key == "is_all_day" {
                guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else { throw GuardFailure("invalid guarded field type") }
            } else if !(value is String) && !(key == "time_zone" && value is NSNull) { throw GuardFailure("invalid guarded field type") }
        }
        self.operation = operation
        self.calendar_id = object["calendar_id"] as? String
        self.event_id = object["event_id"] as? String
        self.title = object["title"] as? String; self.notes = object["notes"] as? String; self.location = object["location"] as? String
        self.start = object["start"] as? String; self.end = object["end"] as? String
        self.time_zone = object["time_zone"] as? String; self.is_all_day = object["is_all_day"] as? Bool
        guard (time_zone?.unicodeScalars.count ?? 0) <= 100,
              (start?.unicodeScalars.count ?? 0) <= 40, (end?.unicodeScalars.count ?? 0) <= 40 else { throw GuardFailure("time field exceeds limit") }
        for id in [calendar_id, event_id].compactMap({ $0 }) {
            try Self.validateText(id, limit: 1024)
            guard !id.isEmpty else { throw GuardFailure("missing identity") }
        }
        if let title { try Self.validateText(title, limit: 300); guard !title.isEmpty else { throw GuardFailure("empty title") } }
        if let location { try Self.validateText(location, limit: 500) }
        if let notes { try Self.validateText(notes, limit: 4000, notes: true) }
        if operation == "create" {
            guard calendar_id != nil, title != nil, is_all_day != nil else { throw GuardFailure("missing create fields") }
        } else {
            guard event_id != nil else { throw GuardFailure("missing event identity") }
        }
        if operation == "update" {
            guard title != nil || notes != nil || location != nil else { throw GuardFailure("empty update") }
        } else {
            guard start != nil, end != nil, object.keys.contains("time_zone") else { throw GuardFailure("missing time fields") }
        }
    }
    public static func validateText(_ text: String, limit: Int, notes: Bool = false) throws {
        guard text.unicodeScalars.count <= limit else { throw GuardFailure("text exceeds limit") }
        for scalar in text.unicodeScalars {
            if notes && (scalar.value == 9 || scalar.value == 10) { continue }
            let category = scalar.properties.generalCategory
            if category == .control || category == .format || category == .surrogate || category == .lineSeparator || category == .paragraphSeparator || scalar.properties.isDefaultIgnorableCodePoint {
                throw GuardFailure("control or invisible character")
            }
        }
    }
    public var changedFields: [String] {
        if operation == "reschedule" { return ["start", "end", "time_zone"] }
        if operation == "create" { return ["title", "start", "end", "time_zone", "is_all_day"] + (notes == nil ? [] : ["notes"]) + (location == nil ? [] : ["location"]) }
        return [(title == nil ? nil : "title"), (notes == nil ? nil : "notes"), (location == nil ? nil : "location")].compactMap { $0 }
    }
    public func interval(allDay: Bool, now: Date = Date()) throws -> (Date, Date, TimeZone) {
        guard let start, let end, allDay || time_zone.flatMap(guardedTimeZone) != nil else { throw GuardFailure("invalid IANA time zone or interval") }
        // Date-only values are floating dates, never converted from the caller's
        // zone. EventKit exposes all-day instants in NSTimeZone.default.
        if let time_zone, guardedTimeZone(time_zone) == nil { throw GuardFailure("invalid IANA time zone") }
        let zone = allDay ? NSTimeZone.default : guardedTimeZone(time_zone!)!
        func parse(_ value: String) throws -> Date {
            let pattern = allDay ? #"^\d{4}-\d{2}-\d{2}$"# : #"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$"#
            guard value.range(of: pattern, options: .regularExpression) != nil, !value.hasSuffix("-00:00") else { throw GuardFailure("invalid RFC3339 or exclusive date interval") }
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.calendar = Calendar(identifier: .gregorian)
            formatter.isLenient = false
            if allDay {
                formatter.timeZone = zone; formatter.dateFormat = "yyyy-MM-dd"
            } else {
                let suffix = value.hasSuffix("Z") ? "+00:00" : String(value.suffix(6))
                let hours = Int(suffix.dropFirst().prefix(2)) ?? 99
                let minutes = Int(suffix.suffix(2)) ?? 99
                guard hours <= 23, minutes <= 59 else { throw GuardFailure("invalid UTC offset") }
                let offset = (hours * 3600 + minutes * 60) * (suffix.hasPrefix("-") ? -1 : 1)
                formatter.timeZone = TimeZone(secondsFromGMT: offset)
                formatter.dateFormat = value.contains(".") ? "yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX" : "yyyy-MM-dd'T'HH:mm:ssXXXXX"
            }
            guard let date = formatter.date(from: value) else { throw GuardFailure("invalid local time") }
            // Round-trip wall-clock components in the requested zone to reject DST gaps and normalization.
            let local = DateFormatter(); local.locale = formatter.locale; local.calendar = formatter.calendar; local.timeZone = zone
            local.dateFormat = allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm:ss"
            guard local.string(from: date) == (allDay ? value : String(value.prefix(19))) else { throw GuardFailure("time zone offset mismatch or DST gap") }
            return date
        }
        let first = try parse(start), last = try parse(end)
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = zone
        guard last > first, let limit = calendar.date(byAdding: .day, value: 31, to: first), last <= limit,
              let lower = calendar.date(byAdding: .day, value: -365, to: now),
              let upper = calendar.date(byAdding: .day, value: 3650, to: now), first >= lower, first <= upper else { throw GuardFailure("interval outside allowed bounds") }
        return (first, last, zone)
    }
}
