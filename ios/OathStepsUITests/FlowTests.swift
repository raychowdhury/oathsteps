import XCTest

/// End-to-end flows on the simulator, driven by accessibility identifiers.
/// Each test starts from an empty device (`-uitest-reset`). Screenshots are kept as attachments.
final class FlowTests: XCTestCase {
    fileprivate var app: XCUIApplication!
}

@MainActor
extension FlowTests {

    private func launch(_ extra: [String] = []) {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-uitest-reset"] + extra
        app.launch()
    }

    private func el(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }

    @discardableResult
    private func wait(_ id: String, _ timeout: Double = 8) -> XCUIElement {
        let e = el(id)
        XCTAssertTrue(e.waitForExistence(timeout: timeout), "\(id) did not appear")
        return e
    }

    private func tap(_ id: String) { wait(id).tap() }

    private func text(_ prefix: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
    }

    private func tab(_ name: String) { app.tabBars.buttons[name].firstMatch.tap() }

    private func snap(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }

    /// Setup with today's date as the filing date, which selects the 2025 test.
    private func onboard() {
        tap("start-setup")
        tap("setup-next")
        tap("Filing date")
        tap("date-done")
        XCTAssertTrue(wait("route-card").label.contains("2025"))
        tap("setup-next")
        tap("setup-next")
        tap("setup-next")
        tap("setup-next")
        wait("start-today")
    }

    func testOnboardingChoosesTheTestFromTheFilingDate() {
        launch()
        snap("welcome")
        onboard()
        XCTAssertTrue(wait("path-tag").label.contains("2025 civics test"))
        snap("today-new-learner")
    }

    func testPracticeCardRevealsAndGrades() {
        launch()
        onboard()
        tap("start-today")
        XCTAssertTrue(wait("q-position").label.hasPrefix("Question 1 of"))
        tap("reveal")
        wait("answer-card")
        snap("practice-card-revealed")
        tap("grade-got")
        XCTAssertTrue(wait("q-position").label.hasPrefix("Question 2 of"))
    }

    func testSampleWalkthroughStopsAtFourCorrect() {
        launch()
        onboard()
        tab("Practice")
        tap("start-walkthrough")
        tap("start-mock")
        XCTAssertEqual(wait("mock-position").label, "Sample walkthrough · question 1 of up to 5")
        for outcome in ["mock-correct", "mock-unsure", "mock-correct", "mock-correct", "mock-correct"] {
            tap("mock-reveal")
            tap(outcome)
        }
        XCTAssertTrue(wait("mock-score").label.contains("4 of 5 correct"))
        XCTAssertTrue(wait("mock-stop-note").label.contains("Stopped early after 4 correct"))
        snap("walkthrough-results")
    }

    func testJourneyGuideAndSettingsDataControls() {
        launch()
        tap("load-demo")
        wait("countdown")
        tab("Journey")
        wait("ms-interview")
        snap("journey")
        tap("open-guide")
        tap("details-dynamic")
        wait("remind-dynamic")
        tap("task-dynamic")
        XCTAssertTrue(text("Marked done").waitForExistence(timeout: 5))
        snap("guide")
        app.navigationBars.buttons.element(boundBy: 0).tap()

        tap("open-settings")
        wait("settings-path")
        snap("settings")
        tap("reset-practice")
        app.buttons["Reset progress"].firstMatch.tap()
        tap("delete-all")
        tap("confirm-delete")
        XCTAssertTrue(text("Type DELETE in capital letters").waitForExistence(timeout: 5), "an empty entry must not delete")
        let field = wait("delete-confirm-text")
        field.tap()
        field.typeText("DELETE")
        tap("confirm-delete")
        wait("start-setup")
    }

    /// Light and dark pass over the four tabs with the demo learner, for the visual record.
    func testTourInLightAndDark() {
        launch()
        tap("load-demo")
        wait("countdown")
        for theme in ["Light", "Dark"] {
            tap("open-settings")
            app.buttons[theme].firstMatch.tap()
            tap("close-settings")
            snap("\(theme.lowercased())-today")
            tab("Practice"); wait("start-walkthrough"); snap("\(theme.lowercased())-practice")
            tab("Interview"); snap("\(theme.lowercased())-interview")
            tab("Journey"); wait("ms-interview"); snap("\(theme.lowercased())-journey")
            tab("Today")
        }
    }

    /// App Store screenshots. Skipped unless run with TEST_RUNNER_APPSTORE_SCREENSHOTS=1 (see ios/README.md).
    func testAppStoreScreenshots() throws {
        guard ProcessInfo.processInfo.environment["APPSTORE_SCREENSHOTS"] == "1" else { throw XCTSkip("Set TEST_RUNNER_APPSTORE_SCREENSHOTS=1") }
        launch()
        tap("load-demo")
        wait("countdown")
        tap("open-settings")
        app.buttons["Light"].firstMatch.tap()
        tap("close-settings")
        sleep(5) // let the demo toast disappear
        snap("appstore-1-today")
        tab("Interview"); snap("appstore-4-interview")
        tab("Journey"); wait("ms-interview"); snap("appstore-5-journey")
        tab("Today")
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Readiness details'")).firstMatch.tap()
        wait("rd-seen"); snap("appstore-6-readiness")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        tap("start-today")
        tap("reveal")
        wait("answer-card")
        snap("appstore-2-practice")
        tab("Practice")
        tap("start-walkthrough")
        tap("start-mock")
        for _ in 0..<4 { tap("mock-reveal"); tap("mock-correct") }
        wait("mock-score")
        snap("appstore-3-mock")
    }

    /// Needs the local server from `pnpm dev -p 3500` (the Debug build's API base URL); skipped otherwise.
    func testAccountSignUpMigrateSyncAndDelete() throws {
        guard let url = URL(string: "http://localhost:3500/api/health"), (try? Data(contentsOf: url)) != nil else {
            throw XCTSkip("Local OathSteps server is not running on port 3500")
        }
        launch()
        onboard()
        tap("open-settings")
        tap("open-account")
        let email = "uitest-\(UUID().uuidString.prefix(8).lowercased())@example.test"
        let password = "uitest-\(UUID().uuidString.prefix(12))"
        wait("acct-name").tap(); app.typeText("UI Test")
        wait("acct-email").tap(); app.typeText(email)
        wait("acct-password").tap(); app.typeText(password)
        tap("account-submit")
        XCTAssertTrue(wait("account-msg", 15).label.contains("Account created"))
        tap("migrate")
        XCTAssertTrue(wait("sync-now", 15).exists)
        XCTAssertTrue(wait("account-msg").label.hasPrefix("Synced"))
        tap("sync-now")
        let msg = wait("account-msg")
        let done = NSPredicate(format: "label BEGINSWITH 'Up to date'")
        expectation(for: done, evaluatedWith: msg)
        waitForExpectations(timeout: 15)
        snap("account-synced")
        tap("delete-account")
        app.buttons["Yes, delete everything"].firstMatch.tap()
        wait("start-setup", 15)
    }
}
