import OathStepsCore
import SwiftUI

/// Sheet chrome: title, help text, content, Cancel and Save.
struct EditSheet<Content: View>: View {
    let title: String
    var saveLabel = "Save"
    var saveId = "save"
    let onSave: () -> Void
    @ViewBuilder var content: Content
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) { content }
                    .padding(16)
            }
            .background(OS.bg)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button(saveLabel, action: onSave).fontWeight(.semibold).accessibilityIdentifier(saveId) }
            }
        }
    }
}

struct FilingSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var date = ""
    @State private var unsure = false
    @State private var s6520 = false
    @State private var error = ""
    @State private var loaded = false

    private var preview: Route {
        routeFor(filingDate: !unsure && validateFiling(date: date, unsure: false, today: model.today).isEmpty ? date : nil, filingDateUnknown: unsure, specialConsideration: s6520)
    }

    var body: some View {
        EditSheet(title: "Filing date and test", saveId: "save-filing", onSave: save) {
            Text("It decides your test. See your receipt notice.").foregroundStyle(OS.muted)
            if !unsure {
                DateOnlyField(label: "N-400 filing date", value: $date, maximum: model.today, error: error).onChange(of: date) { error = "" }
            }
            Toggle(isOn: $unsure) { Text("I’m not sure") }.toggleStyle(CheckToggle()).onChange(of: unsure) { error = "" }
            Toggle(isOn: $s6520) { Text("Use the 65/20 format (my choice)") }.toggleStyle(CheckToggle())
            if preview.key != .none {
                VStack(alignment: .leading, spacing: 6) {
                    Text(preview.name).font(.body.weight(.semibold))
                    ForEach(preview.lines, id: \.self) { Text($0) }
                    Text(preview.reason).font(.meta).foregroundStyle(OS.muted)
                }
                .foregroundStyle(OS.ink)
                .card(.guide)
            } else {
                Text("No test chosen.").card(.amber)
            }
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            let p = model.data.profile
            date = p.filingDate ?? ""
            unsure = p.filingDateUnknown
            s6520 = p.specialConsideration
        }
    }

    private func save() {
        let e = validateFiling(date: date, unsure: unsure, today: model.today)
        if !e.isEmpty { error = e; return }
        let p = model.data.profile
        let before = routeFor(p).short
        let prev = (p.filingDate, p.filingDateUnknown, p.specialConsideration)
        let after = preview.short
        model.update { d in
            d.updateProfile { $0.filingDate = unsure ? nil : date; $0.filingDateUnknown = unsure; $0.specialConsideration = s6520 }
            if !unsure && !date.isEmpty { d.setChecklist(ChecklistEntry(itemId: "path", completedAt: nowIso(), remind: false)) }
        }
        model.say(before == after ? "Saved. Your test stays: \(after)." : "Study path changed to: \(after).") { [weak model] in
            model?.update { $0.updateProfile { $0.filingDate = prev.0; $0.filingDateUnknown = prev.1; $0.specialConsideration = prev.2 } }
        }
        dismiss()
    }
}

struct MilestoneSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let key: MilestoneKey
    var initialStatus: String?
    @State private var status = "none"
    @State private var date = ""
    @State private var error = ""
    @State private var loaded = false

    private var def: MilestoneDef { milestone(key) }
    private var filing: DateOnly? { model.data.profile.filingDate }
    private var dateLabel: String { PENDING_STATES.contains(status) ? "Appointment date" : status == "reused" ? "Date of notice (optional)" : "Date" }
    private var help: String { key == .filed ? "This can change your test." : key == .decision ? "The oath is a separate step." : "Use your notice." }

    var body: some View {
        EditSheet(title: "Edit: \(def.title)", saveId: "save-milestone", onSave: save) {
            Text(help).foregroundStyle(OS.muted)
            VStack(alignment: .leading, spacing: 6) {
                Text("Status").font(.subheadline.weight(.semibold)).foregroundStyle(OS.ink)
                Picker("Status", selection: $status) {
                    ForEach(def.opts, id: \.0) { Text($0.1).tag($0.0) }
                }
                .pickerStyle(.inline)
                .labelsHidden()
                .onChange(of: status) { error = "" }
            }
            if status != "none" {
                DateOnlyField(label: dateLabel, value: $date, maximum: key == .filed ? model.today : nil, error: error).onChange(of: date) { error = "" }
                if !needsDate(key, status) { Text("Optional for a reuse notice.").font(.meta).foregroundStyle(OS.muted) }
            }
            Text("Saved as manually entered.").font(.meta).foregroundStyle(OS.muted)
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            let current = slotFor(model.data.journey, key, filing: filing)
            status = initialStatus ?? current.status
            date = current.date
        }
    }

    private func save() {
        let e = validateMilestone(key: key, status: status, date: date, filing: filing, today: model.today)
        if !e.isEmpty { error = e; return }
        if key == .filed {
            let p = model.data.profile
            let prev = (p.filingDate, p.filingDateUnknown)
            let newDate: DateOnly? = status == "done" ? date : nil
            model.update { $0.updateProfile { $0.filingDate = newDate; $0.filingDateUnknown = status != "done" } }
            model.say("Saved. Study path: \(routeFor(filingDate: newDate, filingDateUnknown: status != "done", specialConsideration: p.specialConsideration).short).") { [weak model] in
                model?.update { $0.updateProfile { $0.filingDate = prev.0; $0.filingDateUnknown = prev.1 } }
            }
        } else {
            let prev = model.data.journey
            model.update { $0.setJourneySlot(key, Slot(status: status, date: status == "none" ? "" : date)) }
            model.say("\(def.title) saved.") { [weak model] in model?.update { $0.saveJourney(prev) } }
        }
        dismiss()
    }
}
