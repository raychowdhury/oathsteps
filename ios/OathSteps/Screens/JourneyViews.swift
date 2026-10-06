import OathStepsCore
import SwiftUI
import UniformTypeIdentifiers

/// The learner's own case dates: a timeline they edit, the guide entry, what is next and reminders.
struct JourneyView: View {
    @Environment(AppModel.self) private var model
    @State private var editing: MilestoneKey?

    var body: some View {
        let d = model.data
        let filing = d.profile.filingDate
        let guideItems = model.content.guide.allItems
        let guideDone = guideItems.filter { d.checklist[$0.id]?.completedAt != nil }.count

        Page {
            TabHeading(title: "Your journey", showPath: false, note: "Dates you enter. Not connected to USCIS.")
            milestones(filing: filing)
            NavigationLink(value: Destination.guide(open: nil)) {
                RowLabel(icon: "list.bullet.clipboard", title: "Preparation guide", subtitle: "\(guideDone) of \(guideItems.count) done")
            }
            .buttonStyle(.plain)
            .card(.guide, padding: 12)
            .accessibilityIdentifier("open-guide")
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Coming up")
                ForEach(upNext(d.journey, filing: filing, today: model.today), id: \.self) { line in
                    Label { Text(line).foregroundStyle(OS.ink) } icon: { Image(systemName: "chevron.right").foregroundStyle(OS.tealStrong) }
                }
            }
            .card()
            reminders
            VStack(alignment: .leading, spacing: 4) {
                Text("Case status updates").font(.body.weight(.semibold))
                Text("Later. Needs approved USCIS access.").foregroundStyle(OS.muted)
            }
            .foregroundStyle(OS.ink)
            .card(.neutral)
        }
        .navigationTitle("Journey")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { SettingsToolbar() }
        .sheet(item: $editing) { MilestoneSheet(key: $0) }
    }

    private func milestones(filing: DateOnly?) -> some View {
        let route = routeFor(model.data.profile)
        return VStack(alignment: .leading, spacing: 0) {
            SectionHeader(title: "Milestones", trailing: "Entered by you").padding(.bottom, 10)
            ForEach(Array(MILESTONES.enumerated()), id: \.element.key) { i, m in
                let slot = slotFor(model.data.journey, m.key, filing: filing)
                let note = m.key == .filed && !slot.date.isEmpty ? "Sets your test: \(route.short)." : m.key == .outcome && slot.status == "retest" ? "Usually 60–90 days later." : nil
                MilestoneRow(title: m.title, label: statusLabel(m.key, slot.status), slot: slot, note: note, last: i == MILESTONES.count - 1) { editing = m.key }
                    .accessibilityIdentifier("ms-\(m.key.rawValue)")
            }
            Text("Approval and the oath are separate steps.").font(.meta).foregroundStyle(OS.muted).padding(.top, 6)
        }
        .card()
    }

    private var reminders: some View {
        let d = model.data
        let appts = d.profile.reminders.appointments ? appointmentReminders(d.journey, today: model.today).map { ("appt", $0.id, $0.title) } : []
        let study = d.profile.reminders.study ? d.checklist.values.filter { $0.remind && $0.completedAt == nil }.sorted { $0.itemId < $1.itemId }.map { ("study", "task:\($0.itemId)", model.content.guide.item($0.itemId)?.text ?? "Guide task") } : []
        let all = appts + study
        let events = calendarEvents
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                SectionHeader(title: "Reminders")
                ShareLink(item: CalendarFile(text: buildIcs(events)), preview: SharePreview("OathSteps appointments")) {
                    Label("Add to calendar", systemImage: "calendar.badge.plus")
                }
                .buttonStyle(.ghost)
                .disabled(events.isEmpty)
                .accessibilityIdentifier("export-ics")
            }
            if all.isEmpty {
                Text("Nothing due today.").foregroundStyle(OS.muted)
            } else {
                ForEach(all, id: \.1) { kind, _, title in
                    HStack(spacing: 10) {
                        Tag(text: kind == "appt" ? "Appointment" : "Study", tone: kind == "appt" ? .teal : .neutral)
                        Text(title).foregroundStyle(OS.ink)
                    }
                }
            }
            Text("With notifications allowed in Settings, iPhone reminds you 7 days and 1 day before each scheduled appointment, and on the day. The calendar file holds the dates you entered.")
                .font(.meta).foregroundStyle(OS.muted)
        }
        .card()
    }

    private var calendarEvents: [CalendarEvent] {
        let j = model.data.journey
        return [MilestoneKey.bio, .interview, .oath].compactMap { k in
            let s = j[k]
            guard PENDING_STATES.contains(s.status), !s.date.isEmpty else { return nil }
            return CalendarEvent(uid: "\(k.rawValue)-\(s.date)", date: s.date, summary: "\(milestone(k).title) (OathSteps)", description: "Date entered by you. Confirm the time and location on your USCIS notice.")
        }
    }
}

private struct MilestoneRow: View {
    let title: String
    let label: String
    let slot: Slot
    let note: String?
    let last: Bool
    let edit: () -> Void

    private var done: Bool { DONE_STATES.contains(slot.status) }
    private var pending: Bool { PENDING_STATES.contains(slot.status) }
    private var noted: Bool { NOTED_STATES.contains(slot.status) }
    private var color: Color { done ? OS.forest : pending ? OS.tealStrong : noted ? OS.amber : OS.muted }
    private var dateText: String { !slot.date.isEmpty ? "\(fmtDate(slot.date)) · Manually entered" : slot.status == "reused" ? "No appointment · Manually entered" : "No date entered" }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                ZStack {
                    Circle().fill(done ? OS.forest : OS.surface).overlay(Circle().strokeBorder(done ? OS.forest : pending ? OS.tealStrong : noted ? OS.amber : OS.control, lineWidth: 2))
                    if done { Image(systemName: "checkmark").font(.caption.weight(.bold)).foregroundStyle(.white) }
                    else if pending { Image(systemName: "calendar").font(.caption2.weight(.bold)).foregroundStyle(OS.tealStrong) }
                    else if noted { Image(systemName: "note.text").font(.caption2.weight(.bold)).foregroundStyle(OS.amber) }
                }
                .frame(width: 26, height: 26)
                if !last { Rectangle().fill(OS.line).frame(width: 2).frame(maxHeight: .infinity) }
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.body.weight(.semibold)).foregroundStyle(OS.ink)
                (Text(label).fontWeight(.semibold).foregroundStyle(color) + Text(" · \(dateText)").foregroundStyle(OS.muted)).font(.meta)
                if let note { Text(note).font(.meta).foregroundStyle(OS.muted) }
            }
            .padding(.bottom, last ? 4 : 16)
            .accessibilityElement(children: .combine)
            Spacer(minLength: 4)
            Button("Edit", action: edit).buttonStyle(.ghost).accessibilityLabel("Edit \(title)")
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// An .ics file for the share sheet, so dates can go into any calendar app.
nonisolated struct CalendarFile: Transferable {
    let text: String
    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .calendarEvent) { Data($0.text.utf8) }
            .suggestedFileName("oathsteps-appointments.ics")
    }
}

/// The four-stage checklist with explanations, official links and per-step reminders.
struct GuideView: View {
    let open: String?
    @Environment(AppModel.self) private var model
    @State private var expanded: Set<String> = []
    @State private var sheet: SheetKind?
    @State private var scrolled = false

    enum SheetKind: String, Identifiable {
        case filing, outcome
        var id: String { rawValue }
    }

    var body: some View {
        let guide = model.content.guide
        ScrollViewReader { proxy in
            Page {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Preparation guide").font(.h1).foregroundStyle(OS.ink).accessibilityAddTraits(.isHeader)
                    Text("Your notices always come first.").foregroundStyle(OS.muted)
                }
                ForEach(guide.stages) { stage in
                    let doneCount = stage.items.filter { model.data.checklist[$0.id]?.completedAt != nil }.count
                    VStack(alignment: .leading, spacing: 0) {
                        SectionHeader(title: stage.title, trailing: "\(doneCount) of \(stage.items.count) done").padding(.bottom, 8)
                        ForEach(stage.items) { item in
                            Divider()
                            itemRow(item, guide: guide).id(item.id)
                        }
                    }
                    .card()
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("About this guide").font(.body.weight(.semibold))
                    Text(reviewLine(guide.review))
                }
                .foregroundStyle(OS.ink)
                .card(.amber)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Questions about your own case?").font(.body.weight(.semibold))
                    Text("Ask an immigration attorney or accredited representative.")
                    ExternalLink(title: "USCIS: find legal services", url: AppConfig.legalHelpURL)
                }
                .foregroundStyle(OS.ink)
                .card(.guide)
            }
            .task {
                guard let open, !scrolled else { return }
                scrolled = true
                expanded.insert(open)
                try? await Task.sleep(for: .milliseconds(250))
                withAnimation { proxy.scrollTo(open, anchor: .top) }
            }
        }
        .navigationTitle("Guide")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $sheet) { k in
            switch k {
            case .filing: FilingSheet()
            case .outcome: MilestoneSheet(key: .outcome)
            }
        }
    }

    private func itemRow(_ item: GuideItem, guide: Guide) -> some View {
        let entry = model.data.checklist[item.id]
        let done = entry?.completedAt != nil
        let isOpen = expanded.contains(item.id)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 4) {
                Toggle(isOn: Binding(get: { done }, set: { _ in toggleDone(item) })) {
                    Text(item.text).strikethrough(done).foregroundStyle(done ? OS.muted : OS.ink)
                }
                .toggleStyle(CheckToggle())
                .accessibilityIdentifier("task-\(item.id)")
                Button {
                    withAnimation(.easeOut(duration: 0.2)) {
                        if isOpen { expanded.remove(item.id) } else { expanded.insert(item.id) }
                    }
                } label: {
                    Image(systemName: "chevron.down").rotationEffect(.degrees(isOpen ? 180 : 0)).foregroundStyle(OS.control).frame(width: 44, height: 44)
                }
                .accessibilityLabel("\(isOpen ? "Hide" : "Show") details: \(item.text)")
                .accessibilityIdentifier("details-\(item.id)")
            }
            if isOpen {
                VStack(alignment: .leading, spacing: 10) {
                    Text(item.why).foregroundStyle(OS.ink)
                    if let action = item.action, let label = item.actionLabel {
                        Button(label) { act(action) }.buttonStyle(.secondary)
                    }
                    ForEach(item.links, id: \.self) { key in
                        if let src = guide.sources[key] { ExternalLink(title: src.label, url: src.url) }
                    }
                    Toggle("Remind me", isOn: Binding(get: { entry?.remind ?? false }, set: { _ in toggleRemind(item) }))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(OS.ink)
                        .accessibilityIdentifier("remind-\(item.id)")
                }
                .padding(.leading, 36)
                .padding(.bottom, 10)
            }
        }
        .padding(.vertical, 2)
    }

    private func act(_ action: GuideItem.Action) {
        switch action {
        case .filing: sheet = .filing
        case .journey: sheet = .outcome
        case .settings: model.showSettings = true
        }
    }

    private func toggleDone(_ item: GuideItem) {
        let cur = model.data.checklist[item.id]
        let was = cur?.completedAt != nil
        let remind = cur?.remind ?? false
        model.update { $0.setChecklist(ChecklistEntry(itemId: item.id, completedAt: was ? nil : nowIso(), remind: remind)) }
        if !was {
            model.say("Marked done: \(item.text)") { [weak model] in
                model?.update { $0.setChecklist(ChecklistEntry(itemId: item.id, completedAt: nil, remind: remind)) }
            }
        }
    }

    private func toggleRemind(_ item: GuideItem) {
        let cur = model.data.checklist[item.id]
        let next = !(cur?.remind ?? false)
        model.update { $0.setChecklist(ChecklistEntry(itemId: item.id, completedAt: cur?.completedAt, remind: next)) }
        guard next else { return }
        model.say(model.data.profile.reminders.study ? "Reminder saved for this step. It shows on Journey." : "Reminder saved. Study reminders are off in Settings, so it won’t show until you turn them on.")
    }
}

/// "Reviewed …" or "Draft, not expert-reviewed." plus the source check date, as on the web.
func reviewLine(_ r: ReviewInfo) -> String {
    let reviewed: String
    if r.humanReviewed {
        reviewed = "Reviewed" + (r.humanReviewedAt.map { " \(fmtDate($0))" } ?? "") + (r.reviewerCredential.map { " by \($0)" } ?? "") + "."
    } else {
        reviewed = "Draft, not expert-reviewed."
    }
    return reviewed + (r.reviewedAt.map { " Sources checked \(fmtDate($0))." } ?? "")
}
