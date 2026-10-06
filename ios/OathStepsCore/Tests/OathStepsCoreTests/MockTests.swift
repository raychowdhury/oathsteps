import Testing
@testable import OathStepsCore

private func pool(_ n: Int, specialEvery: Int = 5) -> [Candidate] {
    (1...n).map { Candidate(id: "q-\($0)", special: $0 % specialEvery == 0) }
}
private let T = "2026-01-10T10:00:00Z"

private func run(_ state: MockState, _ outcomes: [Outcome]) throws -> MockState {
    var s = try startMock(state, now: T)
    for o in outcomes where s.status == .active { s = try answerMock(s, outcome: o, at: T) }
    return s
}

@Suite("question selection") struct SelectionTests {
    @Test func deterministicAndExcludesUnscorable() {
        let p = pool(30) + [Candidate(id: "dyn", special: false, unscorable: true)]
        let a = selectQuestions(p, special: false, count: 20, seed: 42)
        #expect(a == selectQuestions(p, special: false, count: 20, seed: 42))
        #expect(a.count == 20 && Set(a).count == 20 && !a.contains("dyn"))
        #expect(selectQuestions(p, special: false, count: 20, seed: 43) != a)
    }

    @Test func restricts6520MocksToTheDesignatedQuestions() {
        let ids = selectQuestions(pool(128, specialEvery: 6), special: true, count: 10, seed: 1)
        #expect(ids.count == 10)
        #expect(ids.allSatisfy { Int($0.dropFirst(2))! % 6 == 0 })
    }
}

@Suite("2025 mock: 20 asked, 12 to pass, stop at 9 incorrect") struct Mock2025Tests {
    func make() throws -> MockState { try createMock(id: "m1", bank: .v2025, packVersion: "2025.test", special: false, pool: pool(128), seed: 7, now: T) }

    @Test func stopsEarlyWithAPassAt12Correct() throws {
        let r = try #require(try run(make(), Array(repeating: .correct, count: 12)).result)
        #expect(r.passed && r.correct == 12 && r.attempted == 12 && r.stoppedEarly && r.reason == .reachedPass && r.asked == 20 && r.pass == 12)
    }

    @Test func stopsEarlyWithAFailAt9Incorrect() throws {
        let r = try #require(try run(make(), Array(repeating: .correct, count: 8) + Array(repeating: .incorrect, count: 9)).result)
        #expect(!r.passed && r.correct == 8 && r.incorrect == 9 && r.attempted == 17 && r.stoppedEarly && r.reason == .reachedFail)
        #expect(r.missedQuestionIds.count == 9)
    }

    @Test func countsUncertainAsNotCorrect() throws {
        let r = try #require(try run(make(), Array(repeating: .incorrect, count: 5) + Array(repeating: .uncertain, count: 4)).result)
        #expect(!r.passed && r.incorrect == 5 && r.uncertain == 4 && r.reason == .reachedFail)
    }

    @Test func the20thAnswerDecides() throws {
        let s = try run(make(), Array(repeating: .correct, count: 11) + Array(repeating: .incorrect, count: 8))
        #expect(s.status == .active && s.index == 19)
        let failed = try #require(try answerMock(s, outcome: .uncertain, at: T).result)
        #expect(failed.attempted == 20 && !failed.passed && failed.reason == .reachedFail && failed.uncertain == 1)
        let passed = try #require(try answerMock(s, outcome: .correct, at: T).result)
        #expect(passed.attempted == 20 && passed.passed && passed.reason == .reachedPass && !passed.stoppedEarly)
    }

    @Test func reportsExhaustedWhenThePoolIsShort() throws {
        let short = try createMock(id: "m-short", bank: .v2025, packVersion: "x", special: false, pool: pool(5), seed: 1, now: T)
        let r = try #require(try run(short, Array(repeating: .correct, count: 5)).result)
        #expect(r.attempted == 5 && !r.passed && r.reason == .exhausted)
    }

    @Test func pausesAndResumesWithoutLosingAnswers() throws {
        var s = try startMock(make(), now: T)
        s = try answerMock(s, outcome: .correct, at: T)
        s = try pauseMock(s)
        #expect(s.status == .paused)
        #expect(throws: MockError.self) { try answerMock(s, outcome: .correct, at: T) }
        s = try resumeMock(s)
        #expect(s.answers.count == 1)
        #expect(currentQuestionId(s) == s.config.questionIds[1])
    }

    @Test func recordsAnAbandonedSessionHonestly() throws {
        var s = try startMock(make(), now: T)
        s = try answerMock(s, outcome: .correct, at: T)
        let r = try #require(abandonMock(s, now: T).result)
        #expect(r.reason == .abandoned && r.attempted == 1 && !r.passed)
    }
}

@Suite("2008 and 65/20 mocks") struct Mock2008Tests {
    @Test func passesAt6Correct() throws {
        let r = try #require(try run(createMock(id: "m2", bank: .v2008, packVersion: "x", special: false, pool: pool(100), seed: 3, now: T), Array(repeating: .correct, count: 6)).result)
        #expect(r.passed && r.attempted == 6 && r.asked == 10 && r.pass == 6 && r.reason == .reachedPass)
    }

    @Test func failsAt5Incorrect() throws {
        let r = try #require(try run(createMock(id: "m3", bank: .v2008, packVersion: "x", special: false, pool: pool(100), seed: 3, now: T), [.correct] + Array(repeating: .incorrect, count: 5)).result)
        #expect(!r.passed && r.attempted == 6 && r.reason == .reachedFail)
    }

    @Test func usesTheSpecialRulesFor6520() throws {
        let m = try createMock(id: "m4", bank: .v2025, packVersion: "x", special: true, pool: pool(128, specialEvery: 6), seed: 9, now: T)
        #expect(m.config.rules == MockRules(asked: 10, pass: 6, stopIncorrect: 5))
        #expect(m.config.questionIds.count == 10)
        #expect(describeRules(.v2025, special: true).contains("20 designated"))
    }

    @Test func refusesToStartWithNothingScorable() {
        #expect(throws: MockError.noScorableQuestions) { try createMock(id: "m5", bank: .v2008, packVersion: "x", special: false, pool: [Candidate(id: "a", special: false, unscorable: true)], seed: 1, now: T) }
    }
}

@Suite("sample walkthrough: 5 asked, 4 to pass, stop at 3 wrong") struct WalkthroughTests {
    func make() throws -> MockState { try createMock(id: "w1", kind: .walkthrough, bank: .v2025, packVersion: "x", special: false, pool: pool(128), seed: 2, now: T) }

    @Test func usesTheScaledRule() throws {
        #expect(WALKTHROUGH_RULES == MockRules(asked: 5, pass: 4, stopIncorrect: 3))
        #expect(try make().config.questionIds.count == 5)
        #expect(try make().config.kind == .walkthrough)
    }

    @Test func stopsAt4CorrectOr3Wrong() throws {
        let p = try #require(try run(make(), Array(repeating: .correct, count: 4)).result)
        #expect(p.passed && p.attempted == 4 && p.reason == .reachedPass)
        let f = try #require(try run(make(), [.correct, .incorrect, .uncertain, .incorrect]).result)
        #expect(!f.passed && f.attempted == 4 && f.reason == .reachedFail && f.uncertain == 1)
    }

    @Test func asksAllFiveWhenUndecided() throws {
        let a = try #require(try run(make(), [.correct, .incorrect, .correct, .incorrect, .correct]).result)
        #expect(a.attempted == 5 && !a.passed && a.reason == .exhausted && a.correct == 3)
        let b = try #require(try run(make(), [.correct, .incorrect, .correct, .uncertain, .correct]).result)
        #expect(b.attempted == 5 && !b.passed && b.reason == .exhausted && b.uncertain == 1)
    }
}
