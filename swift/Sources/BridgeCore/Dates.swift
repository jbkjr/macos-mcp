import Foundation

// MARK: - Date Parsing Helper
private struct ExplicitTimezone {
    let suffix: String
    let timeZone: TimeZone
}

private func detectExplicitTimezone(in dateString: String) -> ExplicitTimezone? {
    let trimmed = dateString.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.hasSuffix("Z") {
        guard let tz = TimeZone(secondsFromGMT: 0) else { return nil }
        return ExplicitTimezone(suffix: "Z", timeZone: tz)
    }

    let pattern = #"[+-]\d{2}:\d{2}$|[+-]\d{4}$|[+-]\d{2}$"#
    guard let range = trimmed.range(of: pattern, options: .regularExpression) else {
        return nil
    }

    let suffix = String(trimmed[range])
    let sign: Int = suffix.first == "-" ? -1 : 1
    let numeric = suffix.dropFirst()

    let components: (hours: Int, minutes: Int)? = {
        if suffix.contains(":") {
            let parts = numeric.split(separator: ":")
            guard parts.count == 2,
                  let hourValue = Int(parts[0]),
                  let minuteValue = Int(parts[1]) else { return nil }
            return (hourValue, minuteValue)
        }
        if numeric.count == 4 {
            let hoursPart = numeric.prefix(2)
            let minutesPart = numeric.suffix(2)
            guard let hourValue = Int(hoursPart),
                  let minuteValue = Int(minutesPart) else { return nil }
            return (hourValue, minuteValue)
        }
        if numeric.count == 2, let hourValue = Int(numeric) {
            return (hourValue, 0)
        }
        return nil
    }()

    guard let offset = components else { return nil }
    let totalSeconds = sign * ((offset.hours * 60 + offset.minutes) * 60)
    guard let timeZone = TimeZone(secondsFromGMT: totalSeconds) else { return nil }
    return ExplicitTimezone(suffix: suffix, timeZone: timeZone)
}

public func formatterWithBaseLocale() -> DateFormatter {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian)
    return formatter
}

public func normalizedComponents(_ components: inout DateComponents, using calendar: Calendar, timeZone: TimeZone?) {
    components.calendar = calendar
    components.timeZone = timeZone
    if components.second == nil && components.hour != nil { components.second = 0 }
    if components.nanosecond != nil { components.nanosecond = 0 }
}

private func componentsSet(for input: String) -> Set<Calendar.Component> {
    if input.contains(":") || input.contains("T") {
        return [.year, .month, .day, .hour, .minute, .second]
    }
    return [.year, .month, .day]
}

public func parseDateComponents(from dateString: String) -> DateComponents? {
    let trimmedInput = dateString.trimmingCharacters(in: .whitespacesAndNewlines)

    if let tzInfo = detectExplicitTimezone(in: trimmedInput) {
        let formatter = formatterWithBaseLocale()
        formatter.timeZone = tzInfo.timeZone

        let formatsWithTimezone = [
            "yyyy-MM-dd'T'HH:mm:ss.SSSZZZZZ",
            "yyyy-MM-dd HH:mm:ss.SSSZZZZZ",
            "yyyy-MM-dd'T'HH:mm:ssZZZZZ",
            "yyyy-MM-dd HH:mm:ssZZZZZ",
            "yyyy-MM-dd'T'HH:mmZZZZZ",
            "yyyy-MM-dd HH:mmZZZZZ",
            "yyyy-MM-ddZZZZZ",
            "yyyy-MM-dd'T'HH:mm:ss.SSSZZZ",
            "yyyy-MM-dd HH:mm:ss.SSSZZZ",
            "yyyy-MM-dd'T'HH:mm:ssZZZ",
            "yyyy-MM-dd HH:mm:ssZZZ",
            "yyyy-MM-dd'T'HH:mmZZZ",
            "yyyy-MM-dd HH:mmZZZ",
            "yyyy-MM-ddZZZ",
            "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
            "yyyy-MM-dd HH:mm:ss.SSSZ",
            "yyyy-MM-dd'T'HH:mm:ssZ",
            "yyyy-MM-dd HH:mm:ssZ",
            "yyyy-MM-dd'T'HH:mmZ",
            "yyyy-MM-dd HH:mmZ",
            "yyyy-MM-ddZ"
        ]

        for format in formatsWithTimezone {
            formatter.dateFormat = format
            if let parsedDate = formatter.date(from: trimmedInput) {
                var calendar = Calendar(identifier: .gregorian)
                calendar.timeZone = tzInfo.timeZone
                var components = calendar.dateComponents(componentsSet(for: trimmedInput), from: parsedDate)
                normalizedComponents(&components, using: calendar, timeZone: tzInfo.timeZone)
                return components
            }
        }
    }

    let formatter = formatterWithBaseLocale()
    formatter.timeZone = TimeZone.current

    let localFormats = [
        "yyyy-MM-dd'T'HH:mm:ss.SSS",
        "yyyy-MM-dd HH:mm:ss.SSS",
        "yyyy-MM-dd'T'HH:mm:ss",
        "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-dd'T'HH:mm",
        "yyyy-MM-dd HH:mm",
        "yyyy-MM-dd"
    ]

    for format in localFormats {
        formatter.dateFormat = format
        if let parsedDate = formatter.date(from: trimmedInput) {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone.current
            var components = calendar.dateComponents(componentsSet(for: trimmedInput), from: parsedDate)
            normalizedComponents(&components, using: calendar, timeZone: nil)
            return components
        }
    }

    return nil
}

public func parseDate(from dateString: String) -> Date? {
    guard var components = parseDateComponents(from: dateString) else { return nil }
    let calendar: Calendar = {
        if let existing = components.calendar { return existing }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = components.timeZone ?? TimeZone.current
        return calendar
    }()
    components.calendar = calendar
    components.timeZone = components.timeZone ?? calendar.timeZone
    return calendar.date(from: components)
}

// MARK: - Due Date Argument

/// What an update or create should do with a reminder's due date.
public enum DueDateChange {
    case unchanged
    case clear
    case set(DateComponents)

    public var isChange: Bool {
        if case .unchanged = self { return false }
        return true
    }

    public var components: DateComponents? {
        if case .set(let components) = self { return components }
        return nil
    }
}

/// `parseDateComponents` rolls impossible values forward (Feb 30 becomes Mar 2, 24:30 the next day) and reads "26-03-20" as year 26.
private func hasRealCalendarDate(_ value: String) -> Bool {
    let pattern = #"^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}))?(?!\d)"#
    guard let regex = try? NSRegularExpression(pattern: pattern),
          let match = regex.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)),
          let yearRange = Range(match.range(at: 1), in: value),
          let monthRange = Range(match.range(at: 2), in: value),
          let dayRange = Range(match.range(at: 3), in: value),
          let year = Int(value[yearRange]), let month = Int(value[monthRange]), let day = Int(value[dayRange]) else {
        return false
    }
    if let hourRange = Range(match.range(at: 4), in: value), let hour = Int(value[hourRange]), hour > 23 { return false }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    let components = DateComponents(calendar: calendar, year: year, month: month, day: day)
    return components.isValidDate(in: calendar)
}

/// nil leaves the due date alone, an empty string clears it, and anything else must parse or the call fails.
public func parseDueDateArgument(_ value: String?) throws -> DueDateChange {
    guard let value = value else { return .unchanged }
    if value.isEmpty { return .clear }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard hasRealCalendarDate(trimmed), let components = parseDateComponents(from: trimmed) else {
        throw NSError(domain: "", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid dueDate '\(value)'; nothing was changed. Use 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss' or ISO 8601, or an empty string to clear."])
    }
    return .set(components)
}
