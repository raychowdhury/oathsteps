import Foundation

/// A local notification the app should have scheduled. The app turns these into
/// UNCalendarNotificationTriggers; computing them here keeps the rules testable.
public struct PlannedNotification: Sendable, Equatable {
    public var id: String
    public var title: String
    public var body: String
    /// Fire date for one-off notifications; nil for the daily repeating study reminder.
    public var date: DateOnly?
    public var hour: Int
    public var minute: Int
    public var repeatsDaily: Bool
}

/// Is `hour` inside the quiet window [from, to), which may wrap past midnight?
public func inQuietHours(_ hour: Int, from: Int, to: Int) -> Bool {
    if from == to { return false }
    return from < to ? (hour >= from && hour < to) : (hour >= from || hour < to)
}

/// Every notification OathSteps wants scheduled, from the learner's settings and journey dates.
/// - Daily study reminder at the chosen time, moved to the end of quiet hours if it falls inside them.
/// - Appointment reminders 7 days before, 1 day before and on the day, at 9:00 (or after quiet hours).
public func plannedNotifications(profile: StudyProfile, journey: Journey, device: DeviceSettings, today: DateOnly) -> [PlannedNotification] {
    var out: [PlannedNotification] = []
    let r = profile.reminders
    func clearOfQuiet(_ h: Int, _ m: Int) -> (Int, Int) { inQuietHours(h, from: r.quietFrom, to: r.quietTo) ? (r.quietTo, 0) : (h, m) }
    if r.study, r.daily, let minutes = device.studyReminderMinutes {
        let (h, m) = clearOfQuiet(minutes / 60, minutes % 60)
        out.append(PlannedNotification(id: "study.daily", title: "Time for today’s practice", body: "About 10 minutes. Answer aloud, from memory.", date: nil, hour: h, minute: m, repeatsDaily: true))
    }
    if r.appointments, device.appointmentNotifications {
        let (h, m) = clearOfQuiet(9, 0)
        for key in [MilestoneKey.bio, .interview, .oath] {
            let s = journey[key]
            guard PENDING_STATES.contains(s.status), isValidDateOnly(s.date) else { continue }
            let title = milestone(key).title
            for offset in [7, 1, 0] {
                let fire = addDays(s.date, -offset)
                guard fire >= today else { continue }
                let when = offset == 0 ? "\(title) today" : offset == 1 ? "\(title) tomorrow" : "\(title) in 7 days"
                out.append(PlannedNotification(id: "appt.\(key.rawValue).\(s.date).\(offset)", title: when, body: "\(fmtDate(s.date)), the date you entered. Your notice is the authority for the time and place.", date: fire, hour: h, minute: m, repeatsDaily: false))
            }
        }
    }
    return out
}
