import OathStepsCore
import SwiftUI

struct InterviewView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let s = model.snapshot
        let rd = s.lastEnglish(.reading), wr = s.lastEnglish(.writing)
        let e = model.content.english
        Page {
            VStack(alignment: .leading, spacing: 8) {
                HStack { Text("Interview practice").font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader); DemoBadge() }
                Text("Civics, reading, writing and listening.").foregroundStyle(OS.muted)
            }
            VStack(spacing: 0) {
                row(.voice, "mic", "Civics out loud", "Voice optional", "5 questions from your list")
                Divider()
                row(.reading, "book", "Reading", "Read one sentence aloud", rd.map { "Last practiced \(fmtLocalDay($0.at))" } ?? "Not practiced yet")
                Divider()
                row(.writing, "pencil", "Writing", "Write one sentence you hear", wr.map { "Last practiced \(fmtLocalDay($0.at))" } ?? "Not practiced yet")
                Divider()
                row(.instructions, "bubble.left", "Interview instructions", "What the officer may say", "\(e.instructions.count) common phrases")
                Divider()
                row(.conversation, "doc.text", "N-400 words and conversation", "Key words, truthful answers", "\(e.vocabulary.count) words · \(e.conversation.count) prompts")
            }
            .card(padding: 12)
            VStack(alignment: .leading, spacing: 6) {
                Label("Always answer truthfully", systemImage: "info.circle").font(.body.weight(.semibold))
                Text("Use your own true answers. We never suggest them.")
            }
            .foregroundStyle(OS.ink)
            .card(.guide)
            VStack(alignment: .leading, spacing: 8) {
                SectionHeader(title: "English at the interview")
                (Text("Reading: ").bold() + Text("1 of up to 3 sentences")).foregroundStyle(OS.ink)
                (Text("Writing: ").bold() + Text("1 of up to 3 sentences")).foregroundStyle(OS.ink)
                (Text("Speaking: ").bold() + Text("throughout the interview")).foregroundStyle(OS.ink)
                ExternalLink(title: "USCIS: Test components (PDF)", url: "https://www.uscis.gov/sites/default/files/document/guides/test_components.pdf")
            }
            .card()
        }
        .navigationTitle("Interview")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { SettingsToolbar() }
    }

    private func row(_ d: Destination, _ icon: String, _ title: String, _ sub: String, _ meta: String) -> some View {
        NavigationLink(value: d) {
            HStack(spacing: 12) {
                IconTile(systemImage: icon)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.body.weight(.semibold)).foregroundStyle(OS.ink)
                    Text(sub).font(.subheadline).foregroundStyle(OS.muted)
                    Text(meta).font(.meta).foregroundStyle(OS.muted)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(OS.control)
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("interview-\(title)")
    }
}

private func answerHead(_ q: Question) -> String {
    q.requiredCount > 1 ? "Accepted answers · give \(q.requiredCount)" : q.answers.count > 1 ? "Accepted answers · any one is enough" : "Accepted answer"
}

// MARK: - Voice

struct VoiceView: View {
    @Environment(AppModel.self) private var model
    enum Step { case intro, denied, unsupported, listening, processing, result, typed, selfCheck }
    enum Verdict { case accepted, review, inconclusive }

    @State private var pool: [Question] = []
    @State private var qi = 0
    @State private var step: Step = .intro
    @State private var permission: Bool?
    @State private var askMic = false
    @State private var transcript = ""
    @State private var verdict: Verdict = .inconclusive
    @State private var typed = ""
    @State private var typedResult: Bool?
    @State private var selfShown = false
    @State private var listener = Listener()

    var body: some View {
        Group {
            if pool.isEmpty { Color.clear } else { content(pool[qi % pool.count]) }
        }
        .navigationTitle("Interview")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard pool.isEmpty else { return }
            let seed = UInt32(model.today.replacingOccurrences(of: "-", with: "")) ?? 1
            pool = Array(shuffle(model.snapshot.questions.filter { $0.dynamic == nil }, SeededRng(seed: seed)).prefix(5))
            if !Listener.onDeviceAvailable { step = .unsupported }
        }
        .alert("OathSteps would like to use the microphone", isPresented: $askMic) {
            Button("Don’t allow", role: .cancel) { permission = false; step = .denied }
            Button("Continue") { listen() }.accessibilityIdentifier("mic-allow")
        } message: {
            Text("Only while you practice aloud. Your iPhone turns what you say into text on the device. Nothing is recorded or kept. iOS asks next.")
        }
    }

    private func content(_ q: Question) -> some View {
        let canStart = step == .intro || step == .denied || step == .result
        let canGrade = step == .result || (step == .typed && typedResult != nil) || (step == .selfCheck && selfShown)
        let showAlt = step == .intro || step == .denied || step == .unsupported
        let showBack = step == .typed || step == .selfCheck
        return Page {
            HStack {
                Text("Civics out loud").font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
                Spacer()
                Tag(text: "Experimental", tone: .amber)
            }
            VStack(alignment: .leading, spacing: 10) {
                Text("Question \(qi % pool.count + 1) of \(pool.count)").font(.meta).foregroundStyle(OS.muted).accessibilityIdentifier("voice-position")
                Text(q.prompt).font(.title2.weight(.semibold)).foregroundStyle(OS.ink)
                ListenButton(text: q.prompt)
            }
            .card()
            switch step {
            case .intro:
                info("Voice is optional", "Speech recognition turns what you say into text on this iPhone, so you can compare it with the accepted answers. Nothing is recorded, kept or sent. You always decide the result.", tone: .guide)
            case .unsupported:
                info("Voice isn’t available on this device", "Type or check yourself instead. OathSteps only uses speech recognition that runs on the device.", tone: .amber, icon: "mic.slash")
            case .denied:
                info("Microphone is off", "Type or check yourself instead. To use voice, allow the microphone and speech recognition for OathSteps in Settings.", tone: .amber, icon: "mic.slash")
            case .listening:
                status("mic.fill", "Listening", "Say your answer, then tap Stop.")
            case .processing:
                status("clock", "Checking what we heard", "Comparing with the accepted answers")
            case .result:
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("Heard (on-device speech recognition)").font(.meta).foregroundStyle(OS.muted)
                        Spacer()
                        Tag(text: verdict == .accepted ? "Matches an accepted answer" : verdict == .review ? "Needs review" : "Inconclusive", tone: verdict == .accepted ? .ok : verdict == .review ? .amber : .neutral)
                    }
                    Text(transcript.isEmpty ? "No clear speech detected" : transcript).font(.h2).italic(transcript.isEmpty).foregroundStyle(transcript.isEmpty ? OS.muted : OS.ink)
                    Text(verdict == .accepted ? "Check it’s what you meant." : verdict == .review ? "Part didn’t match. You decide." : "Couldn’t hear clearly. Doesn’t count against you.").foregroundStyle(OS.ink)
                }
                .card()
                answers(q, note: "You decide the result below.")
            case .typed:
                VStack(alignment: .leading, spacing: 10) {
                    Text("Type your answer").font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
                    TextField("Your answer", text: $typed)
                        .padding(12)
                        .background(OS.surface, in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(OS.control, lineWidth: 1.5))
                        .onChange(of: typed) { typedResult = nil }
                        .accessibilityIdentifier("voice-typed")
                    Button("Check against accepted answers") { typedResult = answerMatches(typed, q.answers) }.buttonStyle(.secondary).accessibilityIdentifier("voice-check-typed")
                    if let r = typedResult {
                        Tag(text: r ? "Matches an accepted answer" : "Doesn’t match exactly. Compare below.", tone: r ? .ok : .amber).accessibilityIdentifier("voice-typed-result")
                        Text(answerHead(q)).font(.meta).foregroundStyle(OS.muted)
                        FlowChips(items: q.answers.map(\.text))
                    }
                }
                .card()
            case .selfCheck:
                VStack(alignment: .leading, spacing: 10) {
                    Text("Say it aloud, then check.").foregroundStyle(OS.muted)
                    if selfShown {
                        Text(answerHead(q)).font(.meta).foregroundStyle(OS.muted)
                        FlowChips(items: q.answers.map(\.text))
                    } else {
                        Button("Show answer") { selfShown = true }.buttonStyle(.secondary).accessibilityIdentifier("voice-self-reveal")
                    }
                }
                .card()
            }
        }
        .safeAreaInset(edge: .bottom) {
            ActionBar {
                if canStart {
                    Button { start() } label: { Label(step == .result ? "Try again" : step == .denied ? "Try the microphone again" : "Answer with my voice", systemImage: "mic") }
                        .buttonStyle(.primary)
                        .accessibilityIdentifier("voice-start")
                }
                if step == .listening {
                    Button { listener.stop() } label: { Label("Stop", systemImage: "stop.fill") }.buttonStyle(.danger).accessibilityIdentifier("voice-stop")
                }
                if canGrade {
                    HStack(spacing: 8) {
                        Button("I got it") { grade(q, .correct) }.buttonStyle(.primary).accessibilityIdentifier("voice-got")
                        Button("Review again") { grade(q, .incorrect) }.buttonStyle(.neutralFill)
                        Button("Not sure") { grade(q, .uncertain) }.buttonStyle(.neutralFill)
                    }
                }
                if showAlt {
                    HStack(spacing: 8) {
                        Button("Type instead") { step = .typed; typed = ""; typedResult = nil }.buttonStyle(.neutralFill).accessibilityIdentifier("voice-type")
                        Button("Check myself") { step = .selfCheck; selfShown = false }.buttonStyle(.neutralFill).accessibilityIdentifier("voice-self")
                    }
                }
                if showBack {
                    Button(permission == false || !Listener.onDeviceAvailable ? "Back to options" : "Use my voice instead") {
                        step = permission == false ? .denied : Listener.onDeviceAvailable ? .intro : .unsupported
                    }
                    .buttonStyle(.ghost)
                }
            }
        }
    }

    private func info(_ title: String, _ body: String, tone: CardTone, icon: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let icon { Label(title, systemImage: icon).font(.body.weight(.semibold)).foregroundStyle(OS.amber) } else { Text(title).font(.body.weight(.semibold)) }
            Text(body)
        }
        .foregroundStyle(OS.ink)
        .card(tone)
    }

    private func status(_ icon: String, _ title: String, _ sub: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon).font(.largeTitle).foregroundStyle(OS.tealStrong).symbolEffect(.pulse, isActive: icon == "mic.fill")
            Text(title).font(.h2).foregroundStyle(OS.ink)
            Text(sub).foregroundStyle(OS.muted)
        }
        .frame(maxWidth: .infinity)
        .card()
        .accessibilityElement(children: .combine)
    }

    private func answers(_ q: Question, note: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(answerHead(q)).font(.meta).foregroundStyle(OS.muted)
            FlowChips(items: q.answers.map(\.text))
            Text(note).font(.meta).foregroundStyle(OS.muted)
        }
        .card()
    }

    private func start() {
        if !Listener.onDeviceAvailable { step = .unsupported; return }
        if permission == true { listen() } else { askMic = true }
    }

    private func listen() {
        step = .listening
        Task {
            let r = await listener.listen(maxSeconds: 15)
            let q = pool[qi % pool.count]
            switch r {
            case .denied:
                permission = false
                step = .denied
                return
            case .unsupported:
                step = .unsupported
                return
            case .heard(let t):
                permission = true
                transcript = t
                verdict = answerMatches(t, q.answers) ? .accepted : .review
            case .noSpeech, .failed:
                permission = true
                transcript = ""
                verdict = .inconclusive
            }
            step = .processing
            try? await Task.sleep(for: .milliseconds(600))
            step = .result
        }
    }

    private func grade(_ q: Question, _ outcome: Outcome) {
        let method: AssessmentMethod = step == .typed ? .typedMatch : step == .result ? .voiceSelf : .selfUnprompted
        let a = PracticeAttempt(questionId: q.id, bank: q.bank, packVersion: model.content.pack(q.bank).version, outcome: outcome, method: method, prompted: false, context: .voice, at: nowIso())
        model.update { $0.recordAttempt(a) }
        qi += 1
        step = permission == false ? .denied : Listener.onDeviceAvailable ? .intro : .unsupported
        typed = ""
        typedResult = nil
        selfShown = false
        transcript = ""
        model.say(outcome == .correct ? "Saved as “I got it”. Next question." : "Saved. This question will come back sooner.")
    }
}

// MARK: - Reading

struct ReadingView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var idx = 0
    @State private var attempt = 1
    @State private var results: [Bool] = []
    @State private var status = "active"

    var body: some View {
        let items = model.content.english.reading
        let item = items[idx % items.count]
        Page {
            VStack(alignment: .leading, spacing: 4) {
                Text("Reading practice").font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
                Text("Attempt \(min(attempt, 3)) of 3 · sentence \(idx % items.count + 1)").font(.meta).foregroundStyle(OS.muted).accessibilityIdentifier("reading-attempt")
            }
            Text("Read it aloud. Accents are fine.").foregroundStyle(OS.muted)
            VStack(alignment: .leading, spacing: 12) {
                Text(item.text).font(.title.weight(.semibold)).foregroundStyle(OS.ink).accessibilityIdentifier("reading-sentence")
                Button { model.speaker.speak(item.text, rate: model.data.profile.audioRate) } label: { Label("Hear it after you try", systemImage: "speaker.wave.2") }.buttonStyle(.ghost)
            }
            .card()
            if status == "done" {
                VStack(alignment: .leading, spacing: 4) {
                    Label("You read it clearly", systemImage: "checkmark").font(.body.weight(.semibold)).foregroundStyle(OS.forest)
                    Text("One correct sentence passes. Your own check.").foregroundStyle(OS.ink)
                }
                .card(.ok)
            }
            if status == "out" {
                VStack(alignment: .leading, spacing: 4) {
                    Text("That’s three tries").font(.body.weight(.semibold))
                    Text("Try a new sentence later.")
                }
                .foregroundStyle(OS.ink)
                .card(.amber)
            }
            HStack(spacing: 6) {
                Text("This attempt’s history:").font(.meta).foregroundStyle(OS.muted)
                if results.isEmpty { Tag(text: "None yet", tone: .neutral) }
                ForEach(Array(results.enumerated()), id: \.offset) { i, r in Tag(text: "Try \(i + 1): \(r ? "clear" : "had trouble")", tone: r ? .ok : .neutral) }
            }
        }
        .safeAreaInset(edge: .bottom) {
            ActionBar {
                if status == "active" {
                    HStack(spacing: 8) {
                        Button("I read it clearly") { finish(true, item) }.buttonStyle(.primary).accessibilityIdentifier("read-clear")
                        Button("I had trouble") { finish(false, item) }.buttonStyle(.neutralFill).accessibilityIdentifier("read-trouble")
                    }
                } else {
                    HStack(spacing: 8) {
                        Button("Another sentence") { idx += 1; attempt = 1; results = []; status = "active" }.buttonStyle(.secondaryFill)
                        Button("Done") { dismiss() }.buttonStyle(.primary)
                    }
                }
            }
        }
        .navigationTitle("Interview")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func finish(_ ok: Bool, _ item: EnglishTasks.Sentence) {
        results.append(ok)
        if !ok && attempt < 3 { attempt += 1; return }
        let rec = EnglishTaskRecord(kind: .reading, taskId: item.id, outcome: ok ? .correct : .incorrect, text: ok ? "Read clearly (your own check)" : "Had trouble after 3 tries", at: nowIso())
        let today = model.today
        model.update { d in
            d.recordEnglishTask(rec)
            d.markDay(today, english: true)
        }
        status = ok ? "done" : "out"
    }
}

// MARK: - Writing

struct WritingView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var idx = 0
    @State private var attempt = 1
    @State private var input = ""
    @State private var result: WordDiff?
    @State private var checked = false
    @State private var show = false

    var body: some View {
        let items = model.content.english.writing
        let item = items[idx % items.count]
        let canRetry = checked && (result?.diffs ?? 0) > 0 && attempt < 3
        let finished = checked && !canRetry
        Page {
            VStack(alignment: .leading, spacing: 4) {
                Text("Writing practice").font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
                Text("Attempt \(min(attempt, 3)) of 3 · sentence \(idx % items.count + 1)").font(.meta).foregroundStyle(OS.muted).accessibilityIdentifier("writing-attempt")
            }
            Text("Listen, then write it.").foregroundStyle(OS.muted)
            VStack(alignment: .leading, spacing: 12) {
                Button { model.speaker.speak(item.text, rate: model.data.profile.audioRate) } label: { Label("Listen to the sentence", systemImage: "speaker.wave.2") }.buttonStyle(.secondary)
                if show {
                    Text(item.text).font(.title2.weight(.semibold)).foregroundStyle(OS.ink)
                } else {
                    Button("Can’t play audio? Show the sentence briefly") {
                        show = true
                        Task { try? await Task.sleep(for: .seconds(5)); show = false }
                    }
                    .buttonStyle(.ghost)
                    .accessibilityIdentifier("write-peek")
                }
                Text("Write the sentence").font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
                TextField("", text: $input)
                    .textInputAutocapitalization(.sentences)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(OS.surface, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(OS.control, lineWidth: 1.5))
                    .disabled(checked)
                    .accessibilityLabel("Write the sentence")
                    .accessibilityIdentifier("write-input")
            }
            .card()
            if let r = result {
                VStack(alignment: .leading, spacing: 8) {
                    Text(describeDiff(r)).font(.body.weight(.semibold)).accessibilityIdentifier("write-result")
                    Text("Sentence").font(.meta).foregroundStyle(OS.muted)
                    FlowLayout(spacing: 6) {
                        ForEach(Array(r.words.enumerated()), id: \.offset) { _, w in
                            Text(w.t).underline(!w.ok, color: OS.amber).fontWeight(w.ok ? .regular : .bold)
                                .accessibilityLabel(w.ok ? w.t : "\(w.t), different")
                        }
                    }
                    Text("Underlined words differ.").font(.meta).foregroundStyle(OS.muted)
                    if finished { Text("Saved as your own check.").font(.meta).foregroundStyle(OS.muted) }
                }
                .foregroundStyle(OS.ink)
                .card(r.diffs == 0 ? .ok : .amber)
            }
        }
        .safeAreaInset(edge: .bottom) {
            ActionBar {
                if !checked {
                    Button("Check my sentence") { check(item) }.buttonStyle(.primary).accessibilityIdentifier("write-check")
                } else if canRetry {
                    Button("Try again · attempt \(min(attempt + 1, 3)) of 3") { attempt += 1; input = ""; result = nil; checked = false }.buttonStyle(.primary).accessibilityIdentifier("write-retry")
                } else {
                    HStack(spacing: 8) {
                        Button("Another sentence") { idx += 1; attempt = 1; input = ""; result = nil; checked = false; show = false }.buttonStyle(.secondaryFill)
                        Button("Done") { dismiss() }.buttonStyle(.primary)
                    }
                }
            }
        }
        .navigationTitle("Interview")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func check(_ item: EnglishTasks.Sentence) {
        guard !input.trimmingCharacters(in: .whitespaces).isEmpty else {
            model.say("Write the sentence first, then check.")
            return
        }
        let r = compareWords(item.text, input)
        if r.diffs == 0 || attempt >= 3 {
            let rec = EnglishTaskRecord(kind: .writing, taskId: item.id, outcome: r.diffs == 0 ? .correct : .incorrect, text: r.diffs == 0 ? "Matched the sentence" : describeDiff(r), at: nowIso())
            let today = model.today
            model.update { d in
                d.recordEnglishTask(rec)
                d.markDay(today, english: true)
            }
        }
        result = r
        checked = true
        show = false
    }
}

// MARK: - Instructions and conversation

struct InstructionsView: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        Page {
            VStack(alignment: .leading, spacing: 8) {
                Text("Interview instructions").font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
                Text("Common things an officer says.").foregroundStyle(OS.muted)
            }
            VStack(spacing: 0) {
                ForEach(model.content.english.instructions) { r in
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("“\(r.text)”").font(.body.weight(.semibold)).foregroundStyle(OS.ink)
                            Text(r.meaning).foregroundStyle(OS.muted)
                        }
                        Spacer()
                        Button { model.speaker.speak(r.text, rate: model.data.profile.audioRate) } label: { Image(systemName: "speaker.wave.2") }
                            .buttonStyle(.ghost)
                            .accessibilityLabel("Listen to “\(r.text)”")
                    }
                    .padding(.vertical, 10)
                    Divider()
                }
            }
            .card(padding: 14)
            VStack(alignment: .leading, spacing: 4) {
                Text("It’s okay to ask").font(.body.weight(.semibold))
                Text("“Could you repeat that, please?”")
            }
            .foregroundStyle(OS.ink)
            .card(.guide)
        }
        .navigationTitle("Interview")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ConversationView: View {
    @Environment(AppModel.self) private var model
    @State private var cv = 0

    var body: some View {
        let e = model.content.english
        let c = e.conversation[cv % e.conversation.count]
        Page {
            VStack(alignment: .leading, spacing: 8) {
                Text("N-400 words and conversation").font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
                Text("Key words, then practice out loud.").foregroundStyle(OS.muted)
            }
            VStack(alignment: .leading, spacing: 6) {
                Label("Use your own true information", systemImage: "info.circle").font(.body.weight(.semibold)).foregroundStyle(OS.amber)
                Text("We don’t suggest, save or check them. Legal questions? Ask a qualified advisor.").foregroundStyle(OS.ink)
            }
            .card(.amber)
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Practice a conversation")
                Text("Prompt \(cv % e.conversation.count + 1) of \(e.conversation.count)").font(.meta).foregroundStyle(OS.muted)
                VStack(alignment: .leading, spacing: 4) {
                    Text("The officer might ask").font(.meta).foregroundStyle(OS.muted)
                    Text("“\(c.prompt)”").font(.h2).foregroundStyle(OS.ink).accessibilityIdentifier("convo-prompt")
                }
                .card(.guide, padding: 12)
                ListenButton(text: c.prompt)
                Text(c.tip).foregroundStyle(OS.muted)
                HStack(spacing: 8) {
                    Button("Previous") { cv = (cv + e.conversation.count - 1) % e.conversation.count }.buttonStyle(.neutralFill)
                    Button("Next prompt") { cv += 1 }.buttonStyle(.primary).accessibilityIdentifier("convo-next")
                }
            }
            .card()
            VStack(alignment: .leading, spacing: 0) {
                SectionHeader(title: "Words to know").padding(.bottom, 6)
                ForEach(e.vocabulary) { r in
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(r.term).font(.body.weight(.semibold)).foregroundStyle(OS.ink)
                            Text(r.meaning).foregroundStyle(OS.muted)
                        }
                        Spacer()
                        Button { model.speaker.speak(r.term, rate: model.data.profile.audioRate) } label: { Image(systemName: "speaker.wave.2") }
                            .buttonStyle(.ghost)
                            .accessibilityLabel("Listen to \(r.term)")
                    }
                    .padding(.vertical, 10)
                    Divider()
                }
            }
            .card(padding: 14)
        }
        .navigationTitle("Interview")
        .navigationBarTitleDisplayMode(.inline)
    }
}
