import Foundation
import Testing
@testable import OathStepsCore

@Suite("bundled content") struct ContentTests {
    @Test func loadsTheOfficialBanksGuideAndEnglishMaterial() throws {
        let c = try repoContent()
        #expect(c.pack(.v2025).questions.count == 128)
        #expect(c.pack(.v2008).questions.count == 100)
        #expect(c.questions(.v2025, special: true).count == 20)
        #expect(c.questions(.v2008, special: true).count == 20)
        #expect(c.pack(.v2025).questions.filter { $0.dynamic != nil }.count == 8)
        #expect(c.pack(.v2008).questions.filter { $0.dynamic != nil }.count == 10)
        #expect(c.guide.allItems.count == 18)
        #expect(c.english.reading.count == 12)
        #expect(c.question("2025-001")?.number == 1)
        #expect(c.topics(.v2025, special: false).flatMap(\.questionIds).count == 128)
        #expect(!c.pack(.v2025).review.humanReviewed)
    }
}

@Suite("on-device store") struct StoreTests {
    let now = date("2026-01-10T15:00:00Z")

    func attempt(_ id: String, _ q: String = "2025-001", outcome: Outcome = .correct, at: String = "2026-01-10T15:00:00.000Z") -> PracticeAttempt {
        PracticeAttempt(id: id, questionId: q, bank: .v2025, packVersion: "v", outcome: outcome, method: .selfUnprompted, prompted: false, context: .practice, at: at)
    }

    @Test func recordsAnAttemptOnceAndQueuesItForSync() {
        var d = AppData(now: now)
        let r1 = d.recordAttempt(attempt("11111111-1111-4111-8111-111111111111"), timeZone: UTC, now: now)
        #expect(r1)
        let r2 = d.recordAttempt(attempt("11111111-1111-4111-8111-111111111111"), timeZone: UTC, now: now)
        #expect(!r2)
        #expect(d.attempts.count == 1)
        #expect(d.reviewStates["2025-001"]?.box == 1)
        #expect(d.outbox.map(\.type) == ["attempt"])
        #expect(d.outbox[0].eventId == "11111111-1111-4111-8111-111111111111")
    }

    @Test func keepsAttemptsInTimeOrder() {
        var d = AppData(now: now)
        d.recordAttempt(attempt("b", at: "2026-01-10T15:00:00.000Z"), timeZone: UTC, now: now)
        d.recordAttempt(attempt("a", at: "2026-01-09T15:00:00.000Z"), timeZone: UTC, now: now)
        #expect(d.attempts.map(\.id) == ["a", "b"])
    }

    @Test func bookmarksToggleAndEveryChangeIsQueued() {
        var d = AppData(now: now)
        let r3 = d.toggleBookmark("2025-002", now: now)
        #expect(r3)
        #expect(d.bookmarkIds == ["2025-002"])
        let r4 = d.toggleBookmark("2025-002", now: now)
        #expect(!r4)
        #expect(d.bookmarkIds.isEmpty)
        d.updateProfile(now: now) { $0.filingDate = "2026-01-15" }
        d.setJourneySlot(.interview, Slot(status: "scheduled", date: "2026-11-18"), now: now)
        #expect(d.outbox.map(\.type) == ["bookmark", "bookmark", "profile", "journey"])
        #expect(d.outbox[1].payload["bookmarked"]?.boolValue == false)
    }

    @Test func finishedMocksAreQueuedWithAStableId() throws {
        var d = AppData(now: now)
        var m = try startMock(createMock(id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", kind: .walkthrough, bank: .v2025, packVersion: "v", special: false, pool: (1...20).map { Candidate(id: "q\($0)", special: false) }, seed: 1, now: "2026-01-10T15:00:00.000Z"), now: "2026-01-10T15:00:00.000Z")
        d.saveMock(m, now: now)
        #expect(d.outbox.isEmpty)
        #expect(d.openMock?.config.id == m.config.id)
        for _ in 0..<4 where m.status == .active { m = try answerMock(m, outcome: .correct, at: "2026-01-10T15:01:00.000Z") }
        d.saveMock(m, now: now)
        d.saveMock(m, now: now)
        #expect(d.outbox.map(\.eventId) == ["mock:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"])
        #expect(d.openMock == nil)
    }

    @Test func resetKeepsJourneyAndSettings() {
        var d = AppData(now: now)
        d.updateProfile(now: now) { $0.filingDate = "2026-01-15"; $0.onboarded = true }
        d.setJourneySlot(.interview, Slot(status: "scheduled", date: "2026-11-18"), now: now)
        d.recordAttempt(attempt("x"), timeZone: UTC, now: now)
        d.toggleBookmark("2025-002", now: now)
        d.meta.sessions = 3
        d.resetPractice()
        #expect(d.attempts.isEmpty && d.reviewStates.isEmpty && d.bookmarks.isEmpty && d.meta.sessions == 0)
        #expect(d.profile.filingDate == "2026-01-15")
        #expect(d.journey.interview.date == "2026-11-18")
    }

    @Test func outboxStatusAndSummary() {
        var d = AppData(now: now)
        d.recordAttempt(attempt("a"), timeZone: UTC, now: now)
        d.recordAttempt(attempt("b", "2025-002"), timeZone: UTC, now: now)
        d.markOutbox(["a"], .sent)
        d.markOutbox(["b"], .failed, error: "offline")
        #expect(d.pendingOutbox().map(\.eventId) == ["b"])
        #expect(d.outboxSummary.failed == 1 && d.outboxSummary.lastError == "offline")
    }

    @Test func exportsTheWebFormat() throws {
        var d = AppData(now: now)
        d.recordAttempt(attempt("a"), timeZone: UTC, now: now)
        d.toggleBookmark("2025-003", now: now)
        let json = try JSONSerialization.jsonObject(with: d.exportJSON(now: now)) as! [String: Any]
        #expect(json["app"] as? String == "OathSteps")
        #expect(json["format"] as? Int == 2)
        #expect((json["attempts"] as? [Any])?.count == 1)
        #expect(((json["bookmarks"] as? [[String: Any]])?.first?["questionId"] as? String) == "2025-003")
        for key in ["profile", "reviewStates", "mocks", "journey", "checklist", "englishTasks", "dynamicAnswers", "reports"] { #expect(json[key] != nil) }
    }

    @Test func persistsAndReloadsLosslessly() throws {
        var d = AppData(now: now)
        d.recordAttempt(attempt("a"), timeZone: UTC, now: now)
        d.setJourneySlot(.bio, Slot(status: "attended", date: "2025-12-01"), now: now)
        d.device.studyReminderMinutes = 18 * 60
        let back = try JSONDecoder().decode(AppData.self, from: JSONEncoder().encode(d))
        #expect(back == d)
    }
}

@Suite("account snapshot merge") struct MergeTests {
    let now = date("2026-01-12T10:00:00Z")

    @Test func mergesEventsFromAnotherDeviceAndRebuildsReviewStates() {
        var local = AppData(now: now)
        local.updateProfile(now: now) { $0.onboarded = false }
        var other = AppData(now: now)
        other.updateProfile(now: date("2026-01-11T10:00:00Z")) { $0.filingDate = "2026-01-15"; $0.onboarded = true }
        let a1 = PracticeAttempt(questionId: "2025-001", bank: .v2025, packVersion: "v", outcome: .correct, method: .selfUnprompted, prompted: false, context: .practice, at: "2026-01-10T15:00:00.000Z")
        let a2 = PracticeAttempt(questionId: "2025-001", bank: .v2025, packVersion: "v", outcome: .correct, method: .selfUnprompted, prompted: false, context: .practice, at: "2026-01-11T15:00:00.000Z")
        other.recordAttempt(a1, timeZone: UTC, now: now)
        other.recordAttempt(a2, timeZone: UTC, now: now)
        other.setJourneySlot(.interview, Slot(status: "scheduled", date: "2026-11-18"), now: now)
        other.toggleBookmark("2025-009", now: now)
        let snap = ServerSnapshot(events: other.outbox.map { SnapshotEvent(eventId: $0.eventId, type: $0.type, payload: $0.payload, createdAt: $0.createdAt) }, profile: .from(other.profile))

        let merged = local.merge(snap, now: now, timeZone: UTC)
        #expect(merged == 4)
        #expect(local.attempts.count == 2)
        #expect(local.reviewStates["2025-001"]?.box == 2)
        #expect(local.journey.interview.date == "2026-11-18")
        #expect(local.bookmarkIds == ["2025-009"])
        #expect(local.profile.filingDate == "2026-01-15")
        // Merged events count as already sent, so they are not pushed back.
        #expect(local.pendingOutbox().map(\.type) == ["profile"])
        // Merging the same snapshot again changes nothing.
        let again = local.merge(snap, now: now, timeZone: UTC)
        #expect(again == 2)
        #expect(local.attempts.count == 2)
    }

    @Test func readsWebClientPayloads() throws {
        let web = """
        {"events":[
          {"eventId":"33333333-3333-4333-8333-333333333333","type":"mock","createdAt":"2026-01-10T16:00:00.000Z","payload":{"config":{"id":"m1","kind":"walkthrough","bank":"2025","packVersion":"2025.x","special":false,"rules":{"asked":5,"pass":4,"stopIncorrect":3},"questionIds":["2025-001"],"seed":500422225,"createdAt":"2026-01-10T16:00:00.000Z"},"status":"finished","index":1,"answers":[{"questionId":"2025-001","outcome":"correct","method":"mock-self","prompted":false,"at":"2026-01-10T16:00:00.000Z"}],"result":{"passed":false,"correct":1,"incorrect":0,"uncertain":0,"attempted":1,"asked":5,"pass":4,"stoppedEarly":true,"reason":"abandoned","method":"self-assessed","missedQuestionIds":[]},"startedAt":"2026-01-10T16:00:00.000Z","finishedAt":"2026-01-10T16:00:00.000Z"}},
          {"eventId":"44444444-4444-4444-8444-444444444444","type":"english","createdAt":"2026-01-10T17:00:00.000Z","payload":{"id":"e1","kind":"writing","taskId":"w-01","outcome":"incorrect","text":"1 word different","selfReported":true,"at":"2026-01-10T17:00:00.000Z"}}
        ],"profile":{"id":"local","filingDate":"2025-11-12","filingDateUnknown":false,"specialConsideration":false,"state":null,"onboarded":true,"updatedAt":"2026-01-10T17:00:00.000Z"}}
        """
        let snap = try JSONDecoder().decode(ServerSnapshot.self, from: Data(web.utf8))
        var d = AppData(now: now)
        let r5 = d.merge(snap, now: now, timeZone: UTC)
        #expect(r5 == 2)
        #expect(d.mocks["m1"]?.result?.reason == .abandoned)
        #expect(d.mocks["m1"]?.config.seed == 500_422_225)
        #expect(d.englishTasks.first?.text == "1 word different")
        #expect(d.profile.filingDate == "2025-11-12")
        #expect(d.profile.theme == .system)
    }
}

@Suite("demo learner and Today") struct DemoTodayTests {
    @Test func demoLearnerMatchesTheWebStory() throws {
        let c = try repoContent()
        var d = AppData(now: date("2026-10-05T12:00:00Z"))
        d.loadDemoLearner(today: "2026-10-05", content: c, now: date("2026-10-05T12:00:00Z"))
        #expect(d.meta.illustrative)
        #expect(d.profile.filingDate == "2025-11-12")
        #expect(d.attempts.count == 19)
        #expect(d.finishedMocks.count == 2)
        #expect(d.journey.interview.date == "2026-11-18")
        let s = Snapshot(data: d, content: c, today: "2026-10-05")
        #expect(s.route.key == .v2025)
        #expect(s.countdown()?.text == "Interview in 44 days")
        #expect(s.encountered() == 10)
        #expect(s.uncertainIds().count == 3)
        #expect(s.suggestWriting())
        #expect(s.planTasks().map(\.key) == [.review, .fresh, .english])
    }

    @Test func freshLearnerPlanAndDailyQuestions() throws {
        let c = try repoContent()
        var d = AppData()
        d.updateProfile { $0.filingDate = "2026-01-15"; $0.onboarded = true }
        let s = Snapshot(data: d, content: c, today: "2026-10-05")
        #expect(s.planTasks().map(\.title) == ["Learn 5 new questions", "Reading: one sentence"])
        #expect(s.dailyIds() == ["2025-001", "2025-002", "2025-003", "2025-004", "2025-005"])
        #expect(s.readinessTeaser() == "No practice yet")
        #expect(s.unconfirmedDynamicIds().count == 8)
        #expect(s.mockPool().filter(\.unscorable).count == 8)
    }

    @Test func greetingByHour() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = UTC
        #expect(greeting(now: date("2026-01-10T08:00:00Z"), calendar: cal) == "Good morning")
        #expect(greeting(now: date("2026-01-10T13:00:00Z"), calendar: cal) == "Good afternoon")
        #expect(greeting(now: date("2026-01-10T20:00:00Z"), calendar: cal) == "Good evening")
    }
}

@Suite("notification schedule") struct NotificationTests {
    @Test func dailyStudyReminderRespectsQuietHours() {
        var device = DeviceSettings()
        let p = StudyProfile.fresh()
        #expect(plannedNotifications(profile: p, journey: Journey(), device: device, today: "2026-10-05").isEmpty)
        device.studyReminderMinutes = 18 * 60 + 30
        let n = plannedNotifications(profile: p, journey: Journey(), device: device, today: "2026-10-05")
        #expect(n.map(\.id) == ["study.daily"])
        #expect(n[0].hour == 18 && n[0].minute == 30 && n[0].repeatsDaily)
        device.studyReminderMinutes = 22 * 60
        #expect(plannedNotifications(profile: p, journey: Journey(), device: device, today: "2026-10-05")[0].hour == 8)
        #expect(inQuietHours(23, from: 21, to: 8) && inQuietHours(7, from: 21, to: 8) && !inQuietHours(8, from: 21, to: 8))
    }

    @Test func appointmentRemindersOnlyForFutureDays() {
        var j = Journey()
        j.interview = Slot(status: "scheduled", date: "2026-10-12")
        j.bio = Slot(status: "attended", date: "2026-01-15")
        let n = plannedNotifications(profile: .fresh(), journey: j, device: DeviceSettings(), today: "2026-10-06")
        #expect(n.map(\.id) == ["appt.interview.2026-10-12.1", "appt.interview.2026-10-12.0"])
        #expect(n.map(\.title) == ["Interview tomorrow", "Interview today"])
        #expect(n[0].date == "2026-10-11" && n[0].hour == 9)
        var off = StudyProfile.fresh()
        off.reminders.appointments = false
        #expect(plannedNotifications(profile: off, journey: j, device: DeviceSettings(), today: "2026-10-06").isEmpty)
    }
}
