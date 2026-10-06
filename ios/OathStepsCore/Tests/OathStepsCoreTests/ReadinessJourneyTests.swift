import Foundation
import Testing
@testable import OathStepsCore

private let bank = (1...10).map { "q\($0)" }
private func att(_ q: String, _ at: String, outcome: Outcome = .correct, method: AssessmentMethod = .selfUnprompted, prompted: Bool = false) -> PracticeAttempt {
    PracticeAttempt(questionId: q, bank: .v2025, packVersion: "v", outcome: outcome, method: method, prompted: prompted, context: .practice, at: at)
}

@Suite("readiness") struct ReadinessTests {
    @Test func explicitEmptyStateWithTooLittleHistory() {
        let r = computeReadiness(bankQuestionIds: bank, attempts: [att("q1", "2026-01-01T10:00:00Z")], reviewStates: [], mocks: [], englishTasks: [], unconfirmedDynamicIds: [])
        #expect(!r.hasEnoughHistory)
        #expect(r.recommendations[0].contains("\(MINIMUM_ATTEMPTS - 1) more"))
        #expect(r.coverage.encountered == 1 && r.coverage.bankSize == 10)
    }

    @Test func delayedUnpromptedRecall() {
        let attempts = bank.map { att($0, "2026-01-01T10:00:00Z") } + [
            att("q1", "2026-01-02T11:00:00Z"),
            att("q2", "2026-01-02T11:00:00Z", outcome: .incorrect),
            att("q3", "2026-01-01T20:00:00Z"),
            att("q4", "2026-01-03T11:00:00Z", method: .multipleChoice, prompted: true),
        ]
        let r = computeReadiness(bankQuestionIds: bank, attempts: attempts, reviewStates: [], mocks: [], englishTasks: [], unconfirmedDynamicIds: ["q9"])
        #expect(r.hasEnoughHistory)
        #expect(r.delayedRecall.numerator == 1 && r.delayedRecall.denominator == 2 && r.delayedRecall.delayHours == 24)
        #expect(r.delayedRecall.method == "self-assessed, unprompted")
        #expect(r.delayedRecall.lastEvidenceAt == "2026-01-02T11:00:00Z")
        #expect(r.coverage.encountered == 10)
        #expect(r.unconfirmedDynamicIds == ["q9"])
        #expect(r.recommendations.joined(separator: " ").contains("Take a mock"))
    }

    @Test func listsUncertainQuestionsAndTheLastThreeMocks() {
        var st = newReviewState("q5", bank: .v2025, today: "2026-01-01")
        st.seenCount = 1
        st.lastOutcome = .uncertain
        let res = MockResult(passed: false, correct: 3, incorrect: 2, uncertain: 0, attempted: 5, asked: 20, pass: 12, stoppedEarly: true, reason: .abandoned, missedQuestionIds: [])
        let mocks = [("a", "2026-01-01T00:00:00Z"), ("b", "2026-01-04T00:00:00Z"), ("c", "2026-01-02T00:00:00Z"), ("d", "2026-01-03T00:00:00Z")].map { MockSummary(id: $0.0, finishedAt: $0.1, result: res, bank: "2025", special: false) }
        let r = computeReadiness(bankQuestionIds: bank, attempts: bank.map { att($0, "2026-01-01T10:00:00Z") }, reviewStates: [st], mocks: mocks, englishTasks: [EnglishTaskRecord(kind: .reading, taskId: "r1", outcome: .correct, text: "Read clearly", at: "2026-01-01T00:00:00Z")], unconfirmedDynamicIds: [])
        #expect(r.uncertainIds == ["q5"])
        #expect(r.recentMocks.map(\.id) == ["b", "d", "c"])
        #expect(r.english[.reading] == .init(attempted: 1, correct: 1))
    }
}

@Suite("journey") struct JourneyTests {
    let today = "2026-10-05"

    @Test func slotsAndLabels() {
        #expect(slotFor(Journey(), .filed, filing: "2025-11-12") == Slot(status: "done", date: "2025-11-12"))
        #expect(slotFor(Journey(), .filed, filing: nil) == .none)
        #expect(statusLabel(.bio, "reused") == "Reused (no appointment)")
        #expect(statusLabel(.outcome, "nonsense") == "Not yet")
        #expect(!needsDate(.bio, "reused"))
        #expect(needsDate(.interview, "scheduled"))
    }

    @Test func validation() {
        #expect(validateMilestone(key: .interview, status: "none", date: "", filing: "2025-11-12", today: today) == "")
        #expect(validateMilestone(key: .bio, status: "reused", date: "", filing: "2025-11-12", today: today) == "")
        #expect(validateMilestone(key: .interview, status: "scheduled", date: "2026-11-18", filing: "2025-11-12", today: today) == "")
        #expect(validateMilestone(key: .interview, status: "attended", date: "2026-12-01", filing: "2025-11-12", today: today) == "That date is after today (Oct 5, 2026). If it hasn’t happened yet, choose “Scheduled”.")
        #expect(validateMilestone(key: .receipt, status: "done", date: "2025-10-01", filing: "2025-11-12", today: today) == "This date is before your filing date (Nov 12, 2025). Check your notice.")
        #expect(validateMilestone(key: .interview, status: "scheduled", date: "", filing: nil, today: today) == "Enter the date from your notice.")
        #expect(validateMilestone(key: .interview, status: "scheduled", date: "2026-02-30", filing: nil, today: today).contains("full date"))
        #expect(validateMilestone(key: .filed, status: "done", date: "2027-01-01", filing: nil, today: today) == "Your filing date can’t be in the future.")
    }

    @Test func comingUp() {
        var j = Journey()
        #expect(upNext(j, filing: nil, today: today) == ["Add your filing date.", "Add your interview date when it arrives."])
        j.interview = Slot(status: "scheduled", date: "2026-11-18")
        j.decision = Slot(status: "approved", date: "2026-11-18")
        j.outcome = Slot(status: "retest", date: "2026-12-01")
        #expect(upNext(j, filing: "2025-11-12", today: today) == ["Interview on Nov 18, 2026. Read your notice and prepare what it asks for.", "Approved. Follow your oath notice.", "Retest: keep practicing."])
    }

    @Test func appointmentReminderDays() {
        var j = Journey()
        j.interview = Slot(status: "scheduled", date: "2026-10-12")
        j.oath = Slot(status: "rescheduled", date: "2026-10-06")
        j.bio = Slot(status: "attended", date: "2026-01-15")
        #expect(appointmentReminders(j, today: today).map(\.title) == ["Interview in 7 days", "Oath ceremony tomorrow"])
        #expect(appointmentReminders(j, today: "2026-10-12").map(\.title) == ["Interview today"])
    }

    @Test func icsExport() {
        let ics = buildIcs([CalendarEvent(uid: "a", date: "2026-02-05", summary: "Interview; bring notice, ID")], now: date("2026-01-01T00:00:00Z"))
        #expect(ics.contains("DTSTART;VALUE=DATE:20260205"))
        #expect(ics.contains("DTEND;VALUE=DATE:20260206"))
        #expect(ics.contains(#"SUMMARY:Interview\; bring notice\, ID"#))
        #expect(ics.contains("DTSTAMP:20260101T000000Z"))
        #expect(ics.hasSuffix("END:VCALENDAR\r\n"))
    }
}
