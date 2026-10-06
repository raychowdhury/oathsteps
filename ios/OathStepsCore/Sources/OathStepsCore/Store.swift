import Foundation

/// Per-day "done" flags for the Today plan.
public struct DayProgress: Codable, Sendable, Equatable {
    public var date: DateOnly
    public var review = false
    public var fresh = false
    public var english = false
    public init(date: DateOnly) { self.date = date }
}

public struct SyncStatus: Codable, Sendable, Equatable {
    public var lastPushAt: Instant?
    public var lastPullAt: Instant?
    public var lastError: String?
    public init() {}
}

/// Append-only event destined for the server when the learner has an account.
public struct OutboxEvent: Codable, Sendable, Equatable {
    public enum Status: String, Codable, Sendable { case pending, sent, failed }
    public var eventId: String
    /// attempt | mock | journey | checklist | english | profile | dynamic-answer | bookmark | report
    public var type: String
    public var payload: JSONValue
    public var createdAt: Instant
    public var status: Status
    public var tries: Int
    public var lastError: String?
}

public struct Meta: Codable, Sendable, Equatable {
    public var dayProgress: DayProgress?
    public var sessions = 0
    /// Demo learner loaded: everything is labeled Demo until cleared.
    public var illustrative = false
    public var sync = SyncStatus()
    /// Consent purpose → time granted.
    public var consents: [String: Instant] = [:]
    public init() {}
}

/// iOS-only preferences. Not synced: they configure this device.
public struct DeviceSettings: Codable, Sendable, Equatable {
    /// Daily study notification time, minutes after midnight. Nil means off.
    public var studyReminderMinutes: Int?
    public var appointmentNotifications = true
    public var installTipDismissed = false
    public init() {}
}

/// Everything OathSteps stores on the device. One JSON file, written atomically.
public struct AppData: Codable, Sendable, Equatable {
    public var formatVersion = 1
    public var profile: StudyProfile
    public var attempts: [PracticeAttempt] = []
    public var reviewStates: [String: ReviewState] = [:]
    public var mocks: [String: MockState] = [:]
    public var journey = Journey()
    public var checklist: [String: ChecklistEntry] = [:]
    public var englishTasks: [EnglishTaskRecord] = []
    public var bookmarks: [String: Instant] = [:]
    public var dynamicAnswers: [String: ConfirmedDynamicAnswer] = [:]
    public var reports: [CorrectionReport] = []
    public var meta = Meta()
    public var outbox: [OutboxEvent] = []
    public var device = DeviceSettings()

    public init(now: Date = Date()) { profile = .fresh(now: now) }

    // MARK: Outbox

    mutating func enqueue<T: Encodable>(_ type: String, _ payload: T, eventId: String = newId(), now: Date) {
        if outbox.contains(where: { $0.eventId == eventId }) { return }
        outbox.append(OutboxEvent(eventId: eventId, type: type, payload: .from(payload), createdAt: formatInstant(now), status: .pending, tries: 0, lastError: nil))
    }

    public func pendingOutbox(limit: Int = 200) -> [OutboxEvent] {
        Array(outbox.filter { $0.status != .sent }.sorted { $0.createdAt < $1.createdAt }.prefix(limit))
    }

    public mutating func markOutbox(_ ids: [String], _ status: OutboxEvent.Status, error: String? = nil) {
        let set = Set(ids)
        for i in outbox.indices where set.contains(outbox[i].eventId) {
            outbox[i].status = status
            outbox[i].tries += 1
            outbox[i].lastError = error
        }
    }

    public var outboxSummary: (pending: Int, failed: Int, lastError: String?) {
        let failed = outbox.filter { $0.status == .failed }
        return (outbox.filter { $0.status == .pending }.count, failed.count, failed.last?.lastError)
    }

    // MARK: Profile

    public mutating func updateProfile(now: Date = Date(), _ change: (inout StudyProfile) -> Void) {
        change(&profile)
        profile.id = "local"
        profile.updatedAt = formatInstant(now)
        enqueue("profile", profile, now: now)
    }

    // MARK: Attempts and review

    /// Stores an attempt once (a duplicate id is ignored) and advances its review state.
    @discardableResult
    public mutating func recordAttempt(_ attempt: PracticeAttempt, timeZone: TimeZone = .current, now: Date = Date()) -> Bool {
        if attempts.contains(where: { $0.id == attempt.id }) { return false }
        let idx = attempts.firstIndex { $0.at > attempt.at } ?? attempts.endIndex
        attempts.insert(attempt, at: idx)
        let current = reviewStates[attempt.questionId] ?? newReviewState(attempt.questionId, bank: attempt.bank, today: todayDateOnly(now: now, timeZone: timeZone))
        reviewStates[attempt.questionId] = applyAttempt(current, attempt, timeZone: timeZone)
        enqueue("attempt", attempt, eventId: attempt.id, now: now)
        return true
    }

    // MARK: Mocks

    public mutating func saveMock(_ state: MockState, now: Date = Date()) {
        mocks[state.config.id] = state
        if state.status == .finished { enqueue("mock", state, eventId: "mock:\(state.config.id)", now: now) }
    }

    public var openMock: MockState? {
        mocks.values.filter { $0.status == .active || $0.status == .paused }.sorted { $0.config.createdAt > $1.config.createdAt }.first
    }

    public var finishedMocks: [MockState] {
        mocks.values.filter { $0.status == .finished }.sorted { ($0.finishedAt ?? "") > ($1.finishedAt ?? "") }
    }

    // MARK: Journey and checklist

    public mutating func setJourneySlot(_ key: MilestoneKey, _ slot: Slot, now: Date = Date()) {
        journey[key] = slot
        enqueue("journey", journey, now: now)
    }

    public mutating func saveJourney(_ j: Journey, now: Date = Date()) {
        journey = j
        enqueue("journey", j, now: now)
    }

    public mutating func setChecklist(_ entry: ChecklistEntry, now: Date = Date()) {
        checklist[entry.itemId] = entry
        enqueue("checklist", entry, now: now)
    }

    // MARK: English

    public mutating func recordEnglishTask(_ rec: EnglishTaskRecord, now: Date = Date()) {
        if englishTasks.contains(where: { $0.id == rec.id }) { return }
        let idx = englishTasks.firstIndex { $0.at > rec.at } ?? englishTasks.endIndex
        englishTasks.insert(rec, at: idx)
        enqueue("english", rec, eventId: rec.id, now: now)
    }

    // MARK: Bookmarks, dynamic answers, reports

    public var bookmarkIds: [String] { bookmarks.keys.sorted() }

    @discardableResult
    public mutating func toggleBookmark(_ questionId: String, now: Date = Date()) -> Bool {
        let had = bookmarks[questionId] != nil
        if had { bookmarks[questionId] = nil } else { bookmarks[questionId] = formatInstant(now) }
        struct P: Encodable { let questionId: String; let bookmarked: Bool }
        enqueue("bookmark", P(questionId: questionId, bookmarked: !had), now: now)
        return !had
    }

    public mutating func saveDynamicAnswer(_ a: ConfirmedDynamicAnswer, now: Date = Date()) {
        dynamicAnswers[a.questionId] = a
        enqueue("dynamic-answer", a, now: now)
    }

    public mutating func saveReport(_ r: CorrectionReport, now: Date = Date()) {
        reports.append(r)
        enqueue("report", r, eventId: r.id, now: now)
    }

    // MARK: Day progress

    public func dayProgress(_ today: DateOnly) -> DayProgress {
        if let d = meta.dayProgress, d.date == today { return d }
        return DayProgress(date: today)
    }

    public mutating func markDay(_ today: DateOnly, review: Bool? = nil, fresh: Bool? = nil, english: Bool? = nil) {
        var d = dayProgress(today)
        if let review { d.review = review }
        if let fresh { d.fresh = fresh }
        if let english { d.english = english }
        meta.dayProgress = d
    }

    // MARK: Reset and delete

    /// Reset practice progress: attempts, reviews, mocks, bookmarks, English checks. Journey and settings stay.
    public mutating func resetPractice() {
        attempts = []
        reviewStates = [:]
        mocks = [:]
        bookmarks = [:]
        englishTasks = []
        meta.dayProgress = nil
        meta.sessions = 0
        meta.illustrative = false
    }
}

// MARK: - Export

public struct ExportDocument: Encodable {
    public struct Bookmark: Encodable { let questionId: String; let at: Instant }
    let exportedAt: Instant
    let app = "OathSteps"
    let format = 2
    let platform = "ios"
    let demoData: Bool
    let profile: StudyProfile
    let attempts: [PracticeAttempt]
    let reviewStates: [ReviewState]
    let mocks: [MockState]
    let journey: Journey
    let checklist: [ChecklistEntry]
    let englishTasks: [EnglishTaskRecord]
    let bookmarks: [Bookmark]
    let dynamicAnswers: [ConfirmedDynamicAnswer]
    let reports: [CorrectionReport]
}

extension AppData {
    /// Same shape as the web export (format 2), so a learner's data reads the same everywhere.
    public func exportJSON(now: Date = Date()) throws -> Data {
        let doc = ExportDocument(
            exportedAt: formatInstant(now), demoData: meta.illustrative, profile: profile, attempts: attempts,
            reviewStates: reviewStates.values.sorted { $0.questionId < $1.questionId },
            mocks: mocks.values.sorted { $0.config.createdAt < $1.config.createdAt },
            journey: journey, checklist: checklist.values.sorted { $0.itemId < $1.itemId }, englishTasks: englishTasks,
            bookmarks: bookmarks.sorted { $0.key < $1.key }.map { .init(questionId: $0.key, at: $0.value) },
            dynamicAnswers: dynamicAnswers.values.sorted { $0.questionId < $1.questionId }, reports: reports
        )
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try e.encode(doc)
    }
}

// MARK: - Merging an account snapshot

public struct SnapshotEvent: Codable, Sendable {
    public var eventId: String
    public var type: String
    public var payload: JSONValue
    public var createdAt: Instant
    public init(eventId: String, type: String, payload: JSONValue, createdAt: Instant) {
        self.eventId = eventId
        self.type = type
        self.payload = payload
        self.createdAt = createdAt
    }
}

public struct ServerSnapshot: Codable, Sendable {
    public var events: [SnapshotEvent]
    public var profile: JSONValue?
}

extension AppData {
    /// Merge the account's events into the local store, as the web client does. Existing local records
    /// win on identical ids (they are the same event); review states are rebuilt from attempts in time order.
    @discardableResult
    public mutating func merge(_ snap: ServerSnapshot, now: Date = Date(), timeZone: TimeZone = .current) -> Int {
        var merged = 0
        for ev in snap.events.sorted(by: { $0.createdAt < $1.createdAt }) {
            switch ev.type {
            case "attempt":
                if let a = ev.payload.decode(PracticeAttempt.self), !attempts.contains(where: { $0.id == a.id }) {
                    let idx = attempts.firstIndex { $0.at > a.at } ?? attempts.endIndex
                    attempts.insert(a, at: idx)
                    merged += 1
                }
            case "mock":
                if let m = ev.payload.decode(MockState.self), mocks[m.config.id] == nil {
                    mocks[m.config.id] = m
                    merged += 1
                }
            case "journey", "milestone":
                // Events are applied oldest first, so the last journey snapshot wins.
                if let j = ev.payload.decode(Journey.self) { journey = j; merged += 1 }
            case "checklist":
                if let c = ev.payload.decode(ChecklistEntry.self) { checklist[c.itemId] = c; merged += 1 }
            case "english":
                if let r = ev.payload.decode(EnglishTaskRecord.self), !englishTasks.contains(where: { $0.id == r.id }) {
                    let idx = englishTasks.firstIndex { $0.at > r.at } ?? englishTasks.endIndex
                    englishTasks.insert(r, at: idx)
                    merged += 1
                }
            case "bookmark":
                if let qid = ev.payload["questionId"]?.stringValue {
                    if ev.payload["bookmarked"]?.boolValue == true { bookmarks[qid] = ev.createdAt } else { bookmarks[qid] = nil }
                    merged += 1
                }
            case "dynamic-answer":
                if ev.payload["cleared"]?.boolValue == true, let qid = ev.payload["questionId"]?.stringValue { dynamicAnswers[qid] = nil; merged += 1 }
                else if let a = ev.payload.decode(ConfirmedDynamicAnswer.self) { dynamicAnswers[a.questionId] = a; merged += 1 }
            case "report":
                if let r = ev.payload.decode(CorrectionReport.self), !reports.contains(where: { $0.id == r.id }) { reports.append(r); merged += 1 }
            default:
                break
            }
            // Mark the event as already synced so it is not re-sent.
            if !outbox.contains(where: { $0.eventId == ev.eventId }) {
                outbox.append(OutboxEvent(eventId: ev.eventId, type: ev.type, payload: ev.payload, createdAt: ev.createdAt, status: .sent, tries: 0, lastError: nil))
            }
        }
        // Rebuild review states from the union of attempts, oldest first.
        let today = todayDateOnly(now: now, timeZone: timeZone)
        var states: [String: ReviewState] = [:]
        for a in attempts.sorted(by: { $0.at < $1.at }) {
            states[a.questionId] = applyAttempt(states[a.questionId] ?? newReviewState(a.questionId, bank: a.bank, today: today), a, timeZone: timeZone)
        }
        for (k, v) in states { reviewStates[k] = v }
        if let p = snap.profile?.decode(StudyProfile.self), !profile.onboarded || profile.updatedAt < p.updatedAt {
            profile = p
            profile.id = "local"
        }
        meta.sync.lastPullAt = formatInstant(now)
        return merged
    }
}
