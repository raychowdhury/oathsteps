import OathStepsCore
import SwiftUI

struct MockView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let kind: MockConfig.Kind
    @State private var attempt = ""
    @State private var revealed = false
    @State private var attemptId = newId()
    @State private var finished: MockState?
    @State private var confirmExit = false

    private var label: String { kind == .walkthrough ? "Sample walkthrough" : "Full-format mock" }
    private var active: MockState? {
        guard let o = model.data.openMock, o.config.kind == kind else { return nil }
        return o
    }

    var body: some View {
        Group {
            if let f = finished, let r = f.result {
                results(f, r)
            } else if let a = active {
                if a.status == .paused { paused(a) } else { running(a) }
            } else {
                intro
            }
        }
        .navigationTitle("Practice")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(active?.status == .active && finished == nil)
        .toolbar {
            if active?.status == .active && finished == nil {
                ToolbarItem(placement: .topBarLeading) {
                    Button { confirmExit = true } label: { Label(kind == .walkthrough ? "Exit walkthrough" : "Exit mock", systemImage: "chevron.left") }
                        .accessibilityIdentifier("exit-mock")
                }
            }
        }
        .confirmationDialog("Exit the \(kind == .walkthrough ? "walkthrough" : "mock")?", isPresented: $confirmExit, titleVisibility: .visible) {
            Button("Save and exit") {
                if let a = active, let p = try? pauseMock(a) { model.update { $0.saveMock(p) } }
                model.say("\(label) saved. Resume it from Practice.")
                dismiss()
            }
            .accessibilityIdentifier("pause-mock")
            Button("Keep going", role: .cancel) {}
        } message: {
            Text("Your answers are kept.")
        }
    }

    // MARK: Intro

    private var intro: some View {
        let s = model.snapshot
        let pool = s.mockPool()
        let canStart = kind == .walkthrough || s.route.key != .none
        let past = model.data.finishedMocks.filter { $0.config.kind == kind && $0.result != nil }.prefix(5)
        return Page {
            VStack(alignment: .leading, spacing: 8) {
                Text(label).font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
                Tag(text: kind == .walkthrough ? "Practice format · not a full mock" : "Real stop rule for your path", tone: kind == .walkthrough ? .amber : .teal)
            }
            Text(kind == .walkthrough ? "5 questions. Answer, then mark yourself." : "Up to \(s.route.asked ?? 20) questions. Answer out loud, then mark yourself.").foregroundStyle(OS.ink)
            VStack(alignment: .leading, spacing: 4) {
                Text("The real test for your path").font(.meta).foregroundStyle(OS.muted)
                Text(s.route.name).font(.body.weight(.semibold))
                Text(s.route.mock)
            }
            .foregroundStyle(OS.ink)
            .card(.guide)
            VStack(alignment: .leading, spacing: 8) {
                Label("Stop and resume any time.", systemImage: "checkmark")
                Label(kind == .walkthrough ? "Ends early at \(WALKTHROUGH_RULES.pass) correct or \(WALKTHROUGH_RULES.stopIncorrect) wrong." : "Ends early when the result is decided, like the real interview. Unsure counts as not correct.", systemImage: "checkmark")
            }
            .foregroundStyle(OS.ink)
            let unscorable = pool.filter(\.unscorable).count
            if unscorable > 0 { Text("\(unscorable) questions with changing answers are left out until you confirm them from an official source.").font(.meta).foregroundStyle(OS.muted) }
            if !past.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(title: kind == .walkthrough ? "Past walkthroughs" : "Past mocks")
                    ForEach(Array(past), id: \.config.id) { m in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(m.result!.correct) of \(m.result!.attempted) correct").font(.body.weight(.semibold))
                                Text(fmtLocalDay(m.finishedAt)).font(.meta).foregroundStyle(OS.muted)
                            }
                            Spacer()
                            Text("\(m.result!.incorrect) incorrect · \(m.result!.uncertain) not sure").font(.meta).foregroundStyle(OS.muted)
                        }
                        .foregroundStyle(OS.ink)
                    }
                }
                .card()
            }
        }
        .safeAreaInset(edge: .bottom) {
            ActionBar {
                Button(kind == .walkthrough ? "Start the walkthrough" : "Start the mock") { begin(s, pool) }
                    .buttonStyle(.primary)
                    .disabled(!canStart)
                    .accessibilityIdentifier("start-mock")
            }
        }
    }

    private func begin(_ s: Snapshot, _ pool: [Candidate]) {
        let bank = practiceBank(s.route)
        let now = nowIso()
        guard let m = try? createMock(id: newId(), kind: kind, bank: bank, packVersion: model.content.pack(bank).version, special: kind == .full && s.route.special, pool: pool, seed: randomSeed(), now: now), let started = try? startMock(m, now: now) else {
            model.say("No scorable questions are available for this mock.")
            return
        }
        model.update { $0.saveMock(started) }
        attemptId = newId()
    }

    // MARK: Paused

    private func paused(_ a: MockState) -> some View {
        Page {
            VStack(alignment: .leading, spacing: 10) {
                Text("\(label) paused").font(.body.weight(.semibold))
                Text("Question \(a.index + 1) of up to \(a.config.rules.asked) · \(a.answers.count) answered").font(.meta).foregroundStyle(OS.muted)
                HStack {
                    Button("End and see results") {
                        let ended = abandonMock(a, now: nowIso())
                        model.update { $0.saveMock(ended) }
                        finished = ended
                    }
                    .buttonStyle(.neutralFill)
                    Button("Resume") {
                        if let r = try? resumeMock(a) { model.update { $0.saveMock(r) } }
                    }
                    .buttonStyle(.primarySmall)
                    .accessibilityIdentifier("resume-mock")
                }
            }
            .foregroundStyle(OS.ink)
            .card(.guide)
        }
    }

    // MARK: Running

    @ViewBuilder
    private func running(_ a: MockState) -> some View {
        if let qid = currentQuestionId(a), let q = model.content.question(qid) {
            let c = a.answers.filter { $0.outcome == .correct }.count
            let w = a.answers.filter { $0.outcome == .incorrect }.count
            let u = a.answers.filter { $0.outcome == .uncertain }.count
            let total = a.config.rules.asked
            let head = q.requiredCount > 1 ? "Accepted answers · give \(q.requiredCount)" : q.answers.count > 1 ? "Accepted answers · any one is enough" : "Accepted answer"
            Page {
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(label) · question \(a.index + 1) of up to \(total)").font(.meta).foregroundStyle(OS.muted).accessibilityIdentifier("mock-position")
                    Text("Correct \(c) · Incorrect \(w) · Not sure \(u)").font(.meta).foregroundStyle(OS.muted).accessibilityIdentifier("mock-tally")
                    StepsBar(count: total, current: a.index)
                }
                VStack(alignment: .leading, spacing: 14) {
                    Text(q.prompt).font(.title2.weight(.semibold)).foregroundStyle(OS.ink).accessibilityIdentifier("mock-question")
                    ListenButton(text: q.prompt)
                    if !revealed {
                        TextField("Say it out loud, or type it here", text: $attempt, axis: .vertical)
                            .lineLimit(2...4)
                            .padding(12)
                            .background(OS.surface, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(OS.control, lineWidth: 1.5))
                            .accessibilityLabel("Your answer, optional")
                    }
                }
                .card()
                if revealed {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(head).font(.meta).foregroundStyle(OS.muted)
                        FlowChips(items: q.answers.map(\.text))
                        if q.dynamic != nil { Text("Depends on where you live.").foregroundStyle(OS.muted) }
                        if !attempt.isEmpty { (Text("You wrote: ").font(.meta).foregroundColor(OS.muted) + Text(attempt)).foregroundStyle(OS.ink) }
                    }
                    .card()
                }
            }
            .safeAreaInset(edge: .bottom) {
                ActionBar {
                    if !revealed {
                        Button("Show answer") { revealed = true }.buttonStyle(.primary).accessibilityIdentifier("mock-reveal")
                    } else {
                        HStack(spacing: 8) {
                            markButton("Correct", "checkmark", primary: true) { mark(a, .correct) }.accessibilityIdentifier("mock-correct")
                            markButton("Incorrect", "arrow.counterclockwise") { mark(a, .incorrect) }.accessibilityIdentifier("mock-incorrect")
                            markButton("Not sure", "flag") { mark(a, .uncertain) }.accessibilityIdentifier("mock-unsure")
                        }
                    }
                }
            }
        }
    }

    private func markButton(_ title: String, _ icon: String, primary: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                Text(title).font(.footnote.weight(.semibold))
            }
            .frame(maxWidth: .infinity, minHeight: 60)
            .foregroundStyle(primary ? .white : OS.ink)
            .background(primary ? OS.teal : OS.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(primary ? OS.teal : OS.control, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }

    private func mark(_ state: MockState, _ outcome: Outcome) {
        guard let qid = currentQuestionId(state) else { return }
        let at = nowIso()
        let attempt = PracticeAttempt(id: attemptId, questionId: qid, bank: state.config.bank, packVersion: state.config.packVersion, outcome: outcome, method: .mockSelf, prompted: false, context: .mock, mockId: state.config.id, at: at)
        guard let next = try? answerMock(state, outcome: outcome, at: at) else { return }
        model.update { d in
            d.recordAttempt(attempt)
            d.saveMock(next)
            if next.status == .finished { d.setChecklist(ChecklistEntry(itemId: "mock", completedAt: nowIso(), remind: false)) }
        }
        if next.status == .finished { finished = next }
        self.attempt = ""
        revealed = false
        attemptId = newId()
    }

    // MARK: Results

    private func results(_ m: MockState, _ r: MockResult) -> some View {
        let work = m.answers.filter { $0.outcome != .correct }.map(\.questionId)
        let stopNote = r.reason == .exhausted ? "All \(r.asked) questions asked." : r.reason == .abandoned ? "Ended early by you." : "Stopped early after \(r.reason == .reachedPass ? "\(r.pass) correct" : "\(m.config.rules.stopIncorrect) incorrect"), like the real stop rule."
        return Page {
            VStack(alignment: .leading, spacing: 4) {
                Text(kind == .walkthrough ? "Walkthrough results" : "Mock results").font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
                Text("\(fmtLocalDay(m.finishedAt)) · \(label.lowercased())\(m.config.special ? " · 65/20 format" : "")").font(.meta).foregroundStyle(OS.muted)
            }
            VStack(alignment: .leading, spacing: 12) {
                (Text("\(r.correct) ").font(.largeTitle.weight(.bold)) + Text("of \(r.attempted) correct").font(.title3)).foregroundStyle(OS.ink).accessibilityIdentifier("mock-score")
                Text(stopNote).foregroundStyle(OS.muted).accessibilityIdentifier("mock-stop-note")
                HStack {
                    stat(r.attempted, "Attempted")
                    stat(r.incorrect, "Incorrect")
                    stat(r.uncertain, "Not sure")
                }
            }
            .card()
            VStack(alignment: .leading, spacing: 4) {
                Text("Practice result only").font(.body.weight(.semibold))
                if kind == .full { Text("\(r.passed ? "Reached the passing mark (\(r.pass) correct)." : "Passing needs \(r.pass) correct.") Self-assessed, not a prediction.").font(.meta) }
            }
            .foregroundStyle(OS.ink)
            .card(.amber)
            VStack(alignment: .leading, spacing: 8) {
                SectionHeader(title: "Question by question")
                ForEach(Array(m.answers.enumerated()), id: \.offset) { _, a in
                    HStack(alignment: .top) {
                        Text(model.content.question(a.questionId)?.prompt ?? "").foregroundStyle(OS.ink)
                        Spacer()
                        Tag(text: a.outcome == .correct ? "Correct" : a.outcome == .incorrect ? "Incorrect" : "Not sure", tone: a.outcome == .correct ? .ok : a.outcome == .incorrect ? .neutral : .amber)
                    }
                    .padding(.vertical, 4)
                }
            }
            .card()
        }
        .accessibilityIdentifier("mock-results")
        .safeAreaInset(edge: .bottom) {
            ActionBar {
                if !work.isEmpty {
                    NavigationLink("Review the \(work.count) to work on", value: Destination.session(.ids(work, "Review"))).buttonStyle(.primary).accessibilityIdentifier("mock-review")
                }
                Button("Back to Practice") { dismiss() }.buttonStyle(.secondaryFill)
            }
        }
    }

    private func stat(_ n: Int, _ label: String) -> some View {
        VStack(alignment: .leading) {
            Text("\(n)").font(.body.weight(.semibold)).foregroundStyle(OS.ink)
            Text(label).font(.meta).foregroundStyle(OS.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}
