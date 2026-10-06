import Foundation
import OathStepsCore
import UserNotifications

/// Local notifications only: scheduled on this device, never sent from a server.
enum Notifier {
    static let prefixes = ["study.", "appt."]

    static func requestPermission() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    static func authorized() async -> Bool {
        let s = await UNUserNotificationCenter.current().notificationSettings()
        return s.authorizationStatus == .authorized || s.authorizationStatus == .provisional
    }

    static func denied() async -> Bool {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus == .denied
    }

    /// Replace OathSteps' scheduled notifications with `planned`.
    static func apply(_ planned: [PlannedNotification]) async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let ours = pending.map(\.identifier).filter { id in prefixes.contains { id.hasPrefix($0) } }
        center.removePendingNotificationRequests(withIdentifiers: ours)
        guard await authorized() else { return }
        for p in planned {
            let content = UNMutableNotificationContent()
            content.title = p.title
            content.body = p.body
            content.sound = .default
            var comps = DateComponents()
            comps.hour = p.hour
            comps.minute = p.minute
            if let d = p.date {
                let parts = d.split(separator: "-").compactMap { Int($0) }
                guard parts.count == 3 else { continue }
                comps.year = parts[0]
                comps.month = parts[1]
                comps.day = parts[2]
            }
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: p.repeatsDaily)
            try? await center.add(UNNotificationRequest(identifier: p.id, content: content, trigger: trigger))
        }
    }
}
