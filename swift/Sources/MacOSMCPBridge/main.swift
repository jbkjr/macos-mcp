import Foundation
import Dispatch
import EventKit

// MARK: - Output Structures & JSON Models
struct StandardOutput<T: Codable>: Codable { let status = "success"; let result: T }
struct ErrorOutput: Codable { let status = "error"; let message: String }

// Calendar Models
struct CalendarJSON: Codable { let id: String, title: String }
struct EventJSON: Codable { let id: String, title: String, calendar: String, startDate: String, endDate: String, notes: String?, location: String?, url: String?, isAllDay: Bool }
struct EventsReadResult: Codable { let calendars: [CalendarJSON]; let events: [EventJSON] }
struct DeleteResult: Codable { let id: String; let deleted = true }

// Reminder Models
struct ListJSON: Codable { let id: String, title: String }

// Recurrence Models
struct DayOfWeekJSON: Codable {
    let dayOfWeek: Int
    let weekNumber: Int?
}

struct RecurrenceEndJSON: Codable {
    let type: String  // "never", "date", "count"
    let date: String?
    let count: Int?
}

struct RecurrenceRuleJSON: Codable {
    let frequency: String  // "daily", "weekly", "monthly", "yearly"
    let interval: Int
    let daysOfTheWeek: [DayOfWeekJSON]?
    let daysOfTheMonth: [Int]?
    let monthsOfTheYear: [Int]?
    let weeksOfTheYear: [Int]?
    let daysOfTheYear: [Int]?
    let setPositions: [Int]?
    let end: RecurrenceEndJSON?
}

struct ReminderJSON: Codable { let id: String, title: String, isCompleted: Bool, list: String, notes: String?, url: String?, dueDate: String?, recurrence: RecurrenceRuleJSON? }
struct ReadResult: Codable { let lists: [ListJSON]; let reminders: [ReminderJSON] }
struct DeleteListResult: Codable { let title: String; let deleted = true }

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

private func formatterWithBaseLocale() -> DateFormatter {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian)
    return formatter
}

private func normalizedComponents(_ components: inout DateComponents, using calendar: Calendar, timeZone: TimeZone) {
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

private func parseDateComponents(from dateString: String) -> DateComponents? {
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
            normalizedComponents(&components, using: calendar, timeZone: TimeZone.current)
            return components
        }
    }

    return nil
}

func parseDate(from dateString: String) -> Date? {
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

// MARK: - Date Formatting Helper
private func formatDueDateWithTimezone(from dateComponents: DateComponents?, timeZoneHint: TimeZone?) -> String? {
    guard var components = dateComponents else {
        return nil
    }

    let timeZone = components.timeZone
        ?? timeZoneHint
        ?? components.calendar?.timeZone
        ?? TimeZone.current
    var calendar = components.calendar ?? Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone

    components.calendar = calendar
    components.timeZone = timeZone
    guard let date = calendar.date(from: components) else { return nil }

    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = timeZone
    formatter.calendar = calendar

    if components.hour != nil {
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZZZZZ"
    } else {
        formatter.dateFormat = "yyyy-MM-ddZZZZZ"
    }

    return formatter.string(from: date)
}

private func formatEventDate(_ date: Date, preferredTimeZone: TimeZone, includeTime: Bool) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.timeZone = preferredTimeZone
    formatter.dateFormat = includeTime ? "yyyy-MM-dd'T'HH:mm:ssZZZZZ" : "yyyy-MM-ddZZZZZ"
    return formatter.string(from: date)
}

// MARK: - Recurrence Rule Helpers
private func frequencyToString(_ frequency: EKRecurrenceFrequency) -> String {
    switch frequency {
    case .daily: return "daily"
    case .weekly: return "weekly"
    case .monthly: return "monthly"
    case .yearly: return "yearly"
    @unknown default: return "daily"
    }
}

private func stringToFrequency(_ string: String) -> EKRecurrenceFrequency {
    switch string.lowercased() {
    case "daily": return .daily
    case "weekly": return .weekly
    case "monthly": return .monthly
    case "yearly": return .yearly
    default: return .daily
    }
}

private func recurrenceRuleToJSON(_ rule: EKRecurrenceRule) -> RecurrenceRuleJSON {
    let frequency = frequencyToString(rule.frequency)
    let interval = rule.interval

    // Convert daysOfTheWeek
    let daysOfTheWeek: [DayOfWeekJSON]? = rule.daysOfTheWeek?.map { day in
        DayOfWeekJSON(dayOfWeek: day.dayOfTheWeek.rawValue, weekNumber: day.weekNumber == 0 ? nil : day.weekNumber)
    }

    // Convert daysOfTheMonth (NSNumber array)
    let daysOfTheMonth: [Int]? = rule.daysOfTheMonth?.map { $0.intValue }

    // Convert monthsOfTheYear (NSNumber array)
    let monthsOfTheYear: [Int]? = rule.monthsOfTheYear?.map { $0.intValue }

    // Convert weeksOfTheYear (NSNumber array)
    let weeksOfTheYear: [Int]? = rule.weeksOfTheYear?.map { $0.intValue }

    // Convert daysOfTheYear (NSNumber array)
    let daysOfTheYear: [Int]? = rule.daysOfTheYear?.map { $0.intValue }

    // Convert setPositions (NSNumber array)
    let setPositions: [Int]? = rule.setPositions?.map { $0.intValue }

    // Convert recurrence end
    var end: RecurrenceEndJSON? = nil
    if let recurrenceEnd = rule.recurrenceEnd {
        if let endDate = recurrenceEnd.endDate {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZZZZZ"
            formatter.timeZone = TimeZone.current
            end = RecurrenceEndJSON(type: "date", date: formatter.string(from: endDate), count: nil)
        } else if recurrenceEnd.occurrenceCount > 0 {
            end = RecurrenceEndJSON(type: "count", date: nil, count: recurrenceEnd.occurrenceCount)
        }
    }

    return RecurrenceRuleJSON(
        frequency: frequency,
        interval: interval,
        daysOfTheWeek: daysOfTheWeek,
        daysOfTheMonth: daysOfTheMonth,
        monthsOfTheYear: monthsOfTheYear,
        weeksOfTheYear: weeksOfTheYear,
        daysOfTheYear: daysOfTheYear,
        setPositions: setPositions,
        end: end
    )
}

private func parseRecurrenceRule(from jsonString: String) -> EKRecurrenceRule? {
    guard !jsonString.isEmpty else { return nil }

    guard let data = jsonString.data(using: .utf8),
          let json = try? JSONDecoder().decode(RecurrenceRuleJSON.self, from: data) else {
        return nil
    }

    let frequency = stringToFrequency(json.frequency)
    let interval = json.interval

    // Convert daysOfTheWeek
    var daysOfTheWeek: [EKRecurrenceDayOfWeek]? = nil
    if let days = json.daysOfTheWeek {
        daysOfTheWeek = days.compactMap { dayJSON in
            guard let weekday = EKWeekday(rawValue: dayJSON.dayOfWeek) else { return nil }
            if let weekNumber = dayJSON.weekNumber {
                return EKRecurrenceDayOfWeek(weekday, weekNumber: weekNumber)
            }
            return EKRecurrenceDayOfWeek(weekday)
        }
    }

    // Convert arrays to NSNumber arrays
    let daysOfTheMonth: [NSNumber]? = json.daysOfTheMonth?.map { NSNumber(value: $0) }
    let monthsOfTheYear: [NSNumber]? = json.monthsOfTheYear?.map { NSNumber(value: $0) }
    let weeksOfTheYear: [NSNumber]? = json.weeksOfTheYear?.map { NSNumber(value: $0) }
    let daysOfTheYear: [NSNumber]? = json.daysOfTheYear?.map { NSNumber(value: $0) }
    let setPositions: [NSNumber]? = json.setPositions?.map { NSNumber(value: $0) }

    // Convert recurrence end
    var recurrenceEnd: EKRecurrenceEnd? = nil
    if let end = json.end {
        switch end.type {
        case "date":
            if let dateStr = end.date, let date = parseDate(from: dateStr) {
                recurrenceEnd = EKRecurrenceEnd(end: date)
            }
        case "count":
            if let count = end.count {
                recurrenceEnd = EKRecurrenceEnd(occurrenceCount: count)
            }
        default:
            break // "never" or unknown = no end
        }
    }

    return EKRecurrenceRule(
        recurrenceWith: frequency,
        interval: interval,
        daysOfTheWeek: daysOfTheWeek,
        daysOfTheMonth: daysOfTheMonth,
        monthsOfTheYear: monthsOfTheYear,
        weeksOfTheYear: weeksOfTheYear,
        daysOfTheYear: daysOfTheYear,
        setPositions: setPositions,
        end: recurrenceEnd
    )
}

// MARK: - EventKitManager Class
class EventKitManager {
    private let eventStore = EKEventStore()

    // MARK: - Permission Status Checking
    func checkRemindersAuthorizationStatus() -> EKAuthorizationStatus {
        return EKEventStore.authorizationStatus(for: .reminder)
    }

    func checkCalendarAuthorizationStatus() -> EKAuthorizationStatus {
        return EKEventStore.authorizationStatus(for: .event)
    }

    func requestRemindersAccess(completion: @escaping (Bool, Error?) -> Void) {
        if #available(macOS 14.0, *) { eventStore.requestFullAccessToReminders(completion: completion) }
        else { eventStore.requestAccess(to: .reminder, completion: completion) }
    }

    func requestCalendarAccess(completion: @escaping (Bool, Error?) -> Void) {
        if #available(macOS 14.0, *) {
            eventStore.requestFullAccessToEvents(completion: completion)
        } else {
            eventStore.requestAccess(to: .event, completion: completion)
        }
    }

    // MARK: - Calendar Operations
    private func findCalendar(named name: String?) throws -> EKCalendar {
        guard let calName = name, !calName.isEmpty else {
            guard let defaultCal = eventStore.defaultCalendarForNewEvents else {
                throw NSError(domain: "", code: 404, userInfo: [NSLocalizedDescriptionKey: "No default calendar available."])
            }
            return defaultCal
        }
        guard let calendar = eventStore.calendars(for: .event).first(where: { $0.title == calName }) else {
            throw NSError(domain: "", code: 404, userInfo: [NSLocalizedDescriptionKey: "Calendar '\(calName)' not found."])
        }
        return calendar
    }

    func getCalendars() -> [CalendarJSON] {
        return eventStore.calendars(for: .event).map { CalendarJSON(id: $0.calendarIdentifier, title: $0.title) }
    }

    func getEvents(startDate: Date?, endDate: Date?, calendarName: String?, search: String?) throws -> [EventJSON] {
        let calendars = calendarName != nil ? [try findCalendar(named: calendarName)] : eventStore.calendars(for: .event)
        let predicate = eventStore.predicateForEvents(withStart: startDate ?? Date.distantPast, end: endDate ?? Date.distantFuture, calendars: calendars)

        let events = eventStore.events(matching: predicate)
        var filtered = events

        if let searchTerm = search?.lowercased() {
            filtered = filtered.filter {
                $0.title.lowercased().contains(searchTerm) ||
                ($0.notes?.lowercased().contains(searchTerm) ?? false) ||
                ($0.location?.lowercased().contains(searchTerm) ?? false)
            }
        }

        return filtered.map { $0.toJSON() }
    }

    func getEvent(id: String) -> EventJSON? {
        return eventStore.event(withIdentifier: id)?.toJSON()
    }

    func createEvent(title: String, calendarName: String?, startDateString: String, endDateString: String, notes: String?, location: String?, urlString: String?, isAllDay: Bool?) throws -> EventJSON {
        let event = EKEvent(eventStore: eventStore)
        event.calendar = try findCalendar(named: calendarName)
        event.title = title

        guard let startDate = parseDate(from: startDateString),
              let endDate = parseDate(from: endDateString) else {
            throw NSError(domain: "", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid date format. Use 'YYYY-MM-DD HH:mm:ss' or ISO 8601 format."])
        }

        event.startDate = startDate
        event.endDate = endDate
        event.isAllDay = isAllDay ?? false

        if let notesStr = notes { event.notes = notesStr }
        if let locationStr = location { event.location = locationStr }
        if let urlStr = urlString, !urlStr.isEmpty, let url = URL(string: urlStr) {
            event.url = url
        }

        try eventStore.save(event, span: .thisEvent, commit: true)
        return event.toJSON()
    }

    func updateEvent(id: String, title: String?, calendarName: String?, startDateString: String?, endDateString: String?, notes: String?, location: String?, urlString: String?, isAllDay: Bool?) throws -> EventJSON {
        guard let event = eventStore.event(withIdentifier: id) else {
            throw NSError(domain: "", code: 404, userInfo: [NSLocalizedDescriptionKey: "Event with ID '\(id)' not found."])
        }

        if let newTitle = title { event.title = newTitle }
        if let newCalendar = calendarName { event.calendar = try findCalendar(named: newCalendar) }

        if let startStr = startDateString {
            guard let startDate = parseDate(from: startStr) else {
                throw NSError(domain: "", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid start date format."])
            }
            event.startDate = startDate
        }

        if let endStr = endDateString {
            guard let endDate = parseDate(from: endStr) else {
                throw NSError(domain: "", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid end date format."])
            }
            event.endDate = endDate
        }

        if let notesStr = notes { event.notes = notesStr }
        if let locationStr = location { event.location = locationStr }
        if let urlStr = urlString {
            if urlStr.isEmpty {
                event.url = nil
            } else if let url = URL(string: urlStr) {
                event.url = url
            }
        }
        if let allDay = isAllDay { event.isAllDay = allDay }

        try eventStore.save(event, span: .thisEvent, commit: true)
        return event.toJSON()
    }

    func deleteEvent(id: String) throws {
        guard let event = eventStore.event(withIdentifier: id) else {
            throw NSError(domain: "", code: 404, userInfo: [NSLocalizedDescriptionKey: "Event with ID '\(id)' not found."])
        }
        try eventStore.remove(event, span: .thisEvent, commit: true)
    }

    // MARK: - Reminder Operations
    private func findReminder(withId id: String) -> EKReminder? {
        eventStore.calendarItem(withIdentifier: id) as? EKReminder
    }

    private func findList(named name: String?) throws -> EKCalendar {
        guard let listName = name, !listName.isEmpty else {
            return eventStore.defaultCalendarForNewReminders()!
        }
        guard let list = eventStore.calendars(for: .reminder).first(where: { $0.title == listName }) else {
            throw NSError(domain: "", code: 404, userInfo: [NSLocalizedDescriptionKey: "List '\(listName)' not found."])
        }
        return list
    }

    func getLists() -> [ListJSON] {
        return eventStore.calendars(for: .reminder).map { ListJSON(id: $0.calendarIdentifier, title: $0.title) }
    }

    func getReminders(showCompleted: Bool, filterList: String?, search: String?, dueWithin: String?) throws -> [ReminderJSON] {
        let predicate = eventStore.predicateForReminders(in: nil)
        let semaphore = DispatchSemaphore(value: 0)
        var fetchedReminders: [EKReminder]?
        eventStore.fetchReminders(matching: predicate) { reminders in fetchedReminders = reminders; semaphore.signal() }
        semaphore.wait()

        guard let reminders = fetchedReminders else { return [] }

        var filtered = reminders
        if !showCompleted { filtered = filtered.filter { !$0.isCompleted } }
        if let listName = filterList { filtered = filtered.filter { $0.calendar.title == listName } }
        if let searchTerm = search?.lowercased() {
            filtered = filtered.filter {
                $0.title.lowercased().contains(searchTerm) || ($0.notes?.lowercased().contains(searchTerm) ?? false)
            }
        }
        if let dueFilter = dueWithin {
            let now = Date()
            let todayStart = Calendar.current.startOfDay(for: now)
            filtered = filtered.filter { reminder in
                guard let dueDate = reminder.dueDateComponents?.date else { return dueFilter == "no-date" }
                if dueFilter == "overdue" { return dueDate < todayStart }
                if dueFilter == "today" { return Calendar.current.isDateInToday(dueDate) }
                if dueFilter == "tomorrow" { return Calendar.current.isDateInTomorrow(dueDate) }
                if dueFilter == "this-week" {
                    guard let weekInterval = Calendar.current.dateInterval(of: .weekOfYear, for: now) else { return false }
                    return weekInterval.contains(dueDate)
                }
                return false
            }
        }
        return filtered.map { $0.toJSON() }
    }

    func getReminder(id: String) -> ReminderJSON? {
        return findReminder(withId: id)?.toJSON()
    }

    func createReminder(title: String, listName: String?, notes: String?, urlString: String?, dueDateString: String?, recurrenceString: String?) throws -> ReminderJSON {
        let reminder = EKReminder(eventStore: eventStore)
        reminder.calendar = try findList(named: listName)
        reminder.title = title

        var finalNotes = notes
        if let urlStr = urlString, !urlStr.isEmpty, let url = URL(string: urlStr) {
            reminder.url = url
            let urlInNotes = notes?.contains(urlStr) ?? false
            if !urlInNotes {
                if let existingNotes = notes, !existingNotes.isEmpty {
                    finalNotes = existingNotes + "\n\nURLs:\n- " + urlStr
                } else {
                    finalNotes = "URLs:\n- " + urlStr
                }
            }
        }
        if let finalNotes = finalNotes { reminder.notes = finalNotes }

        if let dateStr = dueDateString {
            if let parsedComponents = parseDateComponents(from: dateStr) {
                reminder.dueDateComponents = parsedComponents
                reminder.timeZone = parsedComponents.timeZone
            }
        }

        // Apply recurrence rule
        if let recurrenceStr = recurrenceString, !recurrenceStr.isEmpty,
           let rule = parseRecurrenceRule(from: recurrenceStr) {
            reminder.recurrenceRules = [rule]
        }

        try eventStore.save(reminder, commit: true)
        return reminder.toJSON()
    }

    func updateReminder(id: String, newTitle: String?, listName: String?, notes: String?, urlString: String?, isCompleted: Bool?, dueDateString: String?, recurrenceString: String?) throws -> ReminderJSON {
        guard let reminder = findReminder(withId: id) else {
            throw NSError(domain: "", code: 404, userInfo: [NSLocalizedDescriptionKey: "ID '\(id)' not found."])
        }
        if let newTitle = newTitle { reminder.title = newTitle }

        var finalNotes: String?

        if let urlStr = urlString, !urlStr.isEmpty, let url = URL(string: urlStr) {
            reminder.url = url
            if let newNotes = notes {
                let urlInNewNotes = newNotes.contains(urlStr)
                if !urlInNewNotes {
                    finalNotes = newNotes.isEmpty ? "URLs:\n- " + urlStr : newNotes + "\n\nURLs:\n- " + urlStr
                } else {
                    finalNotes = newNotes
                }
            } else {
                let urlInOriginalNotes = reminder.notes?.contains(urlStr) ?? false
                if !urlInOriginalNotes {
                    if let existingNotes = reminder.notes, !existingNotes.isEmpty {
                        finalNotes = existingNotes + "\n\nURLs:\n- " + urlStr
                    } else {
                        finalNotes = "URLs:\n- " + urlStr
                    }
                } else {
                    finalNotes = reminder.notes
                }
            }
        } else if let newNotes = notes {
            finalNotes = newNotes
        } else {
            finalNotes = reminder.notes
        }

        if let finalNotes = finalNotes { reminder.notes = finalNotes }

        if let isCompleted = isCompleted { reminder.isCompleted = isCompleted }
        if let listName = listName { reminder.calendar = try findList(named: listName) }
        if let dateStr = dueDateString {
            if let parsedComponents = parseDateComponents(from: dateStr) {
                reminder.dueDateComponents = parsedComponents
                reminder.timeZone = parsedComponents.timeZone
            } else {
                reminder.dueDateComponents = nil
                reminder.timeZone = nil
            }
        }

        // Handle recurrence: empty string = remove, non-empty = set/update
        if let recurrenceStr = recurrenceString {
            if recurrenceStr.isEmpty {
                reminder.recurrenceRules = nil
            } else if let rule = parseRecurrenceRule(from: recurrenceStr) {
                reminder.recurrenceRules = [rule]
            }
        }

        try eventStore.save(reminder, commit: true)
        return reminder.toJSON()
    }

    func deleteReminder(id: String) throws {
        guard let reminder = findReminder(withId: id) else {
            throw NSError(domain: "", code: 404, userInfo: [NSLocalizedDescriptionKey: "Reminder with ID '\(id)' not found."])
        }
        try eventStore.remove(reminder, commit: true)
    }

    func createList(title: String) throws -> ListJSON {
        let list = EKCalendar(for: .reminder, eventStore: eventStore)
        list.title = title
        list.source = eventStore.defaultCalendarForNewReminders()?.source
        try eventStore.saveCalendar(list, commit: true)
        return ListJSON(id: list.calendarIdentifier, title: list.title)
    }

    func updateList(currentName: String, newName: String) throws -> ListJSON {
        let list = try findList(named: currentName)
        list.title = newName
        try eventStore.saveCalendar(list, commit: true)
        return ListJSON(id: list.calendarIdentifier, title: list.title)
    }

    func deleteList(title: String) throws {
        try eventStore.removeCalendar(try findList(named: title), commit: true)
    }
}

// MARK: - Extensions
extension EKReminder {
    func toJSON() -> ReminderJSON {
        // Get recurrence rule if present
        let recurrence: RecurrenceRuleJSON? = self.recurrenceRules?.first.map { recurrenceRuleToJSON($0) }

        return ReminderJSON(
            id: self.calendarItemIdentifier,
            title: self.title,
            isCompleted: self.isCompleted,
            list: self.calendar.title,
            notes: self.notes,
            url: self.url?.absoluteString,
            dueDate: formatDueDateWithTimezone(from: self.dueDateComponents, timeZoneHint: self.timeZone),
            recurrence: recurrence
        )
    }
}

extension EKEvent {
    func toJSON() -> EventJSON {
        let eventTimeZone = self.timeZone ?? TimeZone.current
        let includeTime = !self.isAllDay

        return EventJSON(
            id: self.eventIdentifier,
            title: self.title,
            calendar: self.calendar.title,
            startDate: formatEventDate(self.startDate, preferredTimeZone: eventTimeZone, includeTime: includeTime),
            endDate: formatEventDate(self.endDate, preferredTimeZone: eventTimeZone, includeTime: includeTime),
            notes: self.notes,
            location: self.location,
            url: self.url?.absoluteString,
            isAllDay: self.isAllDay
        )
    }
}

// MARK: - Argument Parser
struct ArgumentParser {
    private let args: [String: String]

    init() {
        var dict = [String: String]()
        var i = 0
        let arguments = Array(CommandLine.arguments.dropFirst())
        while i < arguments.count {
            let key = arguments[i].replacingOccurrences(of: "--", with: "")
            if i + 1 < arguments.count && !arguments[i + 1].hasPrefix("--") {
                dict[key] = arguments[i + 1]
                i += 2
            } else {
                dict[key] = "true"
                i += 1
            }
        }
        self.args = dict
    }

    func get(_ key: String) -> String? {
        return args[key]
    }
}

// MARK: - Permission Handling
enum PermissionDomain: String {
    case calendars = "Calendars"
    case reminders = "Reminders"

    var settingsPath: String { "System Settings > Privacy & Security > \(rawValue)" }
}

func handlePermission(
    status: EKAuthorizationStatus,
    domain: PermissionDomain,
    requestAccess: (@escaping (Bool, Error?) -> Void) -> Void,
    onGranted: @escaping () -> Void,
    onError: @escaping (String) -> Never
) {
    switch status {
    case .authorized, .fullAccess:
        onGranted()
    case .notDetermined:
        requestAccess { granted, error in
            guard granted else {
                let errorMsg = error?.localizedDescription ?? "Unknown error"
                _ = onError("\(domain.rawValue) permission denied. \(errorMsg)\n\nPlease grant \(domain.rawValue.lowercased()) permissions in:\n\(domain.settingsPath)")
                return
            }
            onGranted()
        }
    case .denied, .restricted:
        _ = onError("\(domain.rawValue) permission denied or restricted.\n\nPlease grant \(domain.rawValue.lowercased()) permissions in:\n\(domain.settingsPath)")
    case .writeOnly:
        _ = onError("\(domain.rawValue) permission is write-only, but read access is required.\n\nPlease grant full \(domain.rawValue.lowercased()) permissions in:\n\(domain.settingsPath)")
    @unknown default:
        _ = onError("Unknown \(domain.rawValue.lowercased()) permission status.")
    }
}

// MARK: - Main
func main() {
    let parser = ArgumentParser()
    let manager = EventKitManager()
    let encoder = JSONEncoder()
    encoder.outputFormatting = .prettyPrinted

    func outputError(_ message: String) -> Never {
        if let data = try? encoder.encode(ErrorOutput(message: message)),
           let json = String(data: data, encoding: .utf8) {
            print(json)
        }
        exit(1)
    }

    func outputResult<T: Codable>(_ result: T) throws {
        print(String(data: try encoder.encode(StandardOutput(result: result)), encoding: .utf8)!)
    }

    func requireArg(_ key: String) throws -> String {
        guard let value = parser.get(key) else {
            throw NSError(domain: "", code: 400, userInfo: [NSLocalizedDescriptionKey: "--\(key) required."])
        }
        return value
    }

    let action = parser.get("action") ?? ""
    let calendarActions = Set(["read-calendars", "read-events", "get-event", "create-event", "update-event", "delete-event"])
    let reminderActions = Set(["read-lists", "read-reminders", "get-reminder", "create-reminder", "update-reminder", "delete-reminder", "create-list", "update-list", "delete-list"])

    let isCalendarAction = calendarActions.contains(action)
    let isReminderAction = reminderActions.contains(action)

    func handleAction() {
        do {
            switch action {
            // Calendar actions
            case "read-calendars":
                try outputResult(manager.getCalendars())
            case "read-events":
                let startDate = parser.get("startDate").flatMap { parseDate(from: $0) }
                let endDate = parser.get("endDate").flatMap { parseDate(from: $0) }
                let events = try manager.getEvents(startDate: startDate, endDate: endDate, calendarName: parser.get("filterCalendar"), search: parser.get("search"))
                try outputResult(EventsReadResult(calendars: manager.getCalendars(), events: events))
            case "get-event":
                let id = try requireArg("id")
                guard let event = manager.getEvent(id: id) else {
                    throw NSError(domain: "", code: 404, userInfo: [NSLocalizedDescriptionKey: "Event with ID '\(id)' not found."])
                }
                try outputResult(event)
            case "create-event":
                let event = try manager.createEvent(
                    title: try requireArg("title"),
                    calendarName: parser.get("targetCalendar"),
                    startDateString: try requireArg("startDate"),
                    endDateString: try requireArg("endDate"),
                    notes: parser.get("note"),
                    location: parser.get("location"),
                    urlString: parser.get("url"),
                    isAllDay: parser.get("isAllDay").map { $0 == "true" }
                )
                try outputResult(event)
            case "update-event":
                let event = try manager.updateEvent(
                    id: try requireArg("id"),
                    title: parser.get("title"),
                    calendarName: parser.get("targetCalendar"),
                    startDateString: parser.get("startDate"),
                    endDateString: parser.get("endDate"),
                    notes: parser.get("note"),
                    location: parser.get("location"),
                    urlString: parser.get("url"),
                    isAllDay: parser.get("isAllDay").map { $0 == "true" }
                )
                try outputResult(event)
            case "delete-event":
                let id = try requireArg("id")
                try manager.deleteEvent(id: id)
                try outputResult(DeleteResult(id: id))

            // Reminder actions
            case "read-lists":
                try outputResult(manager.getLists())
            case "read-reminders":
                let reminders = try manager.getReminders(
                    showCompleted: parser.get("showCompleted") == "true",
                    filterList: parser.get("filterList"),
                    search: parser.get("search"),
                    dueWithin: parser.get("dueWithin")
                )
                try outputResult(ReadResult(lists: manager.getLists(), reminders: reminders))
            case "get-reminder":
                let id = try requireArg("id")
                guard let reminder = manager.getReminder(id: id) else {
                    throw NSError(domain: "", code: 404, userInfo: [NSLocalizedDescriptionKey: "Reminder with ID '\(id)' not found."])
                }
                try outputResult(reminder)
            case "create-reminder":
                let reminder = try manager.createReminder(
                    title: try requireArg("title"),
                    listName: parser.get("targetList"),
                    notes: parser.get("note"),
                    urlString: parser.get("url"),
                    dueDateString: parser.get("dueDate"),
                    recurrenceString: parser.get("recurrence")
                )
                try outputResult(reminder)
            case "update-reminder":
                let reminder = try manager.updateReminder(
                    id: try requireArg("id"),
                    newTitle: parser.get("title"),
                    listName: parser.get("targetList"),
                    notes: parser.get("note"),
                    urlString: parser.get("url"),
                    isCompleted: parser.get("completed").map { $0 == "true" },
                    dueDateString: parser.get("dueDate"),
                    recurrenceString: parser.get("recurrence")
                )
                try outputResult(reminder)
            case "delete-reminder":
                let id = try requireArg("id")
                try manager.deleteReminder(id: id)
                try outputResult(DeleteResult(id: id))
            case "create-list":
                try outputResult(try manager.createList(title: try requireArg("name")))
            case "update-list":
                try outputResult(try manager.updateList(currentName: try requireArg("name"), newName: try requireArg("newName")))
            case "delete-list":
                let name = try requireArg("name")
                try manager.deleteList(title: name)
                try outputResult(DeleteListResult(title: name))

            default:
                throw NSError(domain: "", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid or missing --action. Valid actions: read-calendars, read-events, get-event, create-event, update-event, delete-event, read-lists, read-reminders, get-reminder, create-reminder, update-reminder, delete-reminder, create-list, update-list, delete-list"])
            }
        } catch {
            outputError(error.localizedDescription)
        }
        exit(0)
    }

    // Check and request permissions
    if isCalendarAction {
        handlePermission(
            status: manager.checkCalendarAuthorizationStatus(),
            domain: .calendars,
            requestAccess: manager.requestCalendarAccess,
            onGranted: handleAction,
            onError: outputError
        )
    } else if isReminderAction {
        handlePermission(
            status: manager.checkRemindersAuthorizationStatus(),
            domain: .reminders,
            requestAccess: manager.requestRemindersAccess,
            onGranted: handleAction,
            onError: outputError
        )
    } else {
        outputError("Invalid action. Use --action with a valid action name.")
    }

    RunLoop.main.run()
}

main()
