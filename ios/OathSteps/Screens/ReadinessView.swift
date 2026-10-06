import OathStepsCore
import SwiftUI

/// What the learner has practiced, in counts with their definitions. Never a prediction or percentage.
struct ReadinessView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let s = model.snapshot
        let den = s.questions.count
        let seen = s.encountered()
        let unsure = s.uncertainIds()
        let mocks = s.data.finishedMocks.filter { $0.result != nil && $0.finishedAt != nil }.sorted { $0.finishedAt! > $1.finishedAt! }.prefix(3)
        let bankNote = s.route.key == .none ? "Practicing the 2025 list (\(den) questions) until you add your filing date." : "Full list for your path: \(den) question\(den == 1 ? "" : "s")."

        Page {
            VStack(alignment: .leading, spacing: 6) {
                Text("Readiness details").font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
                Text("What you’ve practiced. Not a prediction.").foregroundStyle(OS.muted)
            }
            if s.demo { Tag(text: "Includes illustrative demo history", tone: .amber) }
            count(seen, of: den, title: "Questions you’ve seen", help: "Practiced at least once.", meta: bankNote, id: "rd-seen") {
                if seen == 0 { NavigationLink("Start practicing", value: Destination.session(.daily)).buttonStyle(.secondary) }
            }
            count(s.delayedRecalled(), of: den, title: "Recalled after a gap", help: "From memory, no hints, a day or more later.", meta: "Checked by you or a matched answer.", id: "rd-delayed") {}
            count(unsure.count, of: nil, title: "Answers to try again", help: "Marked not sure or review again.", meta: nil, id: "rd-unsure") {
                if !unsure.isEmpty { NavigationLink("Review these now", value: Destination.session(.weak)).buttonStyle(.secondary) }
            }
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Recent practice mocks")
                Text("Last three. Practice only.").foregroundStyle(OS.muted)
                if mocks.isEmpty {
                    Text("No mocks yet.").font(.meta).foregroundStyle(OS.muted)
                    NavigationLink("Try the sample walkthrough", value: Destination.mock(.walkthrough)).buttonStyle(.secondary)
                }
                ForEach(Array(mocks), id: \.config.id) { m in
                    let r = m.result!
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(m.config.kind == .walkthrough ? "Sample walkthrough" : "Full-format mock\(m.config.special ? " · 65/20" : "")").font(.body.weight(.semibold))
                            Text(fmtLocalDay(m.finishedAt)).font(.meta).foregroundStyle(OS.muted)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("\(r.correct) of \(r.attempted) correct").font(.body.weight(.semibold))
                            Text("\(r.incorrect) incorrect · \(r.uncertain) not sure").font(.meta).foregroundStyle(OS.muted)
                        }
                    }
                    .foregroundStyle(OS.ink)
                    .padding(.top, 8)
                    .overlay(alignment: .top) { Divider() }
                    .accessibilityElement(children: .combine)
                }
            }
            .card()
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "English tasks")
                Text("Your own checks, not official scores.").foregroundStyle(OS.muted)
                english("Reading", icon: "text.book.closed", s.lastEnglish(.reading), id: "rd-reading")
                english("Writing", icon: "pencil", s.lastEnglish(.writing), id: "rd-writing")
                NavigationLink("Practice reading", value: Destination.reading).buttonStyle(.ghost)
            }
            .card()
        }
        .navigationTitle("Readiness")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func count<Extra: View>(_ n: Int, of den: Int?, title: String, help: String, meta: String?, id: String, @ViewBuilder extra: () -> Extra) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(n)").font(.largeTitle.weight(.bold)).foregroundStyle(OS.ink)
                if let den { Text("of \(den)").font(.headline).foregroundStyle(OS.muted) }
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier(id)
            Text(title).font(.h2).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
            Text(help).foregroundStyle(OS.muted)
            if let meta { Text(meta).font(.meta).foregroundStyle(OS.muted) }
            extra()
        }
        .card()
    }

    private func english(_ title: String, icon: String, _ rec: EnglishTaskRecord?, id: String) -> some View {
        HStack(spacing: 12) {
            IconTile(systemImage: icon)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.weight(.semibold)).foregroundStyle(OS.ink)
                Text(rec.map { "Last: \(fmtLocalDay($0.at)) · \($0.text)" } ?? "Not practiced yet").font(.meta).foregroundStyle(OS.muted).accessibilityIdentifier(id)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
