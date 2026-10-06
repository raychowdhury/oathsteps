import OathStepsCore
import SwiftUI

struct PracticeView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let s = model.snapshot
        let bank = practiceBank(s.route)
        let topics = model.content.topics(bank, special: s.route.special)
        let due = s.dueIds()
        let weak = s.weakIds()
        let review = model.content.pack(bank).review

        Page {
            TabHeading(title: "Practice", note: s.route.key == .none ? "Practicing the 2025 list until you add your filing date" : nil)
            Label {
                Text("Official questions: ").bold() + Text("\(s.questions.count) from the USCIS list\(s.route.special ? " (65/20 set)" : ""). ") + Text(review.humanReviewed ? "Wording and answers are machine-checked and expert-reviewed." : "Wording and answers are machine-checked, not yet expert-reviewed.")
            } icon: {
                Image(systemName: "info.circle").foregroundStyle(OS.tealStrong)
            }
            .foregroundStyle(OS.ink)
            .card(.guide)
            if let open = model.data.openMock {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(open.config.kind == .walkthrough ? "Walkthrough paused" : "Mock paused").font(.body.weight(.semibold))
                        Text("Question \(open.index + 1) of up to \(open.config.rules.asked) · \(open.answers.count) answered").font(.meta).foregroundStyle(OS.muted)
                    }
                    Spacer()
                    NavigationLink("Resume", value: Destination.mock(open.config.kind)).buttonStyle(.primarySmall).fixedSize()
                }
                .foregroundStyle(OS.ink)
                .card(.guide)
            }
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Due for review", trailing: "\(due.count) due")
                if due.isEmpty {
                    Text("Nothing due right now.").foregroundStyle(OS.muted)
                } else {
                    Text("Reviewing after a gap helps answers stick.").foregroundStyle(OS.muted)
                    NavigationLink("Review \(due.count) now", value: Destination.session(.review)).buttonStyle(.primarySmall).fixedSize()
                }
            }
            .card()
            .accessibilityIdentifier("due-section")
            VStack(alignment: .leading, spacing: 4) {
                SectionHeader(title: "Topics")
                ForEach(topics) { t in
                    NavigationLink(value: Destination.session(.topic(t.subsection))) { TopicRow(topic: t, data: model.data) }
                        .buttonStyle(.plain)
                    if t.id != topics.last?.id { Divider() }
                }
            }
            .card()
            weakCard(weak: weak)
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(title: "Mock tests")
                VStack(alignment: .leading, spacing: 6) {
                    Text("Sample walkthrough · 5 questions").font(.body.weight(.semibold))
                    Text("Answer, then check yourself.").foregroundStyle(OS.muted)
                    NavigationLink("Start walkthrough", value: Destination.mock(.walkthrough)).buttonStyle(.primarySmall).fixedSize().accessibilityIdentifier("start-walkthrough")
                }
                Divider()
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Full-format mock").font(.body.weight(.semibold))
                        if s.route.key == .none { Tag(text: "Needs your test version", tone: .neutral) }
                    }
                    Text(s.route.mock).foregroundStyle(OS.muted)
                    if s.route.key != .none {
                        NavigationLink("Start full-format mock", value: Destination.mock(.full)).buttonStyle(.secondary).fixedSize().accessibilityIdentifier("start-full-mock")
                    } else {
                        Text("Add your filing date in Settings or on Today.").font(.meta).foregroundStyle(OS.muted)
                    }
                }
            }
            .foregroundStyle(OS.ink)
            .card()
            howToPractice
        }
        .navigationTitle("Practice")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { SettingsToolbar() }
    }

    private func weakCard(weak: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Needs work and saved", trailing: "\(weak.count) questions")
            if weak.isEmpty { Text("Nothing here yet.").foregroundStyle(OS.muted) }
            ForEach(weak.prefix(20), id: \.self) { id in
                if let q = model.content.question(id) {
                    let r = model.data.reviewStates[id]
                    let tag = (r?.seenCount ?? 0) == 0 ? "Not practiced" : r?.lastOutcome == .uncertain ? "Not sure" : r?.lastOutcome == .incorrect ? "Review again" : "Got it last time"
                    NavigationLink(value: Destination.session(.ids([id], "Question"))) {
                        HStack {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(q.prompt).foregroundStyle(OS.ink).multilineTextAlignment(.leading)
                                HStack(spacing: 6) {
                                    Tag(text: tag, tone: r?.lastOutcome == .uncertain ? .amber : .neutral)
                                    if model.data.bookmarks[id] != nil { Tag(text: "Saved") }
                                }
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(OS.control)
                        }
                        .padding(.vertical, 6)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            if !weak.isEmpty {
                NavigationLink("Practice all of these", value: Destination.session(.weak)).buttonStyle(.secondary).fixedSize()
            }
        }
        .card()
    }

    private var howToPractice: some View {
        @Bindable var model = model
        let mode = model.data.profile.mode
        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "How to practice")
            Text("Answer mode").font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
            Picker("Answer mode", selection: Binding(get: { mode }, set: { m in model.update { $0.updateProfile { $0.mode = m } } })) {
                Text("Recall (recommended)").tag(PracticeMode.recall)
                Text("Multiple choice").tag(PracticeMode.choice)
            }
            .pickerStyle(.segmented)
            Text(mode == .recall ? "Like the interview. Counts toward progress." : "Easier. Doesn’t count toward progress.").font(.meta).foregroundStyle(OS.muted)
            Toggle("Read questions aloud", isOn: Binding(get: { model.data.profile.autoplay }, set: { v in model.update { $0.updateProfile { $0.autoplay = v } } }))
                .tint(OS.teal)
                .foregroundStyle(OS.ink)
        }
        .card()
    }
}

/// A topic row with six dots: filled = share answered correctly last time, dark = share that needs another try.
private struct TopicRow: View {
    let topic: Topic
    let data: AppData

    var body: some View {
        let total = Double(topic.questionIds.count)
        let states = topic.questionIds.map { data.reviewStates[$0] }
        let seen = states.filter { ($0?.seenCount ?? 0) > 0 }.count
        let done = Int((Double(states.filter { $0?.lastOutcome == .correct }.count) / total * 6).rounded())
        let now = Int((Double(states.filter { ($0?.seenCount ?? 0) > 0 && $0?.lastOutcome != .correct }.count) / total * 6).rounded())
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(topic.subsection).font(.body.weight(.semibold)).foregroundStyle(OS.ink).multilineTextAlignment(.leading)
                Text("Seen \(seen) of \(topic.questionIds.count) questions").font(.meta).foregroundStyle(OS.muted)
            }
            Spacer()
            HStack(spacing: 3) {
                ForEach(0..<6, id: \.self) { k in
                    Capsule().fill(k < done ? OS.teal : k < done + now ? OS.ink.opacity(0.75) : OS.line).frame(width: 10, height: 5)
                }
            }
            .accessibilityHidden(true)
            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(OS.control)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}
