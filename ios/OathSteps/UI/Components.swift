import OathStepsCore
import SwiftUI

/// Small pill: the study path tag, "Experimental", "Demo", topic names.
struct Tag: View {
    enum Tone { case teal, amber, neutral, ok }
    let text: String
    var tone: Tone = .teal
    var body: some View {
        Text(text)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(fg)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(bg, in: Capsule())
    }
    private var fg: Color { tone == .teal ? OS.tealStrong : tone == .amber ? OS.amber : tone == .ok ? OS.forest : OS.muted }
    private var bg: Color { tone == .teal ? OS.tealSoft : tone == .amber ? OS.amberSoft : tone == .ok ? OS.forestSoft : OS.neutralSoft }
}

/// Progress segments, as in the design's step bar.
struct StepsBar: View {
    let count: Int
    let current: Int
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<count, id: \.self) { i in
                Capsule().fill(i < current ? OS.teal : i == current ? OS.ink.opacity(0.85) : OS.line).frame(height: 5)
            }
        }
        .accessibilityHidden(true)
    }
}

/// Inline validation message, announced by VoiceOver.
struct ErrorText: View {
    let text: String
    var body: some View {
        Label(text, systemImage: "exclamationmark.circle")
            .font(.footnote.weight(.medium))
            .foregroundStyle(OS.amber)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.updatesFrequently)
            .onAppear { UIAccessibility.post(notification: .announcement, argument: text) }
    }
}

struct IconTile: View {
    let systemImage: String
    var tone: Tag.Tone = .teal
    var body: some View {
        Image(systemName: systemImage)
            .font(.body.weight(.semibold))
            .foregroundStyle(tone == .amber ? OS.amber : OS.tealStrong)
            .frame(width: 40, height: 40)
            .background(tone == .amber ? OS.amberSoft : OS.tealSoft, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .accessibilityHidden(true)
    }
}

/// A tappable row inside a card: icon, title, subtitle, chevron.
struct RowLabel: View {
    let icon: String
    let title: String
    var subtitle: String?
    var tone: Tag.Tone = .teal
    var body: some View {
        HStack(spacing: 12) {
            IconTile(systemImage: icon, tone: tone)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.weight(.semibold)).foregroundStyle(OS.ink)
                if let subtitle { Text(subtitle).font(.meta).foregroundStyle(OS.muted) }
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(OS.control).accessibilityHidden(true)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
}

/// Opens an official page in Safari, labeled so people know they leave the app.
struct ExternalLink: View {
    let title: String
    let url: String
    var body: some View {
        if let u = URL(string: url) {
            Link(destination: u) {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(title).underline().multilineTextAlignment(.leading)
                    Image(systemName: "arrow.up.right.square").font(.footnote).accessibilityHidden(true)
                }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(OS.tealStrong)
            }
            .accessibilityHint("Opens in Safari")
        }
    }
}

struct SectionHeader: View {
    let title: String
    var trailing: String?
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.h2).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
            Spacer()
            if let trailing { Text(trailing).font(.meta).foregroundStyle(OS.muted) }
        }
    }
}

/// Read a question aloud with the device's voices. Works offline.
struct ListenButton: View {
    @Environment(AppModel.self) private var model
    let text: String
    var body: some View {
        Button {
            model.speaker.speak(text, rate: model.data.profile.audioRate)
        } label: {
            Label("Listen", systemImage: "speaker.wave.2")
        }
        .buttonStyle(.secondary)
        .accessibilityHint("Reads the question aloud")
    }
}

/// Toolbar button that opens Settings from any tab.
struct SettingsToolbar: ToolbarContent {
    @Environment(AppModel.self) private var model
    var body: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button { model.showSettings = true } label: { Label("Settings", systemImage: "person.crop.circle") }
                .accessibilityIdentifier("open-settings")
        }
    }
}

/// Page scaffold: scrolling content on the design background with standard spacing.
struct Page<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) { content }
                .padding(.horizontal, 16)
                .padding(.vertical, 20)
                .frame(maxWidth: 720)
                .frame(maxWidth: .infinity)
        }
        .background(OS.bg)
    }
}

/// Bottom action bar, as in the design's sticky actions.
struct ActionBar<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(spacing: 8) { content }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
            .background(OS.surface.shadow(.drop(color: .black.opacity(0.06), radius: 6, y: -2)))
    }
}

/// A date chosen with the system picker, stored as YYYY-MM-DD, with an explicit empty state.
struct DateOnlyField: View {
    let label: String
    @Binding var value: DateOnly
    var help: String?
    var maximum: DateOnly?
    var error: String = ""
    var allowClear = true
    @State private var picking = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
            HStack {
                Button {
                    picking = true
                } label: {
                    HStack {
                        Text(value.isEmpty ? "Choose a date" : fmtDate(value)).foregroundStyle(value.isEmpty ? OS.muted : OS.ink)
                        Spacer()
                        Image(systemName: "calendar").foregroundStyle(OS.tealStrong)
                    }
                    .padding(.horizontal, 14)
                    .frame(minHeight: 48)
                    .background(OS.surface, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(error.isEmpty ? OS.control : OS.amber, lineWidth: 1.5))
                }
                .accessibilityLabel("\(label): \(value.isEmpty ? "not set" : fmtDate(value))")
                .accessibilityHint("Opens a date picker")
                .accessibilityIdentifier(label)
                if allowClear && !value.isEmpty {
                    Button("Clear") { value = "" }.buttonStyle(.ghost)
                }
            }
            if let help { Text(help).font(.meta).foregroundStyle(OS.muted) }
            if !error.isEmpty { ErrorText(text: error) }
        }
        .sheet(isPresented: $picking) {
            DatePickerSheet(title: label, value: $value, maximum: maximum)
                .presentationDetents([.medium, .large])
        }
    }
}

private struct DatePickerSheet: View {
    let title: String
    @Binding var value: DateOnly
    var maximum: DateOnly?
    @Environment(\.dismiss) private var dismiss
    @State private var picked = Date()

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    var body: some View {
        NavigationStack {
            DatePicker(title, selection: $picked, in: range, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .environment(\.timeZone, TimeZone(identifier: "UTC")!)
                .padding()
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            value = formatDateOnly(picked, timeZone: TimeZone(identifier: "UTC")!)
                            dismiss()
                        }
                        .accessibilityIdentifier("date-done")
                    }
                }
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear {
            let start = value.isEmpty ? (maximum ?? todayDateOnly()) : value
            picked = parseInstant("\(start)T12:00:00Z") ?? Date()
        }
    }

    private var range: ClosedRange<Date> {
        let lower = parseInstant("1990-01-01T00:00:00Z")!
        let upper = parseInstant("\(maximum ?? "2100-12-31")T23:59:59Z")!
        return lower...upper
    }
}

/// Shown beside headings while the fictional demo history is loaded.
struct DemoBadge: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        if model.data.meta.illustrative { Tag(text: "Demo", tone: .neutral).accessibilityLabel("Demo data loaded").accessibilityIdentifier("demo-badge") }
    }
}

/// Tab-root heading: large title, the study path tag (opens the filing sheet) and the Demo badge.
struct TabHeading: View {
    @Environment(AppModel.self) private var model
    let title: String
    var showPath = true
    var note: String?
    @State private var filing = false

    var body: some View {
        let route = routeFor(model.data.profile)
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
            HStack(spacing: 10) {
                if showPath {
                    Button { filing = true } label: { Tag(text: route.short, tone: route.key == .none ? .amber : .teal) }
                        .accessibilityHint("Change filing date and test")
                        .accessibilityIdentifier("path-tag")
                }
                DemoBadge()
                if let note { Text(note).font(.meta).foregroundStyle(OS.muted) }
            }
        }
        .sheet(isPresented: $filing) { FilingSheet() }
    }
}
