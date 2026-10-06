# OathSteps for iPhone

A native SwiftUI app with the same study rules, content and screens as the web app. Guest study works fully offline on the device. An account is optional and syncs with the same server as the web app.

## Requirements

- Xcode 26 or later (Swift 6.2 language mode features are used). Built and tested with Xcode 27 and the iOS 26.5 simulator.
- iOS 17 or later on the device.
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`). The Xcode project is generated and not checked in.

## Build, run and test

```bash
cd ios
./build.sh                       # xcodegen + simulator build
cd OathStepsCore && swift test   # core logic, 77 tests, no simulator needed
```

UI tests run on a simulator. They start from an empty device each time (`-uitest-reset`).

```bash
ios/test-ui.sh    # a booted iPhone simulator, else the first available; SIMULATOR_UDID overrides
```

App Store screenshots (6.9-inch, 1320 × 2868) come from a test that is skipped unless asked for:

```bash
TEST_RUNNER_APPSTORE_SCREENSHOTS=1 ios/test-ui.sh -only-testing:OathStepsUITests/FlowTests/testAppStoreScreenshots
```

Run it on an iPhone 17 Pro Max simulator (`SIMULATOR_UDID`), with `xcrun simctl status_bar <udid> override --time 9:41` first.

The account test signs up, migrates, syncs and deletes a throwaway account against `pnpm dev -p 3500`. Without that server it is skipped. On a Mac, `pnpm verify` runs both iOS checks; CI runs them in `.github/workflows/ios.yml`.

## Layout

| Path | What it holds |
|---|---|
| `OathStepsCore/` | Swift package with the domain logic, ported from `src/domain` and `src/lib/today.ts`: dates, test path routing, answer matching, mock state machine, review scheduler, daily plan, readiness, journey, notifications plan, the on-device store and sync merge. No UI. |
| `OathSteps/App` | Entry point, tabs, navigation, legal links. |
| `OathSteps/Model` | `AppModel` (single source of truth), the JSON file store, Keychain token and account client, local notifications, speech. |
| `OathSteps/UI` | Design tokens from the web stylesheet, light and dark, and shared components. |
| `OathSteps/Screens` | Welcome and setup, Today, Practice, sessions, mocks, Interview English, Journey and guide, Readiness, Settings and Account. |
| `OathStepsUITests` | Flow tests with screenshots kept in the result bundle. |

## One source of content

The app bundles `content/packs/civics-2025.json`, `content/packs/civics-2008.json`, `content/guide/stages.json` and `content/english/tasks.json` directly from the repository. Running `pnpm content:ingest` updates both apps. Mock question selection uses the same seeded generator as the web app, checked bit for bit in the core tests.

## Accounts

Accounts use the server's Better Auth bearer plugin: sign-in returns a signed token, which the app keeps in the Keychain (this device only, after first unlock) and sends as `Authorization: Bearer`. No cookies. Sync is the same outbox protocol as the web app and only runs after the learner consents. It runs when the app opens, a few seconds after a change, and when it goes to the background.

`OATHSTEPS_API_BASE_URL` in `project.yml` sets the server. Debug uses `http://localhost:3500`. Release is empty, which hides accounts entirely. To ship accounts, set the Release value to the deployed HTTPS address (App Transport Security blocks plain HTTP outside local networks).

## Differences from the web app

- Reminders are real local notifications: a daily study reminder at a time the learner picks, and appointment reminders 7 days and 1 day before, and on the day, at 9:00, moved out of quiet hours. Nothing comes from a server.
- Answering aloud uses Apple's on-device speech recognition only (`requiresOnDeviceRecognition`). Where the device cannot do that, the app says so and offers typing or self-check.
- Content is bundled, so there is no offline download step.
- The Coach review proposal is not shown. It advertises a paid service that cannot be bought, which App Review is likely to reject.
- Privacy notice and Terms open the GitHub Pages copies.
- If the saved data file cannot be read after an update, it is kept beside the new one instead of being overwritten, and the app says so.

## Before the App Store

1. Signing: team F5MY9BC25S, bundle identifier `com.raychowdhury.oathsteps`, automatic signing. iPhone only.
2. Set the Release `OATHSTEPS_API_BASE_URL`, or leave it empty to ship guest-only.
3. App Privacy answers: a guest-only build collects nothing ("Data Not Collected"), which is what `OathSteps/Resources/PrivacyInfo.xcprivacy` declares. With accounts switched on, email address, name and "other user content" (study records) are collected, linked to the user, for app functionality only, no tracking: add them to the manifest and the answers.
4. Review notes: not affiliated with USCIS, content sourced from official USCIS PDFs, no eligibility decisions, no account required.
5. Test on a real iPhone: microphone and speech, notifications, VoiceOver and the largest text sizes. Only the simulator has been used so far.
