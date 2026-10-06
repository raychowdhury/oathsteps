import Foundation

public struct PracticalTask: Sendable, Equatable {
    public var itemId: String
    public var text: String
    public var stageTitle: String
    public init(itemId: String, text: String, stageTitle: String) {
        self.itemId = itemId
        self.text = text
        self.stageTitle = stageTitle
    }
}

public struct DailyPlan: Sendable, Equatable {
    public var reviewIds: [String]
    public var deferredReview: Int
    public var newIds: [String]
    public var practicalTask: PracticalTask?
    /// Rough minutes, 30 s per card plus 3 min for a task.
    public var estimatedMinutes: Int
    /// Why these items, in learner language.
    public var reasons: [String]
    public var isFirstSession: Bool
}

public let DEFAULT_MAX_REVIEW = 15

public func buildDailyPlan(today: DateOnly, bankQuestionIds: [String], reviewStates: [ReviewState], newPerDay: Int, maxReview: Int = DEFAULT_MAX_REVIEW, practicalTask: PracticalTask?) -> DailyPlan {
    let seen = Set(reviewStates.filter { $0.seenCount > 0 }.map(\.questionId))
    let inBank = Set(bankQuestionIds)
    let (due, deferred) = dueToday(reviewStates.filter { inBank.contains($0.questionId) }, today: today, cap: maxReview)
    let newIds = Array(bankQuestionIds.filter { !seen.contains($0) }.prefix(max(0, newPerDay)))
    let cards = due.count + newIds.count
    var reasons: [String] = []
    if !due.isEmpty { reasons.append("\(due.count) answer\(due.count == 1 ? "" : "s") \(due.count == 1 ? "is" : "are") due for review because the last check was a while ago or was shaky.") }
    if deferred > 0 { reasons.append("\(deferred) more are waiting; they will come up over the next days so today stays short.") }
    if !newIds.isEmpty { reasons.append("\(newIds.count) new question\(newIds.count == 1 ? "" : "s") keep you moving through the bank.") }
    if let task = practicalTask { reasons.append("One practical task from the \(task.stageTitle) stage of your journey.") }
    if cards == 0 && practicalTask == nil { reasons.append("Nothing is due. Browse topics or take a mock if you want more practice.") }
    return DailyPlan(reviewIds: due.map(\.questionId), deferredReview: deferred, newIds: newIds, practicalTask: practicalTask, estimatedMinutes: Int((Double(cards) * 0.5).rounded(.up)) + (practicalTask != nil ? 3 : 0), reasons: reasons, isFirstSession: seen.isEmpty)
}
