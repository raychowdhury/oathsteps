import Foundation

public let DUE_CAP = 5

public struct PlanTask: Sendable, Equatable, Identifiable {
    public enum Key: String, Sendable { case review, fresh, english }
    public var key: Key
    public var title: String
    public var why: String
    public var time: String
    public var mins: Int
    public var done: Bool
    public var id: String { key.rawValue }
}

public struct Countdown: Sendable, Equatable {
    public var text: String
    public var sub: String
    public var date: DateOnly
}

/// Everything a screen needs about the learner, computed from the store. Mirrors src/lib/today.ts.
public struct Snapshot: Sendable {
    public let today: DateOnly
    public let data: AppData
    public let content: ContentLibrary
    public let route: Route
    public let questions: [Question]
    private let bankIds: Set<String>

    public init(data: AppData, content: ContentLibrary, today: DateOnly) {
        self.today = today
        self.data = data
        self.content = content
        route = routeFor(data.profile)
        questions = practiceQuestions(route, content)
        bankIds = Set(questions.map(\.id))
    }

    public var profile: StudyProfile { data.profile }
    public var demo: Bool { data.meta.illustrative }
    public var sessions: Int { data.meta.sessions }
    public var reviewStates: [ReviewState] { Array(data.reviewStates.values) }

    public func inBank(_ id: String) -> Bool { bankIds.contains(id) }

    public func dueIds(cap: Int = 999) -> [String] {
        dueToday(reviewStates.filter { inBank($0.questionId) }, today: today, cap: cap).due.map(\.questionId)
    }

    public func newIds() -> [String] {
        questions.filter { (data.reviewStates[$0.id]?.seenCount ?? 0) == 0 }.map(\.id)
    }

    /// Not sure or review again last time, plus saved questions.
    public func weakIds() -> [String] {
        var weak = Set(uncertainIds())
        for b in data.bookmarkIds where inBank(b) { weak.insert(b) }
        return questions.filter { weak.contains($0.id) }.map(\.id)
    }

    /// Only unsure or missed last time (no bookmarks), in bank order.
    public func uncertainIds() -> [String] {
        questions.filter { q in
            guard let r = data.reviewStates[q.id], r.seenCount > 0 else { return false }
            return r.lastOutcome == .uncertain || r.lastOutcome == .incorrect
        }.map(\.id)
    }

    public func savedIds() -> [String] { questions.filter { data.bookmarks[$0.id] != nil }.map(\.id) }

    public func planCounts() -> (due: Int, nNew: Int) {
        (min(dueIds().count, DUE_CAP), min(newIds().count, sessions > 0 ? 3 : 5))
    }

    public func dailyIds() -> [String] {
        let c = planCounts()
        let ids = dueIds(cap: DUE_CAP) + newIds().prefix(c.nNew)
        return ids.isEmpty ? questions.prefix(5).map(\.id) : ids
    }

    public func lastEnglish(_ kind: EnglishKind) -> EnglishTaskRecord? { data.englishTasks.last { $0.kind == kind } }

    /// Writing is suggested when the last reading was more recent than the last writing or the last writing had a difference.
    public func suggestWriting() -> Bool {
        guard let r = lastEnglish(.reading) else { return false }
        guard let w = lastEnglish(.writing) else { return true }
        return w.at <= r.at || w.outcome != .correct
    }

    public func planTasks() -> [PlanTask] {
        let pc = planCounts()
        let td = data.dayProgress(today)
        var tasks: [PlanTask] = []
        if pc.due > 0 || td.review {
            tasks.append(PlanTask(key: .review, title: "Review \(pc.due > 0 ? String(pc.due) : "your") due question\(pc.due == 1 ? "" : "s")", why: "Helps answers stick", time: "About 5 min", mins: 5, done: td.review))
        }
        if pc.nNew > 0 || td.fresh {
            tasks.append(PlanTask(key: .fresh, title: "Learn \(pc.nNew > 0 ? String(pc.nNew) : "a few") new question\(pc.nNew == 1 ? "" : "s")", why: sessions > 0 ? "Small sets are easier" : "You’ll review them tomorrow", time: pc.nNew > 3 ? "About 6 min" : "About 4 min", mins: pc.nNew > 3 ? 6 : 4, done: td.fresh))
        }
        let w = suggestWriting()
        tasks.append(PlanTask(key: .english, title: w ? "Writing: one sentence" : "Reading: one sentence", why: w ? "Last try had a difference" : "Part of the interview", time: "About 3 min", mins: 3, done: td.english))
        return tasks
    }

    public func countdown() -> Countdown? {
        guard let iv = scheduledInterview(data.journey) else { return nil }
        let dd = daysBetween(today, iv.date)
        let text = dd > 1 ? "Interview in \(dd) days" : dd == 1 ? "Interview tomorrow" : dd == 0 ? "Interview today" : "Your interview date has passed"
        return Countdown(text: text, sub: "\(fmtDate(iv.date))\(iv.rescheduled ? " · rescheduled" : "") · entered by you", date: iv.date)
    }

    public func encountered() -> Int { reviewStates.filter { inBank($0.questionId) && $0.seenCount > 0 }.count }

    /// Recalled after a gap: an unprompted correct answer at least a day after the first one, and still correct last time.
    public func delayedRecalled() -> Int {
        reviewStates.filter { r in
            guard inBank(r.questionId), r.lastOutcome == .correct, r.unpromptedCorrectAt.count >= 2 else { return false }
            let first = String(r.unpromptedCorrectAt[0].prefix(10))
            return r.unpromptedCorrectAt.contains { String($0.prefix(10)) > first }
        }.count
    }

    public func readinessTeaser() -> String {
        let enc = encountered()
        return enc > 0 ? "Seen \(enc) of \(questions.count) · recalled after a gap \(delayedRecalled()) of \(questions.count)" : "No practice yet"
    }

    /// Questions in the bank whose answer depends on place or time and has no learner-confirmed answer.
    public func unconfirmedDynamicIds() -> [String] {
        questions.filter { $0.dynamic != nil && data.dynamicAnswers[$0.id] == nil }.map(\.id)
    }

    public func readiness() -> Readiness {
        computeReadiness(
            bankQuestionIds: questions.map(\.id), attempts: data.attempts, reviewStates: reviewStates,
            mocks: data.finishedMocks.compactMap { m in m.result.map { MockSummary(id: m.config.id, finishedAt: m.finishedAt ?? m.config.createdAt, result: $0, bank: m.config.bank.rawValue, special: m.config.special) } },
            englishTasks: data.englishTasks, unconfirmedDynamicIds: unconfirmedDynamicIds()
        )
    }

    /// Mock candidates for the learner's path: unconfirmed dynamic questions cannot be scored honestly.
    public func mockPool() -> [Candidate] {
        questions.map { Candidate(id: $0.id, special: $0.special, unscorable: $0.dynamic != nil && data.dynamicAnswers[$0.id] == nil) }
    }
}

public func greeting(now: Date = Date(), calendar: Calendar = .current) -> String {
    let h = calendar.component(.hour, from: now)
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
}
