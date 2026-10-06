import OathStepsCore
import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var sheet: SheetKind?
    @State private var confirmReset = false
    @State private var notificationsDenied = false

    enum SheetKind: String, Identifiable {
        case filing, interview, delete
        var id: String { rawValue }
    }

    var body: some View {
        let p = model.data.profile
        let route = routeFor(p)
        let iv = model.data.journey.interview
        NavigationStack {
            Page {
                DemoBadge()
                readingCard(p)
                remindersCard(p)
                VStack(alignment: .leading, spacing: 12) {
                    SectionHeader(title: "Your study path")
                    row(label: "Civics test", value: route.short, sub: p.filingDate.map { "Filed \(fmtDate($0))" } ?? "No filing date", id: "settings-path") { sheet = .filing }
                    Divider()
                    row(label: "Interview date (optional)", value: iv.date.isEmpty ? "Not added" : "\(fmtDate(iv.date)) · \(statusLabel(.interview, iv.status))", sub: nil, id: "settings-interview") { sheet = .interview }
                    Divider()
                    Picker("State or territory", selection: profileBinding(\.state)) {
                        Text("Choose one (optional)").tag(String?.none)
                        ForEach(US_STATES) { Text($0.name).tag(Optional($0.code)) }
                    }
                    .tint(OS.tealStrong)
                }
                .card()
                accountCard
                dataCard
                demoCard
                contentCard
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.accessibilityIdentifier("close-settings") } }
            .navigationDestination(for: String.self) { _ in AccountView() }
        }
        .tint(OS.teal)
        .sheet(item: $sheet) { k in
            switch k {
            case .filing: FilingSheet()
            case .interview: MilestoneSheet(key: .interview, initialStatus: iv.status == "none" ? "scheduled" : nil)
            case .delete: DeleteAllSheet()
            }
        }
        .task { await refreshPermission() }
    }

    // MARK: Cards

    private func readingCard(_ p: StudyProfile) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "Reading and listening")
            VStack(alignment: .leading, spacing: 2) {
                LabeledContent("Help language", value: "English").foregroundStyle(OS.ink)
                Text("Other languages will be offered after a reviewed translation exists.").font(.meta).foregroundStyle(OS.muted)
            }
            segmented("Appearance", selection: profileBinding(\.theme), options: [(.system, "System"), (.light, "Light"), (.dark, "Dark")])
            segmented("Text size", selection: profileBinding(\.textSize), options: [(.normal, "Default"), (.large, "Large"), (.xlarge, "Larger")])
            segmented("Audio speed", selection: profileBinding(\.audioRate), options: [(0.8, "Slower"), (1.0, "Normal"), (1.2, "Faster")])
            Toggle("Reduce motion", isOn: profileBinding(\.reduceMotion)).foregroundStyle(OS.ink)
        }
        .card()
    }

    private func remindersCard(_ p: StudyProfile) -> some View {
        let r = p.reminders
        let minutes = model.data.device.studyReminderMinutes
        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Reminders")
            Toggle("Study reminders", isOn: reminderBinding(\.study)).font(.body.weight(.semibold)).foregroundStyle(OS.ink).accessibilityIdentifier("rem-study")
            if r.study {
                VStack(alignment: .leading, spacing: 8) {
                    Toggle("Daily practice", isOn: reminderBinding(\.daily)).toggleStyle(CheckToggle())
                    if r.daily {
                        Toggle("Daily notification", isOn: Binding(get: { minutes != nil }, set: { on in setStudyTime(on ? 18 * 60 : nil) }))
                            .foregroundStyle(OS.ink)
                            .accessibilityIdentifier("rem-daily-notify")
                        if let minutes {
                            DatePicker("Time", selection: Binding(get: { timeDate(minutes) }, set: { setStudyTime(minuteOfDay($0)) }), displayedComponents: .hourAndMinute)
                                .foregroundStyle(OS.ink)
                        }
                    }
                    Toggle("When reviews are due", isOn: reminderBinding(\.review)).toggleStyle(CheckToggle())
                    HStack {
                        hourPicker("Quiet from", selection: reminderBinding(\.quietFrom))
                        hourPicker("Quiet until", selection: reminderBinding(\.quietTo))
                    }
                    if r.quietFrom == r.quietTo { ErrorText(text: "Start and end can’t be the same time.") }
                }
                .padding(.leading, 4)
            }
            Divider()
            Toggle(isOn: reminderBinding(\.appointments)) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Appointment reminders").font(.body.weight(.semibold))
                    Text("7 days and 1 day before, and on the day").font(.meta).foregroundStyle(OS.muted)
                }
            }
            .foregroundStyle(OS.ink)
            .accessibilityIdentifier("rem-appointments")
            if notificationsDenied && wantsNotifications {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Notifications are turned off for OathSteps in iPhone Settings, so reminders only show inside the app.")
                    if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
                        Link("Open iPhone Settings", destination: url).font(.subheadline.weight(.semibold)).foregroundStyle(OS.tealStrong)
                    }
                }
                .foregroundStyle(OS.ink)
                .card(.amber, padding: 12)
            }
            Text("Notifications are scheduled on this iPhone. Nothing is sent from a server, and nothing shows during quiet hours.").font(.meta).foregroundStyle(OS.muted)
        }
        .card()
    }

    private var accountCard: some View {
        let acct = model.account
        let outbox = model.data.outboxSummary
        return VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Account and sync")
            if !acct.configured {
                Text("Accounts are not available in this version. Everything works without one, on this device.").foregroundStyle(OS.muted)
            } else {
                Text(acct.signedIn ? "Signed in\(acct.user.map { " as \($0.email)" } ?? ""). \(outbox.pending) change\(outbox.pending == 1 ? "" : "s") waiting to sync\(outbox.failed > 0 ? ", \(outbox.failed) failed" : "")." : "Optional. Keeps your progress across devices. Guest study is complete without one.")
                    .foregroundStyle(OS.muted)
                NavigationLink(value: "account") {
                    Label(acct.signedIn ? "Manage account and sync" : "Create account or sign in", systemImage: "person.crop.circle")
                }
                .buttonStyle(.neutral)
                .accessibilityIdentifier("open-account")
            }
        }
        .card()
    }

    private var dataCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Your data")
            Text("Stays on this iPhone unless you sign in and choose to sync. iPhone backups can include it.").foregroundStyle(OS.muted)
            ShareLink(item: ExportFile(data: model.data), preview: SharePreview("OathSteps study data")) {
                Label("Export my study data", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.neutralFill)
            .accessibilityIdentifier("export-json")
            Text("Settings, practice, journey dates and checklist, as a JSON file. No audio.").font(.meta).foregroundStyle(OS.muted)
            Button { confirmReset = true } label: {
                Label("Reset practice progress", systemImage: "arrow.counterclockwise").frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.neutralFill)
            .accessibilityIdentifier("reset-practice")
            Button { sheet = .delete } label: {
                Label("Delete all data", systemImage: "trash").frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.danger)
            .accessibilityIdentifier("delete-all")
            if !model.data.reports.isEmpty {
                Text("\(model.data.reports.count) saved answer report\(model.data.reports.count == 1 ? "" : "s") are included in the export.").font(.meta).foregroundStyle(OS.muted)
            }
        }
        .card()
        .confirmationDialog("Reset practice progress?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Reset progress", role: .destructive) {
                model.update { $0.resetPractice() }
                model.say("Practice progress reset.")
            }
            .accessibilityIdentifier("confirm-reset")
        } message: {
            Text("Clears practice and mocks. Journey and settings stay.")
        }
    }

    private var demoCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Demo data").font(.meta).foregroundStyle(OS.muted)
            Text("Load a fictional returning learner to explore the app. Replaces practice progress; labeled Demo until cleared.").foregroundStyle(OS.ink)
            HStack {
                Button("Clear demo") {
                    model.clearDemo()
                    dismiss()
                }
                .buttonStyle(.neutralFill)
                .disabled(!model.data.meta.illustrative)
                .accessibilityIdentifier("clear-demo")
                Button("Returning learner") { model.loadDemo() }.buttonStyle(.neutralFill).accessibilityIdentifier("settings-load-demo")
            }
            Text("Fictional data.").font(.meta).foregroundStyle(OS.muted)
        }
        .card(.neutral)
    }

    private var contentCard: some View {
        let g = model.content.guide
        return VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Content and review")
            ForEach(model.content.allPacks, id: \.packId) { pk in
                Text("\(pk.title): pack \(pk.version), retrieved \(String(pk.source.retrievedAt.prefix(10))). \(packReview(pk.review))")
            }
            Text("Guide \(g.version): \(g.review.humanReviewed ? "r" + reviewedBy(g.review.humanReviewedAt, g.review.reviewerCredential).dropFirst() : "draft, not expert-reviewed").")
            Text("OathSteps is a private study tool. Not affiliated with USCIS. Not legal advice.")
            HStack(spacing: 16) {
                ExternalLink(title: "Privacy notice", url: AppConfig.privacyURL)
                ExternalLink(title: "Terms of use", url: AppConfig.termsURL)
            }
        }
        .font(.meta)
        .foregroundStyle(OS.muted)
        .card()
    }

    // MARK: Pieces

    private func reviewedBy(_ at: String?, _ who: String?) -> String {
        var out = "Reviewed"
        if let at { out += " \(fmtDate(at))" }
        if let who { out += " by \(who)" }
        return out
    }

    private func packReview(_ r: ReviewInfo) -> String {
        r.humanReviewed ? reviewedBy(r.reviewedAt, r.reviewerCredential) + "." : "Machine-checked, not yet expert-reviewed."
    }

    private func row(label: String, value: String, sub: String?, id: String, change: @escaping () -> Void) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.meta).foregroundStyle(OS.muted)
                Text(value).font(.body.weight(.semibold)).foregroundStyle(OS.ink).accessibilityIdentifier(id)
                if let sub { Text(sub).font(.meta).foregroundStyle(OS.muted) }
            }
            Spacer()
            Button("Change", action: change).buttonStyle(.ghost).accessibilityLabel("Change \(label)")
        }
    }

    private func segmented<V: Hashable>(_ title: String, selection: Binding<V>, options: [(V, String)]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
            Picker(title, selection: selection) {
                ForEach(options, id: \.0) { Text($0.1).tag($0.0) }
            }
            .pickerStyle(.segmented)
        }
    }

    private func hourPicker(_ title: String, selection: Binding<Int>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.meta).foregroundStyle(OS.muted)
            Picker(title, selection: selection) {
                ForEach(0..<24, id: \.self) { h in Text("\(h % 12 == 0 ? 12 : h % 12):00 \(h < 12 ? "AM" : "PM")").tag(h) }
            }
            .tint(OS.tealStrong)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func profileBinding<V>(_ key: WritableKeyPath<StudyProfile, V>) -> Binding<V> {
        Binding(get: { model.data.profile[keyPath: key] }, set: { v in model.update { $0.updateProfile { $0[keyPath: key] = v } } })
    }

    private func reminderBinding<V>(_ key: WritableKeyPath<ReminderSettings, V>) -> Binding<V> {
        Binding(get: { model.data.profile.reminders[keyPath: key] }, set: { v in
            model.update { $0.updateProfile { $0.reminders[keyPath: key] = v } }
            Task { await askIfNeeded() }
        })
    }

    private var wantsNotifications: Bool {
        let r = model.data.profile.reminders
        return (r.study && r.daily && model.data.device.studyReminderMinutes != nil) || r.appointments
    }

    private func setStudyTime(_ minutes: Int?) {
        model.update { $0.device.studyReminderMinutes = minutes }
        Task { await askIfNeeded() }
    }

    /// Asks for permission the first time a reminder that needs a notification is on.
    private func askIfNeeded() async {
        guard wantsNotifications else { return }
        if !(await Notifier.authorized()) { _ = await Notifier.requestPermission() }
        await refreshPermission()
        model.rescheduleNotifications(force: true)
    }

    private func refreshPermission() async {
        notificationsDenied = await Notifier.denied()
    }

    private func timeDate(_ minutes: Int) -> Date {
        Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: Date()) ?? Date()
    }

    private func minuteOfDay(_ d: Date) -> Int {
        let c = Calendar.current.dateComponents([.hour, .minute], from: d)
        return (c.hour ?? 0) * 60 + (c.minute ?? 0)
    }
}

/// Typed confirmation before everything on the device is deleted.
private struct DeleteAllSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var error = false
    @State private var busy = false

    var body: some View {
        EditSheet(title: "Delete all data?", saveLabel: "Delete", saveId: "confirm-delete", onSave: delete) {
            Text("Deletes everything on this iPhone. Can’t be undone.\(model.account.signedIn ? " You will be signed out. Your account keeps what was synced; delete it from Account first if you want that gone too." : "")")
                .foregroundStyle(OS.ink)
            VStack(alignment: .leading, spacing: 6) {
                Text("Type DELETE to confirm").font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
                TextField("DELETE", text: $text)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(OS.surface, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(error ? OS.amber : OS.control, lineWidth: 1.5))
                    .onChange(of: text) { error = false }
                    .accessibilityIdentifier("delete-confirm-text")
                if error { ErrorText(text: "Type DELETE in capital letters to continue.") }
            }
        }
        .disabled(busy)
    }

    private func delete() {
        guard text == "DELETE" else { error = true; return }
        busy = true
        Task {
            if model.account.signedIn { await model.account.signOut() }
            model.deleteAllOnDevice()
            model.showSettings = false
        }
    }
}

/// The study data export, built when the share sheet asks for it.
nonisolated struct ExportFile: Transferable {
    let data: AppData
    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .json) { try $0.data.exportJSON() }
            .suggestedFileName("oathsteps-export.json")
    }
}

/// Optional account: sign in or create one, consented migration, sync, sign out and deletion.
struct AccountView: View {
    @Environment(AppModel.self) private var model
    enum Mode: String { case signUp, signIn, forgot }
    @State private var mode = Mode.signUp
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var message: (ok: Bool, text: String)?
    @State private var busy = false
    @State private var confirmDelete = false

    var body: some View {
        let acct = model.account
        Page {
            VStack(alignment: .leading, spacing: 6) {
                Text("Account").font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
                Text("Optional. Accounts exist only to keep your progress across devices. Guest study is complete without one.").foregroundStyle(OS.muted)
            }
            if let message {
                Text(message.text).foregroundStyle(OS.ink).card(message.ok ? .ok : .amber).accessibilityIdentifier("account-msg")
            }
            if !acct.signedIn { signInForm } else { signedIn(acct) }
        }
        .disabled(busy)
        .navigationTitle("Account")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var signInForm: some View {
        VStack(alignment: .leading, spacing: 14) {
            if mode == .forgot {
                Text("Reset your password").font(.h2).foregroundStyle(OS.ink)
                Text("Enter your account email. We will send a link to choose a new password.").foregroundStyle(OS.muted)
            } else {
                Picker("Sign in or create account", selection: $mode) {
                    Text("Create account").tag(Mode.signUp)
                    Text("Sign in").tag(Mode.signIn)
                }
                .pickerStyle(.segmented)
            }
            if mode == .signUp {
                field("Name (what should we call you?)") { TextField("", text: $name).textContentType(.name).accessibilityIdentifier("acct-name") }
            }
            field("Email") {
                TextField("", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier("acct-email")
            }
            if mode != .forgot {
                field("Password") {
                    SecureField("", text: $password).textContentType(mode == .signUp ? .newPassword : .password).accessibilityIdentifier("acct-password")
                }
                Text("At least 10 characters.").font(.meta).foregroundStyle(OS.muted)
            }
            Button(mode == .signUp ? "Create account" : mode == .forgot ? "Send reset link" : "Sign in") { Task { await submit() } }
                .buttonStyle(.primary)
                .disabled(email.isEmpty || (mode != .forgot && password.count < 10))
                .accessibilityIdentifier(mode == .forgot ? "forgot-submit" : "account-submit")
            if mode == .signIn {
                Button("Forgot your password?") { mode = .forgot; message = nil }.buttonStyle(.ghost)
            }
            if mode == .forgot {
                Button("Back to sign in") { mode = .signIn; message = nil }.buttonStyle(.ghost)
            }
            if mode == .signUp {
                Text("By creating an account you accept the Terms and the Privacy notice.").font(.meta).foregroundStyle(OS.muted)
            }
            Text("We store your email, name, a password hash, your sign-in sessions and the study records you choose to sync.").font(.meta).foregroundStyle(OS.muted)
            HStack(spacing: 16) {
                ExternalLink(title: "Terms", url: AppConfig.termsURL)
                ExternalLink(title: "Privacy notice", url: AppConfig.privacyURL)
            }
        }
        .card()
    }

    private func signedIn(_ acct: AccountService) -> some View {
        let consent = model.data.meta.consents["migrate-guest-progress"]
        let outbox = model.data.outboxSummary
        return Group {
            VStack(alignment: .leading, spacing: 12) {
                Text("Signed in\(acct.user.map { " as \($0.email)\($0.emailVerified ? "" : " (email not yet confirmed)")" } ?? "").").foregroundStyle(OS.ink)
                if consent == nil {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Move your guest progress into this account?").font(.body.weight(.semibold))
                        Text("\(model.data.attempts.count) practice record\(model.data.attempts.count == 1 ? "" : "s") and your settings are stored on this iPhone. With your consent they are uploaded to your account and kept in sync. You can delete them at any time.")
                        Button("Yes, migrate and sync") { Task { await migrate() } }.buttonStyle(.primarySmall).accessibilityIdentifier("migrate")
                    }
                    .foregroundStyle(OS.ink)
                    .card(.guide)
                } else {
                    Text("Sync consent given \(fmtLocalDay(consent)). \(outbox.pending) pending, \(outbox.failed) failed.\(model.data.meta.sync.lastPushAt.flatMap(parseInstant).map { " Last sent \($0.formatted(date: .abbreviated, time: .shortened))." } ?? "")")
                        .font(.meta).foregroundStyle(OS.muted)
                    if let e = model.data.meta.sync.lastError { ErrorText(text: "Last error: \(e)") }
                    Button("Sync now") { Task { busy = true; let r = await model.syncNow(); busy = false; message = (r.hasPrefix("Up to date"), r) } }
                        .buttonStyle(.secondary)
                        .accessibilityIdentifier("sync-now")
                }
            }
            .card()
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Sign out")
                Text("Signing out clears this iPhone’s copy of your data so the next person cannot see it. Your account keeps everything that was synced.").foregroundStyle(OS.muted)
                Button("Sign out") { Task { await signOut() } }.buttonStyle(.neutral).accessibilityIdentifier("sign-out")
            }
            .card()
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Delete account")
                Text("Removes your account, sessions and every synced record, then clears this iPhone. Not reversible.").foregroundStyle(OS.muted)
                Button { confirmDelete = true } label: { Label("Delete my account", systemImage: "trash") }
                    .buttonStyle(.danger)
                    .accessibilityIdentifier("delete-account")
            }
            .card()
            .confirmationDialog("Delete your account?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Yes, delete everything", role: .destructive) { Task { await deleteAccount() } }
            } message: {
                Text("Your account and everything synced to it are removed, then this iPhone is cleared.")
            }
        }
    }

    private func field<F: View>(_ label: String, @ViewBuilder _ input: () -> F) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
            input()
                .padding(12)
                .background(OS.surface, in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(OS.control, lineWidth: 1.5))
        }
    }

    private func submit() async {
        busy = true
        defer { busy = false }
        message = nil
        let acct = model.account
        do {
            switch mode {
            case .forgot:
                try await acct.requestPasswordReset(email: email)
                message = (true, "If an account exists for that email, a reset link is on its way. It works for one hour.")
            case .signUp:
                try await acct.signUp(email: email, password: password, name: name)
                password = ""
                message = (true, "Account created. A confirmation email was sent.")
            case .signIn:
                try await acct.signIn(email: email, password: password)
                password = ""
                message = (true, "Signed in.")
            }
        } catch {
            message = (false, error.localizedDescription)
        }
    }

    private func migrate() async {
        busy = true
        defer { busy = false }
        do {
            try await model.account.consent("migrate-guest-progress")
        } catch {
            message = (false, "Could not record consent. Try again.")
            return
        }
        model.update { $0.meta.consents["migrate-guest-progress"] = nowIso() }
        let push = await model.push()
        let pull = await model.pull()
        if let e = push.error ?? pull.error { message = (false, e); return }
        message = (true, "Synced \(push.sent) change\(push.sent == 1 ? "" : "s") and merged \(pull.merged) record\(pull.merged == 1 ? "" : "s") from your account.")
    }

    private func signOut() async {
        busy = true
        _ = await model.push()
        await model.account.signOut()
        model.deleteAllOnDevice()
        busy = false
        model.showSettings = false
    }

    private func deleteAccount() async {
        busy = true
        do {
            try await model.account.deleteAccount()
        } catch {
            busy = false
            message = (false, "Deletion failed: \(error.localizedDescription)")
            return
        }
        model.deleteAllOnDevice()
        busy = false
        model.showSettings = false
    }
}
