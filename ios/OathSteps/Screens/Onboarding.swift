import OathStepsCore
import SwiftUI

struct OnboardingFlow: View {
    @State private var settingUp = false
    var body: some View {
        if settingUp {
            SetupView(onBack: { settingUp = false })
        } else {
            WelcomeView(onStart: { settingUp = true })
        }
    }
}

struct WelcomeView: View {
    @Environment(AppModel.self) private var model
    let onStart: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Page {
                Image(systemName: "stairs")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 64, height: 64)
                    .background(OS.teal, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 8) {
                    Text("OathSteps").font(.largeTitle.weight(.bold)).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
                    Text("Practice. Prepare. Track your journey.").font(.title3.weight(.semibold)).foregroundStyle(OS.tealStrong)
                    Text("Study for your citizenship interview. Not affiliated with USCIS.").foregroundStyle(OS.muted)
                }
                VStack(alignment: .leading, spacing: 16) {
                    feature("sun.max", "A short daily plan", "About 10 minutes")
                    feature("bubble.left", "Practice like the interview", "Answer aloud, from memory")
                    feature("stairs", "Track your steps", "Your dates and checklist")
                }
                VStack(alignment: .leading, spacing: 6) {
                    Label("No account needed", systemImage: "lock").font(.body.weight(.semibold)).foregroundStyle(OS.ink)
                    Text("We never ask for your SSN, A-Number, ID or USCIS password.").foregroundStyle(OS.ink)
                }
                .card(.guide)
                HStack(spacing: 4) {
                    ExternalLink(title: "Privacy notice", url: AppConfig.privacyURL)
                    Text("·").foregroundStyle(OS.muted)
                    ExternalLink(title: "Terms of use", url: AppConfig.termsURL)
                }
            }
            ActionBar {
                Button("Start studying", action: onStart).buttonStyle(.primary).accessibilityIdentifier("start-setup")
                Button("Explore with a demo learner’s history") { model.loadDemo() }.buttonStyle(.ghost).accessibilityIdentifier("load-demo")
            }
        }
        .background(OS.bg)
    }

    private func feature(_ icon: String, _ title: String, _ sub: String) -> some View {
        HStack(spacing: 12) {
            IconTile(systemImage: icon)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.weight(.semibold)).foregroundStyle(OS.ink)
                Text(sub).font(.subheadline).foregroundStyle(OS.muted)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct SetupView: View {
    @Environment(AppModel.self) private var model
    let onBack: () -> Void
    @State private var step = 1
    @State private var filing = ""
    @State private var unsure = false
    @State private var s6520 = false
    @State private var filingError = ""
    @State private var stateCode = ""
    @State private var interview = ""
    @State private var interviewError = ""
    @State private var loaded = false

    private var today: DateOnly { model.today }
    private var preview: Route {
        routeFor(filingDate: !unsure && validateFiling(date: filing, unsure: false, today: today).isEmpty ? filing : nil, filingDateUnknown: unsure, specialConsideration: s6520)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button {
                    step == 1 ? onBack() : (step -= 1)
                } label: {
                    Image(systemName: "chevron.left").font(.title3.weight(.semibold)).frame(width: 44, height: 44)
                }
                .accessibilityLabel("Back")
                VStack(alignment: .leading, spacing: 6) {
                    Text("Set up · step \(step) of 5").font(.meta).foregroundStyle(OS.muted)
                    StepsBar(count: 5, current: step - 1)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 8)
            .background(OS.surface)
            Page {
                switch step {
                case 1: language
                case 2: filingStep
                case 3: placeStep
                case 4: exceptionsStep
                default: summaryStep
                }
            }
            ActionBar {
                Button(step == 5 ? "Start practicing" : "Continue", action: next).buttonStyle(.primary).accessibilityIdentifier("setup-next")
                if step == 3 || step == 4 {
                    Button("Skip for now") {
                        if step == 3 { interview = ""; interviewError = "" }
                        step += 1
                    }
                    .buttonStyle(.ghost)
                }
            }
        }
        .background(OS.bg)
        .onAppear {
            guard !loaded else { return }
            loaded = true
            let p = model.data.profile
            filing = p.filingDate ?? ""
            unsure = p.filingDateUnknown
            s6520 = p.specialConsideration
            stateCode = p.state ?? ""
            interview = model.data.journey.interview.date
        }
    }

    // MARK: Steps

    private var language: some View {
        VStack(alignment: .leading, spacing: 16) {
            heading("Which language helps you study?", "Questions stay in English, like the interview. Help uses your language.")
            Text("Study language").font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
            ForEach([("English", ""), ("Español", "Spanish · not yet available"), ("中文", "Chinese · not yet available"), ("Tiếng Việt", "Vietnamese · not yet available"), ("Tagalog", "not yet available"), ("বাংলা", "Bengali · not yet available")], id: \.0) { lang in
                let on = lang.1.isEmpty
                HStack(spacing: 12) {
                    Image(systemName: on ? "largecircle.fill.circle" : "circle").foregroundStyle(on ? OS.teal : OS.control)
                    Text(lang.0).font(.body.weight(.semibold)).foregroundStyle(on ? OS.ink : OS.muted)
                    Text(lang.1).font(.meta).foregroundStyle(OS.muted)
                    Spacer()
                }
                .padding(14)
                .background(on ? OS.tealSoft : OS.surface, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(on ? OS.teal : OS.line, lineWidth: 1.5))
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
            Text("Help is in English only until a reviewed translation is ready.").font(.meta).foregroundStyle(OS.muted)
        }
    }

    private var filingStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            heading("When did you file Form N-400?", "It decides your civics test. It’s on your receipt notice (I-797C).")
            if !unsure {
                DateOnlyField(label: "Filing date", value: $filing, help: "Month, day and year.", maximum: today, error: filingError)
                    .onChange(of: filing) { filingError = "" }
            }
            Toggle(isOn: $unsure) { Text("I’m not sure").font(.body.weight(.semibold)) }
                .toggleStyle(CheckToggle())
                .onChange(of: unsure) { filingError = "" }
            if preview.key != .none { RouteCard(route: preview) }
            if unsure {
                VStack(alignment: .leading, spacing: 6) {
                    Label("Test version not chosen yet", systemImage: "flag").font(.body.weight(.semibold)).foregroundStyle(OS.amber)
                    Text("Before Oct 20, 2025: 2008 test. On or after: 2025 test.").foregroundStyle(OS.ink)
                }
                .card(.amber)
                .accessibilityIdentifier("route-none")
            }
            Text("Rules checked Oct 5, 2026. Confirm before your interview.").font(.meta).foregroundStyle(OS.muted)
        }
    }

    private var placeStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            heading("Where you live and your interview", "Both optional.")
            VStack(alignment: .leading, spacing: 6) {
                Text("State or territory (optional)").font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
                Picker("State or territory", selection: $stateCode) {
                    Text("Choose one (optional)").tag("")
                    ForEach(US_STATES) { Text($0.name).tag($0.code) }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
                .background(OS.surface, in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(OS.control, lineWidth: 1.5))
            }
            DateOnlyField(label: "Interview date (optional)", value: $interview, help: "From your interview notice.", error: interviewError)
                .onChange(of: interview) { interviewError = "" }
        }
    }

    private var exceptionsStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            heading("Exceptions and special consideration", "OathSteps can’t decide if these apply to you.")
            VStack(alignment: .leading, spacing: 10) {
                Text("65/20 special consideration").font(.h2).foregroundStyle(OS.ink)
                Text("65+ and a resident 20+ years when you filed: 20 questions, 10 asked, 6 to pass.").foregroundStyle(OS.ink)
                Toggle(isOn: $s6520) { Text("Use the 65/20 format (my choice)") }.toggleStyle(CheckToggle())
                ExternalLink(title: "8 CFR Part 312: educational requirements", url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-C/part-312")
            }
            .card()
            VStack(alignment: .leading, spacing: 10) {
                Text("English exceptions").font(.h2).foregroundStyle(OS.ink)
                Text("50/20 or 55/15: no English test, civics still required. Disability: Form N-648.").foregroundStyle(OS.ink)
                ExternalLink(title: "USCIS: Form N-648 fact sheet (PDF)", url: "https://www.uscis.gov/sites/default/files/document/fact-sheets/FactSheet_N-648_MedCertForDisabilityExceptions.pdf")
            }
            .card()
        }
    }

    private var summaryStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            heading("Check your study path", "Change anything that looks wrong.")
            VStack(spacing: 0) {
                summaryRow("Study language", "English", to: 1, label: "Change study language")
                Divider()
                summaryRow("Civics test", preview.key == .none ? "Not chosen yet" : "\(preview.name)\(!filing.isEmpty && !unsure ? " · filed \(fmtDate(filing))" : "")", to: 2, label: "Change filing date and test")
                Divider()
                summaryRow("State or territory", stateName(stateCode) ?? "Not added", to: 3, label: "Change state")
                Divider()
                summaryRow("Interview date", interview.isEmpty ? "Not added" : fmtDate(interview), to: 3, label: "Change interview date")
            }
            .card(padding: 14)
            if preview.key == .none { Text("Add your filing date later in Settings.").card(.amber) }
            Text("Saved on this device only.").font(.meta).foregroundStyle(OS.muted)
        }
    }

    private func summaryRow(_ k: String, _ v: String, to: Int, label: String) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(k).font(.meta).foregroundStyle(OS.muted)
                Text(v).font(.body.weight(.semibold)).foregroundStyle(OS.ink)
            }
            Spacer()
            Button("Change") { step = to }.buttonStyle(.ghost).accessibilityLabel(label)
        }
        .padding(.vertical, 8)
    }

    private func heading(_ title: String, _ help: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
            Text(help).foregroundStyle(OS.muted)
        }
    }

    // MARK: Flow

    private func next() {
        switch step {
        case 2:
            let e = validateFiling(date: filing, unsure: unsure, today: today)
            if !e.isEmpty { filingError = e; return }
            step = 3
        case 3:
            let e = validateInterviewDate(interview, filing: unsure ? nil : filing)
            if !e.isEmpty { interviewError = e; return }
            step = 4
        case 5:
            finish()
        default:
            step += 1
        }
    }

    private func finish() {
        let t = today
        model.update { d in
            d.updateProfile { p in
                p.filingDate = unsure ? nil : filing
                p.filingDateUnknown = unsure
                p.specialConsideration = s6520
                p.state = stateCode.isEmpty ? nil : stateCode
                p.onboarded = true
            }
            if !interview.isEmpty { d.setJourneySlot(.interview, Slot(status: interview >= t ? "scheduled" : "attended", date: interview)) }
            if !unsure && !filing.isEmpty { d.setChecklist(ChecklistEntry(itemId: "path", completedAt: nowIso(), remind: false)) }
        }
        model.say("You’re set. Your study path is saved on this device.")
    }
}

/// The study path card shown when a filing date decides the test.
struct RouteCard: View {
    let route: Route
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Your study path").font(.meta).foregroundStyle(OS.muted)
            Text(route.name).font(.h2).foregroundStyle(OS.ink)
            ForEach(route.lines, id: \.self) { l in
                Label(l, systemImage: "checkmark").foregroundStyle(OS.ink)
            }
            Text(route.reason).foregroundStyle(OS.muted)
        }
        .card(.guide)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("route-card")
    }
}

/// A checkbox-style toggle, matching the design's check rows.
struct CheckToggle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Image(systemName: configuration.isOn ? "checkmark.square.fill" : "square")
                    .font(.title3)
                    .foregroundStyle(configuration.isOn ? OS.teal : OS.control)
                configuration.label.foregroundStyle(OS.ink).multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(configuration.isOn ? [.isButton, .isSelected] : .isButton)
        .accessibilityValue(configuration.isOn ? "Checked" : "Not checked")
    }
}
