import Foundation

public struct MockSummary: Sendable, Equatable {
    public var id: String
    public var finishedAt: Instant
    public var result: MockResult
    public var bank: String
    public var special: Bool
    public init(id: String, finishedAt: Instant, result: MockResult, bank: String, special: Bool) {
        self.id = id
        self.finishedAt = finishedAt
        self.result = result
        self.bank = bank
        self.special = special
    }
}

public struct Readiness: Sendable {
    public struct Coverage: Sendable { public var encountered: Int; public var bankSize: Int; public var definition: String }
    public struct DelayedRecall: Sendable { public var numerator: Int; public var denominator: Int; public var delayHours: Double; public var method: String; public var definition: String; public var lastEvidenceAt: Instant? }
    public struct KindCount: Sendable, Equatable { public var attempted: Int; public var correct: Int }
    /// Below this many attempts the indicators are an explicit empty state.
    public var hasEnoughHistory: Bool
    public var minimumAttempts: Int
    public var coverage: Coverage
    public var delayedRecall: DelayedRecall
    public var recentMocks: [MockSummary]
    public var mocksDefinition: String
    public var english: [EnglishKind: KindCount]
    public var englishDefinition: String
    public var uncertainIds: [String]
    public var uncertainDefinition: String
    public var unconfirmedDynamicIds: [String]
    public var unconfirmedDefinition: String
    public var recommendations: [String]
}

public let MINIMUM_ATTEMPTS = 10

public func computeReadiness(bankQuestionIds: [String], attempts allAttempts: [PracticeAttempt], reviewStates: [ReviewState], mocks: [MockSummary], englishTasks: [EnglishTaskRecord], unconfirmedDynamicIds: [String]) -> Readiness {
    let bank = Set(bankQuestionIds)
    let attempts = allAttempts.filter { bank.contains($0.questionId) }
    let encountered = Set(attempts.map(\.questionId)).count

    // Delayed recall: eligible = questions with unprompted self attempts where a later one came
    // >= SECURE_RECALL_GAP_HOURS after the first. Numerator = those whose latest such attempt was correct.
    var numerator = 0, denominator = 0
    var lastEvidenceAt: Instant?
    var byQuestion: [String: [PracticeAttempt]] = [:]
    var order: [String] = []
    for a in attempts where a.method == .selfUnprompted && !a.prompted {
        if byQuestion[a.questionId] == nil { order.append(a.questionId) }
        byQuestion[a.questionId, default: []].append(a)
    }
    for qid in order {
        let list = byQuestion[qid]!.sorted { $0.at < $1.at }
        let first = list[0]
        let delayed = list.filter { hoursBetween(first.at, $0.at) >= SECURE_RECALL_GAP_HOURS }
        guard let latest = delayed.last else { continue }
        denominator += 1
        if latest.outcome == .correct { numerator += 1 }
        if lastEvidenceAt == nil || latest.at > lastEvidenceAt! { lastEvidenceAt = latest.at }
    }

    var english: [EnglishKind: Readiness.KindCount] = [.reading: .init(attempted: 0, correct: 0), .writing: .init(attempted: 0, correct: 0)]
    for t in englishTasks {
        english[t.kind]!.attempted += 1
        if t.outcome == .correct { english[t.kind]!.correct += 1 }
    }

    let uncertainIds = reviewStates.filter { bank.contains($0.questionId) && $0.lastOutcome == .uncertain }.map(\.questionId)
    let recent = Array(mocks.sorted { $0.finishedAt > $1.finishedAt }.prefix(3))
    let enough = attempts.count >= MINIMUM_ATTEMPTS

    var recs: [String] = []
    let missing = MINIMUM_ATTEMPTS - attempts.count
    if !enough { recs.append("Practice at least \(missing) more card\(missing == 1 ? "" : "s") so there is enough history to show meaningful indicators.") }
    if !uncertainIds.isEmpty { recs.append("Retry the \(uncertainIds.count) answer\(uncertainIds.count == 1 ? "" : "s") you marked uncertain.") }
    if enough && encountered < bank.count { recs.append("\(bank.count - encountered) questions in your bank have not been practiced yet.") }
    if enough && denominator == 0 { recs.append("Come back tomorrow and answer today's questions again without hints to build delayed-recall evidence.") }
    if !unconfirmedDynamicIds.isEmpty { recs.append("Confirm the \(unconfirmedDynamicIds.count) answers that depend on current officials or your state.") }
    if enough && recent.isEmpty { recs.append("Take a mock test to practice the real format.") }
    let weak = EnglishKind.allCases.filter { english[$0]!.attempted == 0 }
    if enough && !weak.isEmpty { recs.append("Try an English task you have not done yet: \(weak.map(\.rawValue).joined(separator: ", ")).") }

    return Readiness(
        hasEnoughHistory: enough,
        minimumAttempts: MINIMUM_ATTEMPTS,
        coverage: .init(encountered: encountered, bankSize: bank.count, definition: "Questions in your applicable bank that you have practiced at least once. Exposure is not mastery."),
        delayedRecall: .init(numerator: numerator, denominator: denominator, delayHours: SECURE_RECALL_GAP_HOURS, method: "self-assessed, unprompted", definition: "Questions answered without hints on a later day (at least 24 hours after the first unprompted attempt), and how many of those latest delayed attempts you marked correct.", lastEvidenceAt: lastEvidenceAt),
        recentMocks: recent,
        mocksDefinition: "Your last three mock results with dates and how many questions were attempted. A small history is not a probability of passing.",
        english: english,
        englishDefinition: "English tasks you completed and self-assessed. This is not an official English score.",
        uncertainIds: uncertainIds,
        uncertainDefinition: "Answers you marked uncertain the last time. They need another attempt, not an automatic failure.",
        unconfirmedDynamicIds: unconfirmedDynamicIds,
        unconfirmedDefinition: "Questions whose answer depends on current officials or your state. Confirm them from an official source.",
        recommendations: recs
    )
}
