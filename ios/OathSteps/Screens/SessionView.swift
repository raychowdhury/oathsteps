import OathStepsCore
import SwiftUI

private enum Grade { case got, again, unsure, choice }

struct SessionView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let kind: SessionKind

    @State private var started = false
    @State private var queue: [String] = []
    @State private var i = 0
    @State private var revealed = false
    @State private var attempt = ""
    @State private var choice: String?
    @State private var results: [(id: String, r: Grade)] = []
    @State private var requeued: Set<String> = []
    @State private var attemptId = newId()
    @State private var done = false
    @State private var sheet: SheetKind?
    @State private var confirmEnd = false
    @State private var startSnapshot: Snapshot?

    enum SheetKind: String, Identifiable {
        case source, report, confirm
        var id: String { rawValue }
    }

    private var isChoice: Bool { model.data.profile.mode == .choice }
    private var question: Question? { i < queue.count ? model.content.question(queue[i]) : nil }

    var body: some View {
        Group {
            if !started {
                Color.clear
            } else if queue.isEmpty {
                Page {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Nothing to practice here yet.").font(.body.weight(.semibold))
                        Button("Back to Practice") { dismiss() }.buttonStyle(.secondary)
                    }
                    .foregroundStyle(OS.ink)
                    .card()
                }
            } else if done {
                doneView
            } else if let q = question {
                cardView(q)
            }
        }
        .navigationTitle("Practice")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(!done && !queue.isEmpty && started)
        .toolbar {
            if !done && !queue.isEmpty && started {
                ToolbarItem(placement: .topBarLeading) {
                    Button { confirmEnd = true } label: { Label("End session", systemImage: "chevron.left") }
                        .accessibilityIdentifier("end-session-button")
                }
            }
        }
        .confirmationDialog("End this session?", isPresented: $confirmEnd, titleVisibility: .visible) {
            Button("End session") {
                model.say("Session ended. Marked answers are saved.")
                dismiss()
            }
            .accessibilityIdentifier("end-session")
            Button("Keep going", role: .cancel) {}
        } message: {
            Text("Marked answers are saved.")
        }
        .sheet(item: $sheet) { k in
            if let q = question {
                switch k {
                case .source: SourceSheet(question: q, route: model.snapshot.route)
                case .report: ReportSheet(question: q)
                case .confirm: ConfirmDynamicSheet(question: q)
                }
            }
        }
        .onAppear(perform: start)
        .onChange(of: i) { autoplay() }
    }

    // MARK: Start

    private func start() {
        guard !started else { return }
        let s = model.snapshot
        startSnapshot = s
        queue = select(s)
        started = true
        autoplay()
    }

    private func select(_ s: Snapshot) -> [String] {
        switch kind {
        case .daily: return s.dailyIds()
        case .review: return s.dueIds()
        case .fresh: return Array(s.newIds().prefix(5))
        case .weak:
            let u = s.uncertainIds()
            return u.isEmpty ? s.weakIds() : u
        case .uncertain: return s.uncertainIds()
        case .saved: return s.savedIds()
        case .topic(let t): return s.questions.filter { $0.subsection == t }.map(\.id)
        case .ids(let ids, _): return ids
        }
    }

    private func autoplay() {
        if let q = question, model.data.profile.autoplay, !revealed { model.speaker.speak(q.prompt, rate: model.data.profile.audioRate) }
    }

    // MARK: Recording

    private func record(_ q: Question, _ outcome: Outcome, method: AssessmentMethod, prompted: Bool) {
        let unresolved = q.dynamic != nil && model.data.dynamicAnswers[q.id] == nil
        let context: PracticeContext = {
            switch kind {
            case .review, .weak, .uncertain: return .review
            case .topic: return .topic
            default: return .practice
            }
        }()
        let a = PracticeAttempt(id: attemptId, questionId: q.id, bank: q.bank, packVersion: model.content.pack(q.bank).version, outcome: outcome, method: unresolved && method == .selfUnprompted ? .selfHinted : method, prompted: prompted || unresolved, context: context, at: nowIso())
        model.update { $0.recordAttempt(a) }
    }

    private func grade(_ q: Question, _ g: Grade) {
        record(q, g == .got ? .correct : g == .again ? .incorrect : .uncertain, method: .selfUnprompted, prompted: false)
        var next = queue
        if g == .again && !requeued.contains(q.id) {
            next.append(q.id)
            requeued.insert(q.id)
        }
        advance(next, g, q.id)
    }

    private func advance(_ next: [String], _ g: Grade, _ id: String) {
        results.append((id, g))
        queue = next
        revealed = false
        attempt = ""
        choice = nil
        attemptId = newId()
        if i + 1 >= next.count {
            let today = model.today
            let daily = kind == .daily
            model.update { d in
                d.meta.sessions += 1
                if daily { d.markDay(today, review: true, fresh: true) }
            }
            done = true
        } else {
            i += 1
        }
    }

    // MARK: Card

    @ViewBuilder
    private func cardView(_ q: Question) -> some View {
        let varies = q.dynamic != nil
        let mc: MultipleChoice? = isChoice ? buildMultipleChoice(ChoiceQuestion(id: q.id, subsection: q.subsection, answers: q.answers, dynamic: varies), pool: model.content.questions(practiceBank(model.snapshot.route), special: false).map { ChoiceQuestion(id: $0.id, subsection: $0.subsection, answers: $0.answers, dynamic: $0.dynamic != nil) }, rng: SeededRng(seed: hashId(q.id))) : nil
        let saved = model.data.bookmarks[q.id] != nil
        Page {
            HStack(alignment: .bottom, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Question \(i + 1) of \(queue.count)").font(.meta).foregroundStyle(OS.muted).accessibilityIdentifier("q-position")
                    StepsBar(count: queue.count, current: i)
                }
                Tag(text: q.subsection, tone: .neutral).multilineTextAlignment(.trailing)
            }
            if isChoice {
                Text("Multiple choice · not counted as recall").font(.body.weight(.semibold)).foregroundStyle(OS.ink).card(.amber, padding: 12)
            }
            VStack(alignment: .leading, spacing: 14) {
                Text(q.prompt).font(.title2.weight(.semibold)).foregroundStyle(OS.ink).accessibilityIdentifier("q-text").accessibilityAddTraits(.isHeader)
                HStack(spacing: 12) {
                    ListenButton(text: q.prompt)
                    Button {
                        model.update { $0.toggleBookmark(q.id) }
                    } label: {
                        Label(saved ? "Saved" : "Save", systemImage: saved ? "bookmark.fill" : "bookmark")
                    }
                    .buttonStyle(.ghost)
                    .accessibilityAddTraits(saved ? .isSelected : [])
                    .accessibilityIdentifier("save-question")
                }
                if !isChoice && !revealed {
                    VStack(alignment: .leading, spacing: 6) {
                        (Text("Your answer ").font(.subheadline.weight(.semibold)) + Text("(optional)").font(.meta).foregroundColor(OS.muted)).foregroundStyle(OS.ink)
                        TextField("Say it out loud, or type it here", text: $attempt, axis: .vertical)
                            .lineLimit(2...4)
                            .padding(12)
                            .background(OS.surface, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(OS.control, lineWidth: 1.5))
                            .accessibilityLabel("Your answer, optional")
                    }
                }
                if isChoice && !varies, let mc {
                    Text("Choose one").font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
                    ForEach(mc.options, id: \.self) { opt in
                        let correct = opt == mc.correct
                        let on = choice == opt
                        Button {
                            guard choice == nil else { return }
                            choice = opt
                            revealed = true
                            record(q, correct ? .correct : .incorrect, method: .multipleChoice, prompted: true)
                        } label: {
                            HStack {
                                Text(opt).foregroundStyle(OS.ink).multilineTextAlignment(.leading)
                                Spacer()
                                if revealed && correct { Tag(text: "Correct answer", tone: .ok) }
                                if revealed && on && !correct { Tag(text: "Your choice", tone: .neutral) }
                            }
                            .padding(14)
                            .background((revealed ? correct : on) ? OS.tealSoft : OS.surface, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder((revealed ? correct : on) ? OS.teal : OS.line, lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                        .disabled(revealed)
                    }
                }
                if isChoice && varies && !revealed {
                    Text("No choices: the answer depends on where you live.").card(.amber, padding: 12)
                }
            }
            .card()
            if revealed { answerCard(q) }
        }
        .safeAreaInset(edge: .bottom) {
            ActionBar {
                if !revealed && !isChoice {
                    Button("Show answer") { revealed = true }.buttonStyle(.primary).accessibilityIdentifier("reveal")
                }
                if revealed && (!isChoice || varies) {
                    Text("How did you do, honestly?").font(.meta).foregroundStyle(OS.muted)
                    HStack(spacing: 8) {
                        gradeButton("I got it", "checkmark", primary: true) { grade(q, .got) }.accessibilityIdentifier("grade-got")
                        gradeButton("Review again", "arrow.counterclockwise") { grade(q, .again) }.accessibilityIdentifier("grade-again")
                        gradeButton("Not sure", "flag") { grade(q, .unsure) }.accessibilityIdentifier("grade-unsure")
                    }
                }
                if revealed && isChoice && !varies {
                    Button("Next question") { advance(queue, .choice, q.id) }.buttonStyle(.primary).accessibilityIdentifier("choice-next")
                }
                if !revealed && isChoice {
                    Button("Show the answer guidance") { revealed = true }.buttonStyle(.neutralFill)
                }
            }
        }
    }

    private func gradeButton(_ title: String, _ icon: String, primary: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                Text(title).font(.footnote.weight(.semibold)).multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity, minHeight: 60)
            .foregroundStyle(primary ? .white : OS.ink)
            .background(primary ? OS.teal : OS.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(primary ? OS.teal : OS.control, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }

    private func answerCard(_ q: Question) -> some View {
        let varies = q.dynamic != nil
        let conf = model.data.dynamicAnswers[q.id]
        let head = q.requiredCount > 1 ? "Accepted answers · give \(q.requiredCount)" : q.answers.count > 1 ? "Accepted answers · any one is enough" : "Accepted answer"
        let state = model.data.profile.state
        let variesText = state == "DC" ? "In D.C., answer as the official list says for the District." : stateName(state).map { "Check the current answer for your state (\($0)) on an official site." } ?? "Add your state in Settings, then check its official website."
        return VStack(alignment: .leading, spacing: 12) {
            if !varies {
                Text(head).font(.meta).foregroundStyle(OS.muted)
                FlowChips(items: q.answers.map(\.text))
            } else if let rule = q.dynamic {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Answer depends on where you live", systemImage: "flag").font(.body.weight(.semibold)).foregroundStyle(OS.amber)
                    Text(conf.map { "You confirmed: \($0.answer) (\($0.region), checked \($0.confirmedOn))." } ?? variesText).foregroundStyle(OS.ink).accessibilityIdentifier("dynamic-status")
                    if let note = q.answers.first?.note { Text(note).font(.meta).foregroundStyle(OS.muted) }
                    ExternalLink(title: rule.lookupLabel, url: rule.lookupUrl)
                    Button(conf == nil ? "Record the answer I confirmed" : "Update the answer I confirmed") { sheet = .confirm }
                        .buttonStyle(.secondary)
                        .accessibilityIdentifier("confirm-dynamic")
                }
                .card(.amber, padding: 12)
            }
            if !attempt.isEmpty && !isChoice {
                (Text("You wrote: ").font(.meta).foregroundColor(OS.muted) + Text(attempt)).foregroundStyle(OS.ink)
            }
            HStack {
                Text(q.bank == .v2008 ? "From the 2008 list" : "From the 2025 list").font(.meta).foregroundStyle(OS.muted)
                Spacer()
                Button("Source and details") { sheet = .source }.buttonStyle(.ghost)
                Button("Report an issue") { sheet = .report }.buttonStyle(.ghost)
            }
        }
        .card()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("answer-card")
    }

    // MARK: Done

    private var doneView: some View {
        let got = results.filter { $0.r == .got }.count
        let again = results.filter { $0.r == .again }.count
        let unsure = results.filter { $0.r == .unsure }.count
        let s = model.snapshot
        let writing = s.suggestWriting()
        let showNext = kind == .daily && !s.data.dayProgress(s.today).english
        return Page {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "stairs").font(.title.weight(.bold)).foregroundStyle(.white).frame(width: 56, height: 56).background(OS.teal, in: RoundedRectangle(cornerRadius: 14)).accessibilityHidden(true)
                Text("Session complete").font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
                Text("You practiced \(results.count) answers.").foregroundStyle(OS.muted)
            }
            HStack(spacing: 10) {
                count(got, "Got it", .ok, "count-got")
                count(again, "Again", .neutral, "count-again")
                count(unsure, "Not sure", .amber, "count-unsure")
            }
            if results.contains(where: { $0.r == .choice }) { Text("Multiple-choice answers aren’t counted as recall.").font(.meta).foregroundStyle(OS.muted) }
            Text("Missed answers come back sooner.").foregroundStyle(OS.muted)
            if showNext {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Next in today’s plan · about 3 min").font(.meta).foregroundStyle(OS.muted)
                    Text(writing ? "Writing: one sentence" : "Reading: one sentence").font(.h2)
                    Text("Up to three tries at the interview.")
                    NavigationLink(writing ? "Start writing practice" : "Start reading practice", value: writing ? Destination.writing : Destination.reading).buttonStyle(.primarySmall).fixedSize()
                }
                .foregroundStyle(OS.ink)
                .card(.guide)
            }
        }
        .accessibilityIdentifier("session-done")
        .safeAreaInset(edge: .bottom) {
            ActionBar { Button("Done") { dismiss() }.buttonStyle(.secondaryFill) }
        }
    }

    private func count(_ n: Int, _ label: String, _ tone: Tag.Tone, _ id: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(n)").font(.largeTitle.weight(.bold)).foregroundStyle(OS.ink).accessibilityIdentifier(id)
            Tag(text: label, tone: tone)
        }
        .card(padding: 14)
        .accessibilityElement(children: .combine)
    }
}

/// Wrapping chips for accepted answers.
struct FlowChips: View {
    let items: [String]
    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(items, id: \.self) { t in
                Text(t).font(.body).foregroundStyle(OS.ink).padding(.horizontal, 12).padding(.vertical, 8).background(OS.forestSoft, in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, maxX: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(ProposedViewSize(width: width, height: nil))
            if x > 0 && x + s.width > width { x = 0; y += row + spacing; row = 0 }
            x += s.width + spacing
            maxX = max(maxX, x)
            row = max(row, s.height)
        }
        return CGSize(width: min(maxX, width), height: y + row)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, row: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
            if x > bounds.minX && x + s.width > bounds.maxX { x = bounds.minX; y += row + spacing; row = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: min(s.width, bounds.width), height: s.height))
            x += s.width + spacing
            row = max(row, s.height)
        }
    }
}

private struct SourceSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let question: Question
    let route: OathStepsCore.Route

    var body: some View {
        let pack = model.content.pack(question.bank)
        let src = model.content.guide.sources[route.src]
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(question.prompt).foregroundStyle(OS.ink)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(pack.review.humanReviewed ? "Official wording · machine-checked and expert-reviewed" : "Official wording · machine-checked, not yet expert-reviewed").font(.body.weight(.semibold))
                        Text("Question \(question.number) of the \(question.bank.rawValue) list · pack \(pack.version)").font(.meta).foregroundStyle(OS.muted)
                    }
                    .foregroundStyle(OS.ink)
                    .card(pack.review.humanReviewed ? .guide : .amber)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Official source for your path").font(.meta).foregroundStyle(OS.muted)
                        if let src { ExternalLink(title: src.label, url: src.url) }
                    }
                    if question.dynamic != nil { Text("Changes with elections. Check before your interview.").foregroundStyle(OS.muted) }
                }
                .padding(16)
            }
            .background(OS.bg)
            .navigationTitle("Source and details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Close") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }
}

private let REPORT_REASONS = ["The answer looks wrong", "The answer is out of date", "Audio doesn’t match the text", "Translation problem", "Something else"]

private struct ReportSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let question: Question
    @State private var reason = ""
    @State private var text = ""
    @State private var error = false
    @State private var sent = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if sent {
                        VStack(alignment: .leading, spacing: 6) {
                            Label("Report saved", systemImage: "checkmark").font(.body.weight(.semibold)).foregroundStyle(OS.forest)
                            Text("Thanks. It stays on this device and is included in your export.").foregroundStyle(OS.ink)
                        }
                        .card(.ok)
                        Button("Back to the question") { dismiss() }.buttonStyle(.primary)
                    } else {
                        Text("Reports stay on this device until you export or sync them.").foregroundStyle(OS.muted)
                        Text("What’s the problem?").font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
                        ForEach(REPORT_REASONS, id: \.self) { r in
                            Button {
                                reason = r
                                error = false
                            } label: {
                                HStack {
                                    Image(systemName: reason == r ? "largecircle.fill.circle" : "circle").foregroundStyle(reason == r ? OS.teal : OS.control)
                                    Text(r).foregroundStyle(OS.ink)
                                    Spacer()
                                }
                                .padding(12)
                                .background(reason == r ? OS.tealSoft : OS.surface, in: RoundedRectangle(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(reason == r ? .isSelected : [])
                        }
                        if error { ErrorText(text: "Choose one problem so we know what to check.") }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Details (optional)").font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
                            TextField("Don’t include personal information", text: $text, axis: .vertical)
                                .lineLimit(3...6)
                                .padding(12)
                                .background(OS.surface, in: RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(OS.control, lineWidth: 1.5))
                                .onChange(of: text) { if text.count > 300 { text = String(text.prefix(300)) } }
                            Text("\(text.count) of 300 characters").font(.meta).foregroundStyle(OS.muted)
                        }
                        Button("Send report") {
                            guard !reason.isEmpty else { error = true; return }
                            let r = CorrectionReport(questionId: question.id, packVersion: model.content.pack(question.bank).version, reason: reason, message: String(text.prefix(300)), createdAt: nowIso())
                            model.update { $0.saveReport(r) }
                            sent = true
                        }
                        .buttonStyle(.primary)
                        .accessibilityIdentifier("send-report")
                    }
                }
                .padding(16)
            }
            .background(OS.bg)
            .navigationTitle("Report an issue")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
    }
}

private struct ConfirmDynamicSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let question: Question
    @State private var answer = ""
    @State private var region = ""
    @State private var date = ""
    @State private var error = ""
    @State private var loaded = false

    var body: some View {
        let scope = question.dynamic?.scope
        EditSheet(title: "Record the answer you confirmed", saveId: "save-dynamic", onSave: save) {
            Text("Check an official source first. This stays on your device and is never generated by the app.").foregroundStyle(OS.muted)
            field("Answer you confirmed", $answer, id: "dyn-answer")
            field(scope == .district ? "Your state and district" : scope == .state ? "Your state or territory" : "Applies to", $region, id: "dyn-region")
            DateOnlyField(label: "Date you checked", value: $date, maximum: model.today, allowClear: false)
            if !error.isEmpty { ErrorText(text: error) }
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            let c = model.data.dynamicAnswers[question.id]
            answer = c?.answer ?? ""
            region = c?.region ?? (scope == .federal ? "United States" : stateName(model.data.profile.state) ?? "")
            date = c?.confirmedOn ?? model.today
        }
    }

    private func field(_ label: String, _ value: Binding<String>, id: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
            TextField(label, text: value)
                .padding(12)
                .background(OS.surface, in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(OS.control, lineWidth: 1.5))
                .accessibilityIdentifier(id)
        }
    }

    private func save() {
        let a = answer.trimmingCharacters(in: .whitespaces), r = region.trimmingCharacters(in: .whitespaces)
        guard !a.isEmpty, !r.isEmpty else { error = "Enter the answer and where it applies."; return }
        let c = ConfirmedDynamicAnswer(questionId: question.id, answer: a, region: r, confirmedOn: date, sourceUrl: question.dynamic?.lookupUrl ?? "")
        model.update { $0.saveDynamicAnswer(c) }
        dismiss()
    }
}
