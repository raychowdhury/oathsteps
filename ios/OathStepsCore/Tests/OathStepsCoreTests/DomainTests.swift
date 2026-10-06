import Foundation
import Testing
@testable import OathStepsCore

@Suite("date-only values") struct DateTests {
    @Test func validatesCalendarDatesStrictly() {
        #expect(isValidDateOnly("2025-10-20"))
        #expect(!isValidDateOnly("2025-02-30"))
        #expect(!isValidDateOnly("2025-13-01"))
        #expect(!isValidDateOnly("2025-1-1"))
        #expect(!isValidDateOnly("20251020"))
    }

    @Test func comparesAndCountsDaysWithoutDrift() {
        #expect(compareDateOnly("2025-10-19", "2025-10-20") == -1)
        #expect(daysBetween("2025-03-08", "2025-03-10") == 2)
        #expect(daysBetween("2025-10-20", "2025-10-19") == -1)
        #expect(addDays("2025-12-31", 1) == "2026-01-01")
        #expect(addDays("2024-02-28", 1) == "2024-02-29")
    }

    @Test func derivesTodayFromTheLearnersTimeZone() {
        let now = date("2025-10-20T03:30:00Z")
        #expect(todayDateOnly(now: now, timeZone: UTC) == "2025-10-20")
        #expect(todayDateOnly(now: now, timeZone: TimeZone(identifier: "America/Los_Angeles")!) == "2025-10-19")
        #expect(instantToDateOnly("2025-10-20T03:30:00Z", timeZone: TimeZone(identifier: "Asia/Tokyo")!) == "2025-10-20")
    }

    @Test func formatsInstantsLikeJavaScript() {
        #expect(formatInstant(date("2026-01-10T15:00:00Z")) == "2026-01-10T15:00:00.000Z")
        #expect(hoursBetween("2026-01-10T15:00:00.000Z", "2026-01-11T15:00:00Z") == 24)
    }
}

@Suite("test path routing") struct TestPathTests {
    @Test func usesTheFilingBoundary() throws {
        #expect(CUTOVER_DATE == "2025-10-20")
        #expect(try bankForFilingDate("2025-10-19") == .v2008)
        #expect(try bankForFilingDate("2025-10-20") == .v2025)
        #expect(try bankForFilingDate("2025-10-21") == .v2025)
        #expect(try bankForFilingDate("2019-01-01") == .v2008)
    }

    @Test func rejectsMalformedDatesInsteadOfGuessing() {
        #expect(throws: InvalidDate.self) { try bankForFilingDate("10/19/2025") }
        #expect(throws: InvalidDate.self) { try bankForFilingDate("2025-10-32") }
    }

    @Test func keepsAnUnknownFilingDateUnknown() throws {
        let p = try resolveTestPath(filingDate: nil)
        #expect(p.status == .unknown)
        #expect(p.bank == nil)
        #expect(p.rules == nil)
        #expect(p.explanation.lowercased().contains("filed"))
    }

    @Test func labelsALearnerChosenBankAsProvisional() throws {
        let p = try resolveTestPath(filingDate: nil, provisionalBank: .v2025)
        #expect(p.status == .provisional)
        #expect(p.rules == rules(.v2025).standard)
    }

    @Test func appliesThe6520Rules() throws {
        let p = try resolveTestPath(filingDate: "2026-01-05", specialConsideration: true)
        #expect(p.bank == .v2025 && p.special)
        #expect(p.rules == MockRules(asked: 10, pass: 6, stopIncorrect: 5))
        #expect(try resolveTestPath(filingDate: "2025-10-19").rules == MockRules(asked: 10, pass: 6, stopIncorrect: 5))
        #expect(try resolveTestPath(filingDate: "2025-10-20").rules == MockRules(asked: 20, pass: 12, stopIncorrect: 9))
    }

    @Test func filingDateWinsOverAProvisionalChoice() throws {
        let p = try resolveTestPath(filingDate: "2025-10-19", provisionalBank: .v2025)
        #expect(p.bank == .v2008)
        #expect(p.basis == .filingDate)
    }
}

@Suite("route wording") struct RouteTests {
    @Test func namesThePathItsLinesAndReason() {
        let r = routeFor(filingDate: "2025-12-02", filingDateUnknown: false, specialConsideration: false)
        #expect(r.key == .v2025 && r.name == "2025 civics test" && r.short == "2025 civics test" && r.bankSize == 128 && r.asked == 20 && r.src == "q128")
        #expect(r.lines == ["128 questions to study", "Up to 20 asked · 12 correct to pass", "Stops at 12 correct or 9 incorrect"])
        let o = routeFor(filingDate: "2025-10-19", filingDateUnknown: false, specialConsideration: false)
        #expect(o.key == .v2008 && o.bankSize == 100 && o.asked == 10 && o.src == "q100" && o.reason == "Filed before Oct 20, 2025.")
    }

    @Test func appliesThe6520FormatOnTopOfTheVersion() throws {
        let r = routeFor(filingDate: "2025-12-02", filingDateUnknown: false, specialConsideration: true)
        #expect(r.short == "2025 civics test · 65/20")
        #expect(r.name == "2025 civics test, 65/20 format")
        #expect(r.bankSize == 20 && r.asked == 10)
        #expect(r.reason.contains("You chose the 65/20 format"))
        #expect(practiceQuestions(r, try repoContent()).count == 20)
    }

    @Test func keepsAnUnknownVersionUnknownButLabelsWhatIsPracticed() {
        let r = routeFor(filingDate: nil, filingDateUnknown: true, specialConsideration: false)
        #expect(r.key == .none)
        #expect(r.short == "Test version not set")
        #expect(r.mock == "Add your filing date to see your format.")
        #expect(practiceBank(r) == .v2025)
    }
}

@Suite("answers") struct AnswerTests {
    @Test func expandsOptionalParentheticalWords() {
        #expect(expandVariants("(U.S.) Constitution").sorted() == ["constitution", "u s constitution"])
        #expect(expandVariants("Senate and House (of Representatives)").contains("senate and house"))
        let tw = expandVariants("Twenty-seven (27)")
        #expect(tw.contains("twenty seven 27") && tw.contains("twenty seven"))
    }

    @Test func matchesLearnerTextAsAHint() {
        let a = [AnswerVariant(text: "(U.S.) Constitution")]
        #expect(matchesAnyAnswer("the constitution", a))
        #expect(matchesAnyAnswer("US Constitution!", a))
        #expect(!matchesAnyAnswer("declaration of independence", a))
        #expect(!matchesAnyAnswer("", a))
        #expect(normalize("The Star-Spangled Banner") == "star spangled banner")
    }

    @Test func typedMatchingAcceptsExactContainedAndNearComplete() {
        let a = [AnswerVariant(text: "One hundred (100)"), AnswerVariant(text: "George Washington")]
        #expect(answerMatches("one hundred", a))
        #expect(answerMatches("one hundred 100", [AnswerVariant(text: "One hundred (100)")]))
        #expect(answerMatches("it was George Washington", a))
        #expect(answerMatches("George Washingt", a))
        #expect(!answerMatches("", a))
        #expect(!answerMatches("John Adams", a))
        #expect(!answerMatches("Geo", a))
    }

    let pool = [
        ChoiceQuestion(id: "a", subsection: "S1", answers: [.init(text: "Republic"), .init(text: "Representative democracy")]),
        ChoiceQuestion(id: "b", subsection: "S1", answers: [.init(text: "(U.S.) Constitution")]),
        ChoiceQuestion(id: "c", subsection: "S1", answers: [.init(text: "Amendments")]),
        ChoiceQuestion(id: "d", subsection: "S2", answers: [.init(text: "Capitalism")]),
        ChoiceQuestion(id: "e", subsection: "S2", answers: [.init(text: "Answers will vary.")], dynamic: true),
    ]

    @Test func buildsFourOptionsWithoutSameQuestionVariants() throws {
        let mc = try #require(buildMultipleChoice(pool[0], pool: pool, rng: SeededRng(seed: 1)))
        #expect(mc.options.count == 4)
        #expect(mc.options.contains("Republic"))
        #expect(!mc.options.contains("Representative democracy"))
        #expect(!mc.options.contains("Answers will vary."))
    }

    @Test func refusesDynamicQuestionsAndIsReproducible() {
        #expect(buildMultipleChoice(pool[4], pool: pool, rng: SeededRng(seed: 1)) == nil)
        #expect(buildMultipleChoice(pool[1], pool: pool, rng: SeededRng(seed: 5)) == buildMultipleChoice(pool[1], pool: pool, rng: SeededRng(seed: 5)))
    }

    @Test func multipleChoiceMatchesTheWebClientForTheSameSeed() {
        let webPool = Array(pool.prefix(4))
        #expect(buildMultipleChoice(webPool[0], pool: webPool, rng: SeededRng(seed: 1)) == MultipleChoice(correct: "Republic", options: ["Capitalism", "Amendments", "(U.S.) Constitution", "Republic"]))
    }
}

@Suite("seeded randomness matches the web client") struct RngParityTests {
    @Test func mulberry32Sequence() {
        let r = SeededRng(seed: 1)
        let expected = [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849]
        for e in expected { #expect(r.next() == e) }
        let m = SeededRng(seed: UInt32.max)
        #expect(m.next() == 0.8964226141106337)
        #expect(m.next() == 0.189478256739676)
    }

    @Test func shuffleAndSelection() {
        #expect(shuffle(Array(1...10), SeededRng(seed: 42)) == [1, 8, 4, 6, 3, 2, 9, 10, 5, 7])
        let pool = (1...30).map { Candidate(id: "q-\($0)", special: $0 % 5 == 0) }
        #expect(selectQuestions(pool, special: false, count: 20, seed: 42) == ["q-16", "q-11", "q-3", "q-13", "q-28", "q-2", "q-18", "q-22", "q-12", "q-9", "q-27", "q-1", "q-23", "q-21", "q-8", "q-4", "q-6", "q-25", "q-17", "q-26"])
        #expect(UInt32(SeededRng(seed: 98).next() * 1e9) == 500_422_225)
    }

    @Test func questionHashSeedsMatch() {
        #expect(hashId("2025-001") == 1_561_909_400)
        #expect(hashId("2008-100") == 3_904_572_397)
        #expect(hashId("") == 2_166_136_261)
    }
}

@Suite("writing comparison") struct WritingTests {
    @Test func matchesIgnoringCaseAndPunctuation() {
        let d = compareWords("Washington, D.C. is the capital of the United States.", "washington dc is the capital of the united states")
        #expect(d.diffs == 0)
        #expect(describeDiff(d) == "Matches the sentence")
    }

    @Test func marksTheDifferingWordAndKeepsTheOriginalSpelling() {
        let d = compareWords("Washington was the first President.", "Washington was the frist president")
        #expect(d.diffs == 1)
        #expect(d.words.map(\.ok) == [true, true, true, false, true])
        #expect(d.words[3].t == "first")
        #expect(describeDiff(d) == "1 word different")
    }

    @Test func countsMissingAndExtraWords() {
        #expect(compareWords("Independence Day is in July.", "Independence Day is in").diffs == 1)
        #expect(compareWords("Independence Day is in July.", "Independence Day is in July every year").diffs == 2)
    }
}

@Suite("validation") struct ValidationTests {
    let today = "2026-10-05"

    @Test func filingDate() {
        #expect(validateFiling(date: "2025-12-02", unsure: false, today: today) == "")
        #expect(validateFiling(date: "", unsure: true, today: today) == "")
        #expect(validateFiling(date: "", unsure: false, today: today).contains("Enter your filing date"))
        #expect(validateFiling(date: "2027-02-31", unsure: false, today: today).contains("full date"))
        #expect(validateFiling(date: "2027-02-14", unsure: false, today: today).contains("in the future"))
        #expect(validateFiling(date: "1980-01-01", unsure: false, today: today).contains("too early"))
    }

    @Test func interviewDate() {
        #expect(validateInterviewDate("", filing: "2025-12-02") == "")
        #expect(validateInterviewDate("2026-13-01", filing: nil).contains("full date"))
        #expect(validateInterviewDate("2025-11-01", filing: "2025-12-02") == "Your interview can’t be before your filing date (Dec 2, 2025).")
        #expect(validateInterviewDate("2026-11-18", filing: "2025-12-02") == "")
        #expect(fmtDate("2026-01-15") == "Jan 15, 2026")
        #expect(fmtDate("") == "")
        // 9 pm in New York on Oct 5 is already Oct 6 in UTC; the learner should see Oct 5.
        #expect(fmtLocalDay("2026-10-06T01:30:00.000Z", timeZone: TimeZone(identifier: "America/New_York")!) == "Oct 5, 2026")
        #expect(fmtLocalDay("2026-10-06T01:30:00.000Z", timeZone: TimeZone(identifier: "UTC")!) == "Oct 6, 2026")
        #expect(fmtLocalDay(nil) == "")
    }
}
