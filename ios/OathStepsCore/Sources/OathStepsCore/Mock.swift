import Foundation

public struct MockConfig: Codable, Sendable, Equatable {
    public enum Kind: String, Codable, Sendable { case full, walkthrough }
    public var id: String
    /// "full" uses the official stop rule for the path; "walkthrough" is the 5-question sample.
    public var kind: Kind
    public var bank: Bank
    public var packVersion: String
    public var special: Bool
    public var rules: MockRules
    /// Ordered question ids selected for this session.
    public var questionIds: [String]
    public var seed: UInt32
    public var createdAt: Instant

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        kind = (try? c.decodeIfPresent(Kind.self, forKey: .kind)) ?? .full
        bank = try c.decode(Bank.self, forKey: .bank)
        packVersion = try c.decode(String.self, forKey: .packVersion)
        special = try c.decodeIfPresent(Bool.self, forKey: .special) ?? false
        rules = try c.decode(MockRules.self, forKey: .rules)
        questionIds = try c.decode([String].self, forKey: .questionIds)
        // The web client stores seeds as JavaScript numbers.
        seed = UInt32(truncatingIfNeeded: Int64(try c.decodeIfPresent(Double.self, forKey: .seed) ?? 0))
        createdAt = try c.decode(String.self, forKey: .createdAt)
    }

    public init(id: String, kind: Kind, bank: Bank, packVersion: String, special: Bool, rules: MockRules, questionIds: [String], seed: UInt32, createdAt: Instant) {
        self.id = id
        self.kind = kind
        self.bank = bank
        self.packVersion = packVersion
        self.special = special
        self.rules = rules
        self.questionIds = questionIds
        self.seed = seed
        self.createdAt = createdAt
    }
}

public struct MockAnswer: Codable, Sendable, Equatable {
    public var questionId: String
    public var outcome: Outcome
    public var method: AssessmentMethod
    public var prompted: Bool
    public var at: Instant
}

public struct MockResult: Codable, Sendable, Equatable {
    public enum Reason: String, Codable, Sendable { case reachedPass = "reached-pass", reachedFail = "reached-fail", exhausted, abandoned }
    public var passed: Bool
    public var correct: Int
    public var incorrect: Int
    public var uncertain: Int
    public var attempted: Int
    public var asked: Int
    public var pass: Int
    public var stoppedEarly: Bool
    public var reason: Reason
    public var method: String = "self-assessed"
    public var missedQuestionIds: [String]
}

public enum MockStatus: String, Codable, Sendable { case configured, active, paused, finished }

public struct MockState: Codable, Sendable, Equatable {
    public var config: MockConfig
    public var status: MockStatus
    public var index: Int
    public var answers: [MockAnswer]
    public var result: MockResult?
    public var startedAt: Instant?
    public var finishedAt: Instant?
}

public struct Candidate: Sendable {
    public var id: String
    public var special: Bool
    /// Dynamic question with no learner-confirmed answer: excluded, it cannot be scored honestly.
    public var unscorable: Bool

    public init(id: String, special: Bool, unscorable: Bool = false) {
        self.id = id
        self.special = special
        self.unscorable = unscorable
    }
}

public enum MockError: Error, Equatable {
    case badStatus(String)
    case noScorableQuestions
    case noCurrentQuestion
}

public func selectQuestions(_ pool: [Candidate], special: Bool, count: Int, seed: UInt32) -> [String] {
    let eligible = pool.filter { (special ? $0.special : true) && !$0.unscorable }
    return sample(eligible.map(\.id), count, SeededRng(seed: seed))
}

/// Sample walkthrough: 5 questions, stops at 4 correct or 3 wrong (scaled from the 2025 rule).
public let WALKTHROUGH_RULES = MockRules(asked: 5, pass: 4, stopIncorrect: 3)

public func createMock(id: String, kind: MockConfig.Kind = .full, bank: Bank, packVersion: String, special: Bool, pool: [Candidate], seed: UInt32, now: Instant) throws -> MockState {
    let r = kind == .walkthrough ? WALKTHROUGH_RULES : special ? rules(bank).special : rules(bank).standard
    let ids = selectQuestions(pool, special: special, count: r.asked, seed: seed)
    if ids.isEmpty { throw MockError.noScorableQuestions }
    let config = MockConfig(id: id, kind: kind, bank: bank, packVersion: packVersion, special: special, rules: r, questionIds: ids, seed: seed, createdAt: now)
    return MockState(config: config, status: .configured, index: 0, answers: [], result: nil, startedAt: nil, finishedAt: nil)
}

public func startMock(_ state: MockState, now: Instant) throws -> MockState {
    guard state.status == .configured else { throw MockError.badStatus(state.status.rawValue) }
    var s = state
    s.status = .active
    s.startedAt = now
    return s
}

public func pauseMock(_ state: MockState) throws -> MockState {
    guard state.status == .active else { throw MockError.badStatus(state.status.rawValue) }
    var s = state
    s.status = .paused
    return s
}

public func resumeMock(_ state: MockState) throws -> MockState {
    guard state.status == .paused else { throw MockError.badStatus(state.status.rawValue) }
    var s = state
    s.status = .active
    return s
}

public func currentQuestionId(_ state: MockState) -> String? {
    guard state.status == .active || state.status == .paused, state.index < state.config.questionIds.count else { return nil }
    return state.config.questionIds[state.index]
}

private func tally(_ answers: [MockAnswer]) -> (correct: Int, incorrect: Int, uncertain: Int) {
    var c = 0, i = 0, u = 0
    for a in answers {
        switch a.outcome {
        case .correct: c += 1
        case .incorrect: i += 1
        case .uncertain: u += 1
        }
    }
    return (c, i, u)
}

/// Record an answer and apply the stopping rule. `uncertain` counts as not-correct for the
/// official-format result (the real test has no "uncertain") and is reported separately.
public func answerMock(_ state: MockState, outcome: Outcome, method: AssessmentMethod = .mockSelf, prompted: Bool = false, at: Instant) throws -> MockState {
    guard state.status == .active else { throw MockError.badStatus(state.status.rawValue) }
    guard state.index < state.config.questionIds.count else { throw MockError.noCurrentQuestion }
    var next = state
    next.answers.append(MockAnswer(questionId: state.config.questionIds[state.index], outcome: outcome, method: method, prompted: prompted, at: at))
    next.index += 1
    let t = tally(next.answers)
    let r = state.config.rules
    if t.correct >= r.pass { return finish(next, .reachedPass, at) }
    if t.incorrect + t.uncertain >= r.stopIncorrect { return finish(next, .reachedFail, at) }
    if next.answers.count >= r.asked || next.index >= state.config.questionIds.count { return finish(next, .exhausted, at) }
    return next
}

public func abandonMock(_ state: MockState, now: Instant) -> MockState {
    state.status == .finished ? state : finish(state, .abandoned, now)
}

private func finish(_ state: MockState, _ reason: MockResult.Reason, _ now: Instant) -> MockState {
    let t = tally(state.answers)
    let r = state.config.rules
    var s = state
    s.status = .finished
    s.finishedAt = now
    s.result = MockResult(passed: t.correct >= r.pass, correct: t.correct, incorrect: t.incorrect, uncertain: t.uncertain, attempted: state.answers.count, asked: r.asked, pass: r.pass, stoppedEarly: reason != .exhausted && state.answers.count < r.asked, reason: reason, missedQuestionIds: state.answers.filter { $0.outcome != .correct }.map(\.questionId))
    return s
}

/// Human-readable practice-format summary (not a quotation of USCIS policy).
public func describeRules(_ bank: Bank, special: Bool) -> String {
    let b = rules(bank)
    let r = special ? b.special : b.standard
    let label = special ? "the 20 designated 65/20 questions" : "the \(b.bankSize)-question \(bank.rawValue) bank"
    return "Up to \(r.asked) questions from \(label). \(r.pass) correct passes; the practice stops at \(r.pass) correct or \(r.stopIncorrect) incorrect."
}
