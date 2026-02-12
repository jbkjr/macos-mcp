import Foundation
import Dispatch
import EventKit
import Contacts

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

struct ReminderJSON: Codable { let id: String, title: String, isCompleted: Bool, list: String, notes: String?, url: String?, dueDate: String?, recurrence: RecurrenceRuleJSON?, priority: String? }
struct ReadResult: Codable { let lists: [ListJSON]; let reminders: [ReminderJSON] }
struct DeleteListResult: Codable { let title: String; let deleted = true }

// Contact Models
struct ContactPhoneJSON: Codable { let label: String?; let number: String }
struct ContactEmailJSON: Codable { let label: String?; let email: String }
struct ContactPostalAddressJSON: Codable {
    let label: String?
    let street: String?
    let city: String?
    let state: String?
    let postalCode: String?
    let country: String?
    let isoCountryCode: String?
}
struct ContactURLJSON: Codable { let label: String?; let url: String }
struct ContactJSON: Codable {
    let id: String
    let fullName: String
    let givenName: String?
    let familyName: String?
    let middleName: String?
    let namePrefix: String?
    let nameSuffix: String?
    let nickname: String?
    let phoneNumbers: [ContactPhoneJSON]
    let emailAddresses: [ContactEmailJSON]
    let postalAddresses: [ContactPostalAddressJSON]
    let urlAddresses: [ContactURLJSON]
    let organizationName: String?
    let jobTitle: String?
    let departmentName: String?
    let birthday: String?
    let note: String?
    let imageAvailable: Bool
}
struct ContactSearchResult: Codable { let contacts: [ContactJSON] }
struct ContactListResult: Codable { let contacts: [ContactJSON]; let totalCount: Int }
struct ContactGroupJSON: Codable { let id: String; let name: String }

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

private func normalizedComponents(_ components: inout DateComponents, using calendar: Calendar, timeZone: TimeZone?) {
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
            normalizedComponents(&components, using: calendar, timeZone: nil)
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
    let daysOfTheWeek = rule.daysOfTheWeek?.map { day in
        DayOfWeekJSON(dayOfWeek: day.dayOfTheWeek.rawValue, weekNumber: day.weekNumber == 0 ? nil : day.weekNumber)
    }

    let end: RecurrenceEndJSON? = {
        guard let recurrenceEnd = rule.recurrenceEnd else { return nil }
        if let endDate = recurrenceEnd.endDate {
            let formatter = formatterWithBaseLocale()
            formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZZZZZ"
            formatter.timeZone = TimeZone.current
            return RecurrenceEndJSON(type: "date", date: formatter.string(from: endDate), count: nil)
        }
        if recurrenceEnd.occurrenceCount > 0 {
            return RecurrenceEndJSON(type: "count", date: nil, count: recurrenceEnd.occurrenceCount)
        }
        return nil
    }()

    return RecurrenceRuleJSON(
        frequency: frequencyToString(rule.frequency),
        interval: rule.interval,
        daysOfTheWeek: daysOfTheWeek,
        daysOfTheMonth: rule.daysOfTheMonth?.map { $0.intValue },
        monthsOfTheYear: rule.monthsOfTheYear?.map { $0.intValue },
        weeksOfTheYear: rule.weeksOfTheYear?.map { $0.intValue },
        daysOfTheYear: rule.daysOfTheYear?.map { $0.intValue },
        setPositions: rule.setPositions?.map { $0.intValue },
        end: end
    )
}

private func parseRecurrenceRule(from jsonString: String) -> EKRecurrenceRule? {
    guard !jsonString.isEmpty,
          let data = jsonString.data(using: .utf8),
          let json = try? JSONDecoder().decode(RecurrenceRuleJSON.self, from: data) else {
        return nil
    }

    let daysOfTheWeek = json.daysOfTheWeek?.compactMap { dayJSON -> EKRecurrenceDayOfWeek? in
        guard let weekday = EKWeekday(rawValue: dayJSON.dayOfWeek) else { return nil }
        if let weekNumber = dayJSON.weekNumber {
            return EKRecurrenceDayOfWeek(weekday, weekNumber: weekNumber)
        }
        return EKRecurrenceDayOfWeek(weekday)
    }

    let recurrenceEnd: EKRecurrenceEnd? = {
        guard let end = json.end else { return nil }
        switch end.type {
        case "date":
            guard let dateStr = end.date, let date = parseDate(from: dateStr) else { return nil }
            return EKRecurrenceEnd(end: date)
        case "count":
            guard let count = end.count else { return nil }
            return EKRecurrenceEnd(occurrenceCount: count)
        default:
            return nil
        }
    }()

    return EKRecurrenceRule(
        recurrenceWith: stringToFrequency(json.frequency),
        interval: json.interval,
        daysOfTheWeek: daysOfTheWeek,
        daysOfTheMonth: json.daysOfTheMonth?.map { NSNumber(value: $0) },
        monthsOfTheYear: json.monthsOfTheYear?.map { NSNumber(value: $0) },
        weeksOfTheYear: json.weeksOfTheYear?.map { NSNumber(value: $0) },
        daysOfTheYear: json.daysOfTheYear?.map { NSNumber(value: $0) },
        setPositions: json.setPositions?.map { NSNumber(value: $0) },
        end: recurrenceEnd
    )
}

// MARK: - Priority Helpers
private func priorityToString(_ priority: Int) -> String? {
    switch priority {
    case 1...4: return "high"
    case 5: return "medium"
    case 6...9: return "low"
    default: return nil  // 0 = none/no priority
    }
}

private func stringToPriority(_ string: String?) -> Int {
    guard let str = string?.lowercased() else { return 0 }
    switch str {
    case "high": return 1
    case "medium": return 5
    case "low": return 9
    default: return 0  // "none" or any other value
    }
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

    func getReminders(showCompleted: Bool, filterList: String?, search: String?, dueWithin: String?, priority: String?) throws -> [ReminderJSON] {
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
                if dueFilter == "scheduled" { return true }  // has due date
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
        if let priorityFilter = priority?.lowercased() {
            filtered = filtered.filter { reminder in
                if priorityFilter == "none" {
                    return reminder.priority == 0
                }
                // Map reminder priority to same bucket
                let reminderPriorityString = priorityToString(reminder.priority) ?? "none"
                return reminderPriorityString == priorityFilter
            }
        }
        return filtered.map { $0.toJSON() }
    }

    func getReminder(id: String) -> ReminderJSON? {
        return findReminder(withId: id)?.toJSON()
    }

    func createReminder(title: String, listName: String?, notes: String?, urlString: String?, dueDateString: String?, recurrenceString: String?, priorityString: String?) throws -> ReminderJSON {
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

        // Apply priority
        if let priorityStr = priorityString {
            reminder.priority = stringToPriority(priorityStr)
        }

        try eventStore.save(reminder, commit: true)
        return reminder.toJSON()
    }

    func updateReminder(id: String, newTitle: String?, listName: String?, notes: String?, urlString: String?, isCompleted: Bool?, dueDateString: String?, recurrenceString: String?, priorityString: String?) throws -> ReminderJSON {
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

        // Handle priority
        if let priorityStr = priorityString {
            reminder.priority = stringToPriority(priorityStr)
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

// MARK: - ContactsManager Class
class ContactsManager {
    private let contactStore = CNContactStore()

    private var fullKeysToFetch: [CNKeyDescriptor] {
        [
            CNContactIdentifierKey as CNKeyDescriptor,
            CNContactGivenNameKey as CNKeyDescriptor,
            CNContactFamilyNameKey as CNKeyDescriptor,
            CNContactMiddleNameKey as CNKeyDescriptor,
            CNContactNamePrefixKey as CNKeyDescriptor,
            CNContactNameSuffixKey as CNKeyDescriptor,
            CNContactNicknameKey as CNKeyDescriptor,
            CNContactPhoneNumbersKey as CNKeyDescriptor,
            CNContactEmailAddressesKey as CNKeyDescriptor,
            CNContactPostalAddressesKey as CNKeyDescriptor,
            CNContactUrlAddressesKey as CNKeyDescriptor,
            CNContactOrganizationNameKey as CNKeyDescriptor,
            CNContactJobTitleKey as CNKeyDescriptor,
            CNContactDepartmentNameKey as CNKeyDescriptor,
            CNContactBirthdayKey as CNKeyDescriptor,
            CNContactNoteKey as CNKeyDescriptor,
            CNContactImageDataAvailableKey as CNKeyDescriptor,
            CNContactFormatter.descriptorForRequiredKeys(for: .fullName)
        ]
    }

    func checkAuthorizationStatus() -> CNAuthorizationStatus {
        return CNContactStore.authorizationStatus(for: .contacts)
    }

    func requestAccess(completion: @escaping (Bool, Error?) -> Void) {
        contactStore.requestAccess(for: .contacts, completionHandler: completion)
    }

    private func contactToJSON(_ contact: CNContact) -> ContactJSON {
        let fullName = CNContactFormatter.string(from: contact, style: .fullName) ?? ""
        let phones = contact.phoneNumbers.map { phone in
            ContactPhoneJSON(
                label: CNLabeledValue<CNPhoneNumber>.localizedString(forLabel: phone.label ?? ""),
                number: phone.value.stringValue
            )
        }
        let emails = contact.emailAddresses.map { email in
            ContactEmailJSON(
                label: CNLabeledValue<NSString>.localizedString(forLabel: email.label ?? ""),
                email: email.value as String
            )
        }
        let addresses = contact.postalAddresses.map { addr in
            let value = addr.value
            return ContactPostalAddressJSON(
                label: CNLabeledValue<CNPostalAddress>.localizedString(forLabel: addr.label ?? ""),
                street: value.street.isEmpty ? nil : value.street,
                city: value.city.isEmpty ? nil : value.city,
                state: value.state.isEmpty ? nil : value.state,
                postalCode: value.postalCode.isEmpty ? nil : value.postalCode,
                country: value.country.isEmpty ? nil : value.country,
                isoCountryCode: value.isoCountryCode.isEmpty ? nil : value.isoCountryCode
            )
        }
        let urls = contact.urlAddresses.map { url in
            ContactURLJSON(
                label: CNLabeledValue<NSString>.localizedString(forLabel: url.label ?? ""),
                url: url.value as String
            )
        }
        let birthday: String? = {
            guard let bday = contact.birthday else { return nil }
            if let year = bday.year {
                return String(format: "%04d-%02d-%02d", year, bday.month ?? 1, bday.day ?? 1)
            }
            return String(format: "--%02d-%02d", bday.month ?? 1, bday.day ?? 1)
        }()

        return ContactJSON(
            id: contact.identifier,
            fullName: fullName,
            givenName: contact.givenName.isEmpty ? nil : contact.givenName,
            familyName: contact.familyName.isEmpty ? nil : contact.familyName,
            middleName: contact.middleName.isEmpty ? nil : contact.middleName,
            namePrefix: contact.namePrefix.isEmpty ? nil : contact.namePrefix,
            nameSuffix: contact.nameSuffix.isEmpty ? nil : contact.nameSuffix,
            nickname: contact.nickname.isEmpty ? nil : contact.nickname,
            phoneNumbers: phones,
            emailAddresses: emails,
            postalAddresses: addresses,
            urlAddresses: urls,
            organizationName: contact.organizationName.isEmpty ? nil : contact.organizationName,
            jobTitle: contact.jobTitle.isEmpty ? nil : contact.jobTitle,
            departmentName: contact.departmentName.isEmpty ? nil : contact.departmentName,
            birthday: birthday,
            note: contact.note.isEmpty ? nil : contact.note,
            imageAvailable: contact.imageDataAvailable
        )
    }

    func searchContacts(name: String?, phone: String?, email: String?) throws -> [ContactJSON] {
        var contacts: [CNContact] = []

        if let searchName = name, !searchName.isEmpty {
            let predicate = CNContact.predicateForContacts(matchingName: searchName)
            contacts = try contactStore.unifiedContacts(matching: predicate, keysToFetch: fullKeysToFetch)
        } else if let searchPhone = phone, !searchPhone.isEmpty {
            let normalizedPhone = normalizePhoneNumber(searchPhone)
            let predicate = CNContact.predicateForContacts(matching: CNPhoneNumber(stringValue: normalizedPhone))
            contacts = try contactStore.unifiedContacts(matching: predicate, keysToFetch: fullKeysToFetch)
        } else if let searchEmail = email, !searchEmail.isEmpty {
            let predicate = CNContact.predicateForContacts(matchingEmailAddress: searchEmail)
            contacts = try contactStore.unifiedContacts(matching: predicate, keysToFetch: fullKeysToFetch)
        } else {
            throw NSError(domain: "", code: 400, userInfo: [NSLocalizedDescriptionKey: "Must provide --name, --phone, or --email to search contacts."])
        }

        return contacts.map { contactToJSON($0) }
    }

    func getContact(id: String) throws -> ContactJSON? {
        let predicate = CNContact.predicateForContacts(withIdentifiers: [id])
        let contacts = try contactStore.unifiedContacts(matching: predicate, keysToFetch: fullKeysToFetch)
        return contacts.first.map { contactToJSON($0) }
    }

    func listContacts(groupId: String?, limit: Int) throws -> ContactListResult {
        var allContacts: [CNContact] = []
        let fetchRequest = CNContactFetchRequest(keysToFetch: fullKeysToFetch)
        fetchRequest.sortOrder = .familyName

        if let gid = groupId, !gid.isEmpty {
            fetchRequest.predicate = CNContact.predicateForContactsInGroup(withIdentifier: gid)
        }

        try contactStore.enumerateContacts(with: fetchRequest) { contact, stop in
            allContacts.append(contact)
            // We collect all for totalCount, but only return up to limit
        }

        let totalCount = allContacts.count
        let limited = Array(allContacts.prefix(limit))
        return ContactListResult(
            contacts: limited.map { contactToJSON($0) },
            totalCount: totalCount
        )
    }

    func listGroups() throws -> [ContactGroupJSON] {
        let groups = try contactStore.groups(matching: nil)
        return groups.map { ContactGroupJSON(id: $0.identifier, name: $0.name) }
    }

    func createContact(
        givenName: String?, familyName: String?, middleName: String?,
        namePrefix: String?, nameSuffix: String?, nickname: String?,
        organizationName: String?, jobTitle: String?, departmentName: String?,
        phonesJSON: String?, emailsJSON: String?, addressesJSON: String?, urlsJSON: String?,
        birthday: String?, note: String?
    ) throws -> ContactJSON {
        let contact = CNMutableContact()

        if let v = givenName { contact.givenName = v }
        if let v = familyName { contact.familyName = v }
        if let v = middleName { contact.middleName = v }
        if let v = namePrefix { contact.namePrefix = v }
        if let v = nameSuffix { contact.nameSuffix = v }
        if let v = nickname { contact.nickname = v }
        if let v = organizationName { contact.organizationName = v }
        if let v = jobTitle { contact.jobTitle = v }
        if let v = departmentName { contact.departmentName = v }
        if let v = note { contact.note = v }

        if let json = phonesJSON, let data = json.data(using: .utf8),
           let phones = try? JSONDecoder().decode([[String: String]].self, from: data) {
            contact.phoneNumbers = phones.map { dict in
                let label = labelStringToContactLabel(dict["label"])
                return CNLabeledValue(label: label, value: CNPhoneNumber(stringValue: dict["number"] ?? ""))
            }
        }

        if let json = emailsJSON, let data = json.data(using: .utf8),
           let emails = try? JSONDecoder().decode([[String: String]].self, from: data) {
            contact.emailAddresses = emails.map { dict in
                let label = labelStringToContactLabel(dict["label"])
                return CNLabeledValue(label: label, value: (dict["email"] ?? "") as NSString)
            }
        }

        if let json = addressesJSON, let data = json.data(using: .utf8),
           let addrs = try? JSONDecoder().decode([[String: String]].self, from: data) {
            contact.postalAddresses = addrs.map { dict in
                let addr = CNMutablePostalAddress()
                if let v = dict["street"] { addr.street = v }
                if let v = dict["city"] { addr.city = v }
                if let v = dict["state"] { addr.state = v }
                if let v = dict["postalCode"] { addr.postalCode = v }
                if let v = dict["country"] { addr.country = v }
                if let v = dict["isoCountryCode"] { addr.isoCountryCode = v }
                let label = labelStringToContactLabel(dict["label"])
                return CNLabeledValue(label: label, value: addr)
            }
        }

        if let json = urlsJSON, let data = json.data(using: .utf8),
           let urls = try? JSONDecoder().decode([[String: String]].self, from: data) {
            contact.urlAddresses = urls.map { dict in
                let label = labelStringToContactLabel(dict["label"])
                return CNLabeledValue(label: label, value: (dict["url"] ?? "") as NSString)
            }
        }

        if let bdayStr = birthday {
            contact.birthday = parseBirthdayComponents(bdayStr)
        }

        let saveRequest = CNSaveRequest()
        saveRequest.add(contact, toContainerWithIdentifier: nil)
        try contactStore.execute(saveRequest)

        // Re-fetch to get the assigned identifier
        guard let saved = try getContact(id: contact.identifier) else {
            throw NSError(domain: "", code: 500, userInfo: [NSLocalizedDescriptionKey: "Contact created but could not be retrieved."])
        }
        return saved
    }

    func updateContact(
        id: String,
        givenName: String?, familyName: String?, middleName: String?,
        namePrefix: String?, nameSuffix: String?, nickname: String?,
        organizationName: String?, jobTitle: String?, departmentName: String?,
        phonesJSON: String?, emailsJSON: String?, addressesJSON: String?, urlsJSON: String?,
        birthday: String?, note: String?
    ) throws -> ContactJSON {
        let predicate = CNContact.predicateForContacts(withIdentifiers: [id])
        guard let existing = try contactStore.unifiedContacts(matching: predicate, keysToFetch: fullKeysToFetch).first else {
            throw NSError(domain: "", code: 404, userInfo: [NSLocalizedDescriptionKey: "Contact with ID '\(id)' not found."])
        }
        let contact = existing.mutableCopy() as! CNMutableContact

        if let v = givenName { contact.givenName = v }
        if let v = familyName { contact.familyName = v }
        if let v = middleName { contact.middleName = v }
        if let v = namePrefix { contact.namePrefix = v }
        if let v = nameSuffix { contact.nameSuffix = v }
        if let v = nickname { contact.nickname = v }
        if let v = organizationName { contact.organizationName = v }
        if let v = jobTitle { contact.jobTitle = v }
        if let v = departmentName { contact.departmentName = v }
        if let v = note { contact.note = v }

        // Array fields: replace entirely when provided
        if let json = phonesJSON, let data = json.data(using: .utf8),
           let phones = try? JSONDecoder().decode([[String: String]].self, from: data) {
            contact.phoneNumbers = phones.map { dict in
                let label = labelStringToContactLabel(dict["label"])
                return CNLabeledValue(label: label, value: CNPhoneNumber(stringValue: dict["number"] ?? ""))
            }
        }

        if let json = emailsJSON, let data = json.data(using: .utf8),
           let emails = try? JSONDecoder().decode([[String: String]].self, from: data) {
            contact.emailAddresses = emails.map { dict in
                let label = labelStringToContactLabel(dict["label"])
                return CNLabeledValue(label: label, value: (dict["email"] ?? "") as NSString)
            }
        }

        if let json = addressesJSON, let data = json.data(using: .utf8),
           let addrs = try? JSONDecoder().decode([[String: String]].self, from: data) {
            contact.postalAddresses = addrs.map { dict in
                let addr = CNMutablePostalAddress()
                if let v = dict["street"] { addr.street = v }
                if let v = dict["city"] { addr.city = v }
                if let v = dict["state"] { addr.state = v }
                if let v = dict["postalCode"] { addr.postalCode = v }
                if let v = dict["country"] { addr.country = v }
                if let v = dict["isoCountryCode"] { addr.isoCountryCode = v }
                let label = labelStringToContactLabel(dict["label"])
                return CNLabeledValue(label: label, value: addr)
            }
        }

        if let json = urlsJSON, let data = json.data(using: .utf8),
           let urls = try? JSONDecoder().decode([[String: String]].self, from: data) {
            contact.urlAddresses = urls.map { dict in
                let label = labelStringToContactLabel(dict["label"])
                return CNLabeledValue(label: label, value: (dict["url"] ?? "") as NSString)
            }
        }

        if let bdayStr = birthday {
            if bdayStr.isEmpty {
                contact.birthday = nil
            } else {
                contact.birthday = parseBirthdayComponents(bdayStr)
            }
        }

        let saveRequest = CNSaveRequest()
        saveRequest.update(contact)
        try contactStore.execute(saveRequest)

        return contactToJSON(contact)
    }

    func deleteContact(id: String) throws {
        let predicate = CNContact.predicateForContacts(withIdentifiers: [id])
        guard let existing = try contactStore.unifiedContacts(matching: predicate, keysToFetch: [CNContactIdentifierKey as CNKeyDescriptor]).first else {
            throw NSError(domain: "", code: 404, userInfo: [NSLocalizedDescriptionKey: "Contact with ID '\(id)' not found."])
        }
        let contact = existing.mutableCopy() as! CNMutableContact
        let saveRequest = CNSaveRequest()
        saveRequest.delete(contact)
        try contactStore.execute(saveRequest)
    }

    // MARK: - Helpers

    private func normalizePhoneNumber(_ phone: String) -> String {
        return phone.filter { $0.isNumber || $0 == "+" }
    }

    private func labelStringToContactLabel(_ label: String?) -> String {
        guard let l = label?.lowercased() else { return CNLabelOther }
        switch l {
        case "home": return CNLabelHome
        case "work": return CNLabelWork
        case "other": return CNLabelOther
        case "mobile", "cell": return CNLabelPhoneNumberMobile
        case "main": return CNLabelPhoneNumberMain
        case "iphone": return CNLabelPhoneNumberiPhone
        case "home fax", "homefax": return CNLabelPhoneNumberHomeFax
        case "work fax", "workfax": return CNLabelPhoneNumberWorkFax
        case "pager": return CNLabelPhoneNumberPager
        case "homepage": return CNLabelURLAddressHomePage
        default: return CNLabelOther
        }
    }

    private func parseBirthdayComponents(_ dateString: String) -> DateComponents? {
        // Support "--MM-dd" (no year) or "yyyy-MM-dd"
        let trimmed = dateString.trimmingCharacters(in: .whitespacesAndNewlines)
        var components = DateComponents()

        if trimmed.hasPrefix("--") {
            // No year: --MM-dd
            let parts = trimmed.dropFirst(2).split(separator: "-")
            guard parts.count == 2, let month = Int(parts[0]), let day = Int(parts[1]) else { return nil }
            components.month = month
            components.day = day
        } else {
            // Full date: yyyy-MM-dd
            let parts = trimmed.split(separator: "-")
            guard parts.count == 3, let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]) else { return nil }
            components.year = year
            components.month = month
            components.day = day
        }
        return components
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
            recurrence: recurrence,
            priority: priorityToString(self.priority)
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
    case contacts = "Contacts"

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

func handleContactsPermission(
    status: CNAuthorizationStatus,
    domain: PermissionDomain,
    requestAccess: (@escaping (Bool, Error?) -> Void) -> Void,
    onGranted: @escaping () -> Void,
    onError: @escaping (String) -> Never
) {
    switch status {
    case .authorized:
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
    let contactActions = Set(["resolve-contact", "search-contacts", "get-contact", "list-contacts", "list-contact-groups", "create-contact", "update-contact", "delete-contact"])

    let isCalendarAction = calendarActions.contains(action)
    let isReminderAction = reminderActions.contains(action)
    let isContactAction = contactActions.contains(action)

    let contactsManager = ContactsManager()

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
                    dueWithin: parser.get("dueWithin"),
                    priority: parser.get("priority")
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
                    recurrenceString: parser.get("recurrence"),
                    priorityString: parser.get("priority")
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
                    recurrenceString: parser.get("recurrence"),
                    priorityString: parser.get("priority")
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

            // Contact actions
            case "resolve-contact", "search-contacts":
                let contacts = try contactsManager.searchContacts(
                    name: parser.get("name"),
                    phone: parser.get("phone"),
                    email: parser.get("email")
                )
                try outputResult(ContactSearchResult(contacts: contacts))

            case "get-contact":
                let id = try requireArg("id")
                guard let contact = try contactsManager.getContact(id: id) else {
                    throw NSError(domain: "", code: 404, userInfo: [NSLocalizedDescriptionKey: "Contact with ID '\(id)' not found."])
                }
                try outputResult(contact)

            case "list-contacts":
                let limit = Int(parser.get("limit") ?? "200") ?? 200
                let result = try contactsManager.listContacts(groupId: parser.get("groupId"), limit: limit)
                try outputResult(result)

            case "list-contact-groups":
                let groups = try contactsManager.listGroups()
                try outputResult(groups)

            case "create-contact":
                let contact = try contactsManager.createContact(
                    givenName: parser.get("givenName"),
                    familyName: parser.get("familyName"),
                    middleName: parser.get("middleName"),
                    namePrefix: parser.get("namePrefix"),
                    nameSuffix: parser.get("nameSuffix"),
                    nickname: parser.get("nickname"),
                    organizationName: parser.get("organizationName"),
                    jobTitle: parser.get("jobTitle"),
                    departmentName: parser.get("departmentName"),
                    phonesJSON: parser.get("phones"),
                    emailsJSON: parser.get("emails"),
                    addressesJSON: parser.get("addresses"),
                    urlsJSON: parser.get("urls"),
                    birthday: parser.get("birthday"),
                    note: parser.get("note")
                )
                try outputResult(contact)

            case "update-contact":
                let contact = try contactsManager.updateContact(
                    id: try requireArg("id"),
                    givenName: parser.get("givenName"),
                    familyName: parser.get("familyName"),
                    middleName: parser.get("middleName"),
                    namePrefix: parser.get("namePrefix"),
                    nameSuffix: parser.get("nameSuffix"),
                    nickname: parser.get("nickname"),
                    organizationName: parser.get("organizationName"),
                    jobTitle: parser.get("jobTitle"),
                    departmentName: parser.get("departmentName"),
                    phonesJSON: parser.get("phones"),
                    emailsJSON: parser.get("emails"),
                    addressesJSON: parser.get("addresses"),
                    urlsJSON: parser.get("urls"),
                    birthday: parser.get("birthday"),
                    note: parser.get("note")
                )
                try outputResult(contact)

            case "delete-contact":
                let id = try requireArg("id")
                try contactsManager.deleteContact(id: id)
                try outputResult(DeleteResult(id: id))

            default:
                throw NSError(domain: "", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid or missing --action. Valid actions: read-calendars, read-events, get-event, create-event, update-event, delete-event, read-lists, read-reminders, get-reminder, create-reminder, update-reminder, delete-reminder, create-list, update-list, delete-list, resolve-contact, search-contacts, get-contact, list-contacts, list-contact-groups, create-contact, update-contact, delete-contact"])
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
    } else if isContactAction {
        handleContactsPermission(
            status: contactsManager.checkAuthorizationStatus(),
            domain: .contacts,
            requestAccess: contactsManager.requestAccess,
            onGranted: handleAction,
            onError: outputError
        )
    } else {
        outputError("Invalid action. Use --action with a valid action name.")
    }

    RunLoop.main.run()
}

main()
