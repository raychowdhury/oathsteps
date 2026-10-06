import Foundation
import Observation
import OathStepsCore
import SwiftUI

struct ToastMessage: Identifiable, Equatable {
    let id = UUID()
    let text: String
    let undo: (@MainActor () -> Void)?
    static func == (a: ToastMessage, b: ToastMessage) -> Bool { a.id == b.id }
}

/// The single source of truth for the UI: the on-device store plus app-wide services.
@Observable
final class AppModel {
    let content: ContentLibrary
    private(set) var data: AppData
    private let store: FileStore
    let speaker = Speaker()
    let account: AccountService
    var showSettings = false
    var toast: ToastMessage?
    /// Set when storage could not be read or written, so the UI can say so instead of failing silently.
    var storageError: String?
    private var lastPlanned: [PlannedNotification] = []
    private var syncTask: Task<Void, Never>?

    init(content: ContentLibrary, store: FileStore, account: AccountService) {
        self.content = content
        self.store = store
        self.account = account
        let loaded = store.load()
        data = loaded.data ?? AppData()
        if let aside = loaded.keptAside {
            storageError = "Saved progress on this iPhone could not be read, so the app started fresh. The old file was kept as \(aside.lastPathComponent)."
        }
    }

    var today: DateOnly { todayDateOnly() }
    var snapshot: Snapshot { Snapshot(data: data, content: content, today: today) }

    /// Apply a change, persist it, and keep notifications and sync in step.
    func update(_ change: (inout AppData) -> Void) {
        change(&data)
        persist()
        rescheduleNotifications()
        scheduleSync()
    }

    private func persist() {
        do {
            try store.save(data)
            storageError = nil
        } catch {
            storageError = "Your progress could not be saved on this device (\(error.localizedDescription))."
        }
    }

    func say(_ text: String, undo: (@MainActor () -> Void)? = nil) {
        toast = ToastMessage(text: text, undo: undo)
        UIAccessibility.post(notification: .announcement, argument: text)
    }

    // MARK: Whole-store actions

    func loadDemo() {
        update { $0.loadDemoLearner(today: today, content: content) }
        say("Loaded a returning learner with illustrative, fictional history.")
    }

    /// Removes the fictional learner, including its journey dates and checklist, and returns to setup.
    func clearDemo() {
        update { d in
            d.resetPractice()
            d.saveJourney(Journey())
            for id in d.checklist.keys { d.setChecklist(ChecklistEntry(itemId: id, completedAt: nil, remind: false)) }
            d.updateProfile { $0.onboarded = false; $0.filingDate = nil; $0.filingDateUnknown = false; $0.specialConsideration = false; $0.state = nil }
        }
        say("Demo data cleared.")
    }

    /// Deletes everything on this device. Notifications are removed too.
    func deleteAllOnDevice() {
        store.delete()
        data = AppData()
        persist()
        lastPlanned = []
        Task { await Notifier.apply([]) }
    }

    // MARK: Notifications

    /// `force` re-applies after notification permission changes, even when the plan is the same.
    func rescheduleNotifications(force: Bool = false) {
        let planned = plannedNotifications(profile: data.profile, journey: data.journey, device: data.device, today: today)
        guard force || planned != lastPlanned else { return }
        lastPlanned = planned
        Task { await Notifier.apply(planned) }
    }

    // MARK: Sync (only with an account and the learner's consent)

    var syncEnabled: Bool { account.signedIn && data.meta.consents["migrate-guest-progress"] != nil }

    private func scheduleSync() {
        guard syncEnabled else { return }
        syncTask?.cancel()
        syncTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            _ = await self?.push()
        }
    }

    /// Push pending events. Safe to call repeatedly; the server ignores replays by event id.
    func push() async -> (sent: Int, error: String?) {
        let events = data.pendingOutbox(limit: 500)
        guard !events.isEmpty else { return (0, nil) }
        do {
            let r = try await account.push(events)
            update { d in
                d.markOutbox(r.stored + r.duplicate, .sent)
                if let first = r.rejected.first { d.markOutbox(r.rejected.map(\.eventId), .failed, error: first.reason) }
                d.meta.sync.lastPushAt = nowIso()
                d.meta.sync.lastError = r.rejected.first?.reason
            }
            return (r.stored.count + r.duplicate.count, nil)
        } catch {
            let message = error.localizedDescription
            update { d in
                d.markOutbox(events.map(\.eventId), .failed, error: message)
                d.meta.sync.lastError = message
            }
            return (0, message)
        }
    }

    func pull() async -> (merged: Int, error: String?) {
        do {
            let snap = try await account.pull()
            var merged = 0
            update { merged = $0.merge(snap) }
            return (merged, nil)
        } catch {
            let message = error.localizedDescription
            update { $0.meta.sync.lastError = message }
            return (0, message)
        }
    }

    func syncNow() async -> String {
        let p = await push()
        let q = await pull()
        if let e = p.error ?? q.error { return e }
        return "Up to date. Sent \(p.sent), merged \(q.merged)."
    }
}
