import Foundation

/// Seven milestone slots. "filed" is derived from the profile's filing date.
public enum MilestoneKey: String, Codable, Sendable, CaseIterable, Hashable, Identifiable {
    case filed, receipt, bio, interview, outcome, decision, oath
    public var id: String { rawValue }
}

public struct Slot: Codable, Sendable, Equatable {
    public var status: String
    public var date: DateOnly
    public init(status: String, date: DateOnly) {
        self.status = status
        self.date = date
    }
    public static let none = Slot(status: "none", date: "")
}

public struct Journey: Codable, Sendable, Equatable {
    public var receipt = Slot.none
    public var bio = Slot.none
    public var interview = Slot.none
    public var outcome = Slot.none
    public var decision = Slot.none
    public var oath = Slot.none

    public init() {}

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        receipt = try c.decodeIfPresent(Slot.self, forKey: .receipt) ?? .none
        bio = try c.decodeIfPresent(Slot.self, forKey: .bio) ?? .none
        interview = try c.decodeIfPresent(Slot.self, forKey: .interview) ?? .none
        outcome = try c.decodeIfPresent(Slot.self, forKey: .outcome) ?? .none
        decision = try c.decodeIfPresent(Slot.self, forKey: .decision) ?? .none
        oath = try c.decodeIfPresent(Slot.self, forKey: .oath) ?? .none
    }

    /// The six stored slots; "filed" is not stored here.
    public subscript(key: MilestoneKey) -> Slot {
        get {
            switch key {
            case .filed: return .none
            case .receipt: return receipt
            case .bio: return bio
            case .interview: return interview
            case .outcome: return outcome
            case .decision: return decision
            case .oath: return oath
            }
        }
        set {
            switch key {
            case .filed: break
            case .receipt: receipt = newValue
            case .bio: bio = newValue
            case .interview: interview = newValue
            case .outcome: outcome = newValue
            case .decision: decision = newValue
            case .oath: oath = newValue
            }
        }
    }
}

public struct MilestoneDef: Sendable {
    public let key: MilestoneKey
    public let title: String
    public let opts: [(String, String)]
}

public let MILESTONES: [MilestoneDef] = [
    MilestoneDef(key: .filed, title: "Filed Form N-400", opts: [("none", "Not entered"), ("done", "Filed")]),
    MilestoneDef(key: .receipt, title: "Receipt notice", opts: [("none", "Not yet"), ("done", "Received")]),
    MilestoneDef(key: .bio, title: "Biometrics", opts: [("none", "Not yet"), ("scheduled", "Scheduled"), ("attended", "Attended"), ("reused", "Reused (no appointment)")]),
    MilestoneDef(key: .interview, title: "Interview", opts: [("none", "Not scheduled"), ("scheduled", "Scheduled"), ("rescheduled", "Rescheduled"), ("attended", "Attended")]),
    MilestoneDef(key: .outcome, title: "Interview result", opts: [("none", "Not yet"), ("passed", "Passed the tests"), ("continued", "Continued"), ("retest", "Retest scheduled"), ("evidence", "Asked for more evidence"), ("other", "Something else")]),
    MilestoneDef(key: .decision, title: "Decision", opts: [("none", "Not yet"), ("approved", "Approved"), ("denied", "Denied"), ("other", "Something else")]),
    MilestoneDef(key: .oath, title: "Oath ceremony", opts: [("none", "Not scheduled"), ("scheduled", "Scheduled"), ("rescheduled", "Rescheduled"), ("completed", "Oath taken")]),
]

public let DONE_STATES: Set<String> = ["done", "attended", "reused", "passed", "approved", "completed"]
public let PENDING_STATES: Set<String> = ["scheduled", "rescheduled", "retest", "continued", "evidence"]
public let NOTED_STATES: Set<String> = ["denied", "other"]

public func milestone(_ key: MilestoneKey) -> MilestoneDef { MILESTONES.first { $0.key == key }! }

public func slotFor(_ journey: Journey, _ key: MilestoneKey, filing: DateOnly?) -> Slot {
    if key == .filed { return filing.map { Slot(status: "done", date: $0) } ?? .none }
    return journey[key]
}

public func statusLabel(_ key: MilestoneKey, _ status: String) -> String {
    let def = milestone(key)
    return (def.opts.first { $0.0 == status } ?? def.opts[0]).1
}

public func needsDate(_ key: MilestoneKey, _ status: String) -> Bool {
    status != "none" && !(key == .bio && status == "reused")
}

/// Empty string means valid. Mirrors the web rules and wording.
public func validateMilestone(key: MilestoneKey, status: String, date: String, filing: DateOnly?, today: DateOnly) -> String {
    if status == "none" { return "" }
    if !needsDate(key, status) && date.isEmpty { return "" }
    if date.isEmpty { return "Enter the date from your notice." }
    if !isValidDateOnly(date) { return "Enter a full date: month, day and year." }
    if key == .filed && date > today { return "Your filing date can’t be in the future." }
    if DONE_STATES.contains(status) && date > today { return "That date is after today (\(fmtDate(today))). If it hasn’t happened yet, choose “Scheduled”." }
    if key != .filed, let filing, date < filing { return "This date is before your filing date (\(fmtDate(filing))). Check your notice." }
    return ""
}

/// "Coming up" lines for the Journey screen.
public func upNext(_ journey: Journey, filing: DateOnly?, today: DateOnly) -> [String] {
    var out: [String] = []
    let iv = journey.interview
    let hasInt = (iv.status == "scheduled" || iv.status == "rescheduled") && !iv.date.isEmpty
    if filing == nil { out.append("Add your filing date.") }
    if hasInt && iv.date >= today { out.append("Interview on \(fmtDate(iv.date)). Read your notice and prepare what it asks for.") }
    if !hasInt && iv.status == "none" { out.append("Add your interview date when it arrives.") }
    if journey.decision.status == "approved" && journey.oath.status != "completed" { out.append("Approved. Follow your oath notice.") }
    if journey.outcome.status == "retest" { out.append("Retest: keep practicing.") }
    if out.isEmpty { out.append("Nothing right now.") }
    return out
}

/// Scheduled interview date for countdowns, if any.
public func scheduledInterview(_ journey: Journey) -> (date: DateOnly, rescheduled: Bool)? {
    let iv = journey.interview
    if (iv.status == "scheduled" || iv.status == "rescheduled") && !iv.date.isEmpty { return (iv.date, iv.status == "rescheduled") }
    return nil
}

public struct AppointmentReminder: Sendable, Equatable {
    public var id: String
    public var title: String
    public var date: DateOnly
}

/// Appointment reminders fire 7 days and 1 day before a scheduled date, plus on the day.
public func appointmentReminders(_ journey: Journey, today: DateOnly) -> [AppointmentReminder] {
    var out: [AppointmentReminder] = []
    for key in [MilestoneKey.bio, .interview, .oath] {
        let s = journey[key]
        guard PENDING_STATES.contains(s.status), !s.date.isEmpty else { continue }
        let title = milestone(key).title
        let diff = daysBetween(today, s.date)
        if diff == 7 || diff == 1 || diff == 0 {
            out.append(AppointmentReminder(id: "appt:\(key.rawValue):\(s.date)", title: diff == 0 ? "\(title) today" : diff == 1 ? "\(title) tomorrow" : "\(title) in 7 days", date: s.date))
        }
    }
    return out
}

public struct CalendarEvent: Sendable {
    public var uid: String
    public var date: DateOnly
    public var summary: String
    public var description: String?
    public init(uid: String, date: DateOnly, summary: String, description: String? = nil) {
        self.uid = uid
        self.date = date
        self.summary = summary
        self.description = description
    }
}

/// Minimal RFC 5545 calendar with all-day events. Dates are date-only, so no time zone conversion happens.
public func buildIcs(_ events: [CalendarEvent], now: Date = Date()) -> String {
    func esc(_ s: String) -> String {
        s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\n", with: "\\n").replacingOccurrences(of: ",", with: "\\,").replacingOccurrences(of: ";", with: "\\;")
    }
    let iso = formatInstant(now)
    let stamp = iso.replacingOccurrences(of: "-", with: "").replacingOccurrences(of: ":", with: "").replacing(#/\.\d{3}/#, with: "")
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OathSteps//EN", "CALSCALE:GREGORIAN"]
    for e in events {
        lines += ["BEGIN:VEVENT", "UID:\(e.uid)@oathsteps", "DTSTAMP:\(stamp)", "DTSTART;VALUE=DATE:\(e.date.replacingOccurrences(of: "-", with: ""))", "DTEND;VALUE=DATE:\(addDays(e.date, 1).replacingOccurrences(of: "-", with: ""))", "SUMMARY:\(esc(e.summary))"]
        if let d = e.description { lines.append("DESCRIPTION:\(esc(d))") }
        lines.append("END:VEVENT")
    }
    lines.append("END:VCALENDAR")
    return lines.joined(separator: "\r\n") + "\r\n"
}
