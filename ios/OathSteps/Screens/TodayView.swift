import OathStepsCore
import SwiftUI

struct TodayView: View {
    @Environment(AppModel.self) private var model
    @State private var sheet: SheetKind?

    enum SheetKind: String, Identifiable {
        case filing, interview
        var id: String { rawValue }
    }

    var body: some View {
        let s = model.snapshot
        let tasks = s.planTasks()
        let minutes = tasks.filter { !$0.done }.reduce(0) { $0 + $1.mins }
        let studyDone = tasks.filter { $0.key != .english }.allSatisfy(\.done)
        let planDone = tasks.allSatisfy(\.done)
        let writing = s.suggestWriting()
        let startLabel = planDone ? "Practice more" : studyDone ? (writing ? "Start writing practice" : "Start reading practice") : "Start today’s practice"
        let start: Destination = !studyDone || planDone ? .session(.daily) : writing ? .writing : .reading

        Page {
            TabHeading(title: greeting(), note: "Saved on this device")
            if s.route.key == .none {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Your test version isn’t set", systemImage: "flag").font(.body.weight(.semibold)).foregroundStyle(OS.amber)
                    Text("Add your filing date to get the right test. Until then, practice uses the 2025 list.").foregroundStyle(OS.ink)
                    Button("Add filing date") { sheet = .filing }.buttonStyle(.secondary)
                }
                .card(.amber)
                .accessibilityIdentifier("no-version")
            }
            if let cd = s.countdown() {
                HStack(spacing: 14) {
                    Image(systemName: "calendar").font(.title3).foregroundStyle(OS.tealStrong).frame(width: 40, height: 40).background(OS.surface, in: RoundedRectangle(cornerRadius: 10))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(cd.text).font(.h2).foregroundStyle(OS.ink)
                        Text(cd.sub).font(.meta).foregroundStyle(OS.muted)
                    }
                    Spacer()
                    Button("Edit") { sheet = .interview }.buttonStyle(.ghost).accessibilityLabel("Edit interview date")
                }
                .card(.guide)
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("countdown")
            }
            planCard(tasks: tasks, minutes: minutes, planDone: planDone)
            improveCard(s)
            VStack(spacing: 0) {
                NavigationLink(value: Destination.readiness) { RowLabel(icon: "chart.bar", title: "Readiness details", subtitle: s.readinessTeaser()) }
                Divider()
                if let cd = s.countdown(), daysBetween(s.today, cd.date) >= 0 {
                    NavigationLink(value: Destination.guide(open: "notice")) { RowLabel(icon: "stairs", title: "Next: interview on \(fmtDate(cd.date))", subtitle: "Read your notice") }
                } else {
                    NavigationLink(value: Destination.journey) { RowLabel(icon: "stairs", title: "Add dates as notices arrive", subtitle: "Journey and guide") }
                }
            }
            .buttonStyle(.plain)
            .card(padding: 12)
        }
        .safeAreaInset(edge: .bottom) {
            ActionBar {
                NavigationLink(value: start) { Text(startLabel) }.buttonStyle(.primary).accessibilityIdentifier("start-today")
            }
        }
        .navigationTitle("OathSteps")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { SettingsToolbar() }
        .sheet(item: $sheet) { k in
            switch k {
            case .filing: FilingSheet()
            case .interview: MilestoneSheet(key: .interview, initialStatus: model.data.journey.interview.status == "none" ? "scheduled" : nil)
            }
        }
    }

    private func planCard(tasks: [PlanTask], minutes: Int, planDone: Bool) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "Today’s practice", trailing: "About \(minutes) min")
            ForEach(Array(tasks.enumerated()), id: \.element.id) { i, t in
                HStack(alignment: .top, spacing: 12) {
                    ZStack {
                        Circle().fill(t.done ? OS.teal : OS.surface).overlay(Circle().strokeBorder(t.done ? OS.teal : OS.control, lineWidth: 1.5))
                        if t.done { Image(systemName: "checkmark").font(.footnote.weight(.bold)).foregroundStyle(.white) } else { Text("\(i + 1)").font(.subheadline.weight(.bold)).foregroundStyle(OS.ink) }
                    }
                    .frame(width: 30, height: 30)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(t.title).font(.body.weight(.semibold)).foregroundStyle(OS.ink)
                        Text(t.why).font(.subheadline).foregroundStyle(OS.muted)
                        Text(t.time).font(.meta).foregroundStyle(OS.muted)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(t.done ? "Done: " : "")\(t.title). \(t.why). \(t.time)")
                .accessibilityIdentifier("plan-\(t.key.rawValue)")
            }
            if planDone {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Today’s plan is done", systemImage: "checkmark").font(.body.weight(.semibold)).foregroundStyle(OS.forest)
                    Text("Come back tomorrow for new reviews.").foregroundStyle(OS.ink)
                }
                .card(.ok, padding: 12)
            }
        }
        .card()
    }

    private func improveCard(_ s: Snapshot) -> some View {
        let unc = s.uncertainIds()
        let lastWr = s.lastEnglish(.writing)
        let saved = s.savedIds()
        return VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "What to improve")
            if unc.isEmpty && (lastWr == nil || lastWr?.outcome == .correct) && saved.isEmpty {
                Text("Nothing yet.").foregroundStyle(OS.muted)
            }
            VStack(spacing: 0) {
                if !unc.isEmpty {
                    NavigationLink(value: Destination.session(.weak)) { RowLabel(icon: "flag", title: "Review \(unc.count) answer\(unc.count == 1 ? "" : "s") to try again", subtitle: "Not sure or missed", tone: .amber) }
                }
                if let w = lastWr, w.outcome != .correct {
                    NavigationLink(value: Destination.writing) { RowLabel(icon: "pencil", title: "Writing: try one more sentence", subtitle: "Last try \(fmtLocalDay(w.at)): \(w.text)") }
                }
                if !saved.isEmpty {
                    NavigationLink(value: Destination.session(.saved)) { RowLabel(icon: "bookmark", title: "\(saved.count) saved question\(saved.count == 1 ? "" : "s")", subtitle: "Saved by you") }
                }
            }
            .buttonStyle(.plain)
            if s.demo { Text("Demo history, not real results.").font(.meta).foregroundStyle(OS.muted) }
        }
        .card()
    }
}
