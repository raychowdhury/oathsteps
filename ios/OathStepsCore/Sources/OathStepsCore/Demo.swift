import Foundation

extension AppData {
    /// Fictional returning learner with illustrative history, so returning states can be explored.
    /// Flagged `illustrative`; the Demo tag shows until cleared. Loading replaces practice progress.
    public mutating func loadDemoLearner(today: DateOnly, content: ContentLibrary, now: Date = Date()) {
        resetPractice()
        let filing = addDays(today, -327)
        updateProfile(now: now) { p in
            p.filingDate = filing
            p.filingDateUnknown = false
            p.specialConsideration = false
            p.state = "NY"
            p.onboarded = true
        }
        let pack = content.pack(.v2025)
        let qs = Array(pack.questions.filter { $0.dynamic == nil }.prefix(10))
        let plan: [(Int, [(Int, Outcome)])] = [
            (0, [(-12, .correct), (-5, .correct)]), (1, [(-9, .correct), (-2, .uncertain)]),
            (2, [(-10, .correct), (-4, .correct)]), (3, [(-8, .correct), (-2, .incorrect)]),
            (4, [(-2, .correct)]), (5, [(-14, .correct), (-7, .correct)]),
            (6, [(-6, .correct), (-3, .uncertain)]), (7, [(-15, .correct), (-6, .correct)]),
            (8, [(-9, .correct), (-4, .correct)]), (9, [(-11, .correct), (-5, .correct)]),
        ]
        for (qi, attempts) in plan {
            let q = qs[qi]
            for (offset, outcome) in attempts {
                recordAttempt(PracticeAttempt(questionId: q.id, bank: q.bank, packVersion: pack.version, outcome: outcome, method: .selfUnprompted, prompted: false, context: .practice, at: "\(addDays(today, offset))T15:00:00.000Z"), timeZone: TimeZone(identifier: "UTC")!, now: now)
            }
        }
        toggleBookmark(qs[1].id, now: now)
        if let dyn = pack.questions.first(where: { $0.dynamic?.kind == "governor" }) { toggleBookmark(dyn.id, now: now) }
        let pool = pack.questions.map { Candidate(id: $0.id, special: $0.special, unscorable: $0.dynamic != nil) }
        for (offset, outcomes) in [(-2, [Outcome.correct, .uncertain, .correct, .incorrect, .correct]), (-8, [.correct, .incorrect, .correct, .incorrect, .uncertain])] {
            let at = "\(addDays(today, offset))T16:00:00.000Z"
            let seed = UInt32(SeededRng(seed: offset + 100).next() * 1e9)
            guard var m = try? startMock(try createMock(id: newId(), kind: .walkthrough, bank: .v2025, packVersion: pack.version, special: false, pool: pool, seed: seed, now: at), now: at) else { continue }
            for o in outcomes where m.status == .active { m = (try? answerMock(m, outcome: o, at: at)) ?? m }
            saveMock(m, now: now)
        }
        englishTasks.append(EnglishTaskRecord(kind: .writing, taskId: "w-01", outcome: .incorrect, text: "1 word different", at: "\(addDays(today, -4))T17:00:00.000Z"))
        englishTasks.append(EnglishTaskRecord(kind: .reading, taskId: "r-01", outcome: .correct, text: "Read clearly (your own check)", at: "\(addDays(today, -2))T17:00:00.000Z"))
        var j = Journey()
        j.receipt = Slot(status: "done", date: addDays(filing, 12))
        j.bio = Slot(status: "attended", date: addDays(filing, 64))
        j.interview = Slot(status: "scheduled", date: addDays(today, 44))
        saveJourney(j, now: now)
        for id in ["path", "exceptions", "recall", "weak", "routine"] { setChecklist(ChecklistEntry(itemId: id, completedAt: formatInstant(now), remind: false), now: now) }
        setChecklist(ChecklistEntry(itemId: "notice", completedAt: nil, remind: true), now: now)
        meta.sessions = 6
        meta.illustrative = true
    }
}
