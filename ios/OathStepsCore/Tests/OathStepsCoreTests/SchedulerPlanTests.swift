import Foundation
import Testing
@testable import OathStepsCore

private func attempt(_ id: String, outcome: Outcome = .correct, method: AssessmentMethod = .selfUnprompted, prompted: Bool = false, at: String = "2026-01-10T15:00:00Z", qid: String = "2025-001") -> PracticeAttempt {
    PracticeAttempt(id: id, questionId: qid, bank: .v2025, packVersion: "2025.test", outcome: outcome, method: method, prompted: prompted, context: .practice, at: at)
}

@Suite("review scheduler") struct SchedulerTests {
    let start = newReviewState("2025-001", bank: .v2025, today: "2026-01-10")

    @Test func advancesOneBoxPerUnpromptedCorrectAnswer() {
        var s = applyAttempt(start, attempt("a1"), timeZone: UTC)
        #expect(s.box == 1 && s.dueOn == "2026-01-11")
        s = applyAttempt(s, attempt("a2", at: "2026-01-11T15:00:00Z"), timeZone: UTC)
        #expect(s.box == 2 && s.dueOn == "2026-01-14")
        #expect(INTERVAL_DAYS[2] == 3)
    }

    @Test func doesNotAdvanceMasteryForHintedOrMultipleChoice() {
        let h = applyAttempt(start, attempt("h1", method: .selfHinted, prompted: true), timeZone: UTC)
        #expect(h.box == 0 && h.dueOn == "2026-01-11" && h.unpromptedCorrectAt.isEmpty)
        #expect(applyAttempt(start, attempt("m1", method: .multipleChoice, prompted: true), timeZone: UTC).box == 0)
    }

    @Test func demotesOnUncertainAndResetsOnIncorrect() {
        var s = start
        s.box = 3
        s = applyAttempt(s, attempt("u1", outcome: .uncertain), timeZone: UTC)
        #expect(s.box == 2 && s.dueOn == "2026-01-11")
        s = applyAttempt(s, attempt("i1", outcome: .incorrect, at: "2026-01-11T09:00:00Z"), timeZone: UTC)
        #expect(s.box == 0 && s.dueOn == "2026-01-11")
        #expect(isWeak(s))
    }

    @Test func ignoresADuplicateSubmit() {
        let once = applyAttempt(start, attempt("dup"), timeZone: UTC)
        let twice = applyAttempt(once, attempt("dup"), timeZone: UTC)
        #expect(twice == once && twice.seenCount == 1)
    }

    @Test func capsTheBoxAndUsesTheLearnersTimeZone() {
        var s = start
        s.box = 5
        s = applyAttempt(s, attempt("c1", at: "2026-01-11T03:00:00Z"), timeZone: TimeZone(identifier: "America/Los_Angeles")!)
        #expect(s.box == 5 && s.dueOn == "2026-02-09")
    }

    @Test func treatsTwoUnpromptedCorrectAnswers24hApartAsSecure() {
        var s = applyAttempt(start, attempt("s1", at: "2026-01-10T15:00:00Z"), timeZone: UTC)
        #expect(!isSecure(s))
        s = applyAttempt(s, attempt("s2", at: "2026-01-11T14:00:00Z"), timeZone: UTC)
        #expect(!isSecure(s))
        s = applyAttempt(s, attempt("s3", at: "2026-01-11T15:00:00Z"), timeZone: UTC)
        #expect(isSecure(s))
    }

    @Test func returnsACappedMostOverdueFirstCatchUp() {
        let states = (0..<30).map { i -> ReviewState in
            var s = newReviewState("q\(i)", bank: .v2025, today: "2026-01-01")
            s.seenCount = 1
            s.dueOn = String(format: "2026-01-%02d", 1 + (i % 10))
            return s
        }
        let r = dueToday(states, today: "2026-01-12", cap: 15)
        #expect(r.due.count == 15 && r.deferred == 15 && r.due[0].dueOn == "2026-01-01")
        #expect(dueToday([newReviewState("new", bank: .v2025, today: "2026-01-01")], today: "2026-01-12", cap: 15).due.isEmpty)
    }
}

@Suite("daily plan") struct PlanTests {
    let bank = (1...20).map { "q\($0)" }

    @Test func firstTimeLearnerGetsNewQuestionsAndATask() {
        let p = buildDailyPlan(today: "2026-01-10", bankQuestionIds: bank, reviewStates: [], newPerDay: 5, practicalTask: PracticalTask(itemId: "t", text: "Read your notice", stageTitle: "Interview preparation"))
        #expect(p.isFirstSession)
        #expect(p.newIds == ["q1", "q2", "q3", "q4", "q5"])
        #expect(p.reviewIds.isEmpty)
        #expect(p.estimatedMinutes == 6)
        #expect(p.reasons.joined(separator: " ").contains("new question"))
    }

    @Test func dueReviewsFirstOverflowDeferred() {
        let states = bank.prefix(18).enumerated().map { i, id -> ReviewState in
            var s = newReviewState(id, bank: .v2025, today: "2026-01-01")
            s.seenCount = 1
            s.dueOn = i < 16 ? "2026-01-05" : "2026-02-01"
            return s
        }
        let p = buildDailyPlan(today: "2026-01-10", bankQuestionIds: bank, reviewStates: states, newPerDay: 5, maxReview: 10, practicalTask: nil)
        #expect(p.reviewIds.count == 10 && p.deferredReview == 6)
        #expect(p.newIds == ["q19", "q20"])
        #expect(!p.isFirstSession)
        #expect(p.reasons.joined(separator: " ").contains("waiting"))
    }

    @Test func saysSoWhenNothingIsDue() {
        let states = bank.map { id -> ReviewState in
            var s = newReviewState(id, bank: .v2025, today: "2026-01-01")
            s.seenCount = 3
            s.dueOn = "2026-03-01"
            return s
        }
        let p = buildDailyPlan(today: "2026-01-10", bankQuestionIds: bank, reviewStates: states, newPerDay: 5, practicalTask: nil)
        #expect(p.reviewIds.isEmpty && p.newIds.isEmpty)
        #expect(p.reasons[0].contains("Nothing is due"))
    }
}
