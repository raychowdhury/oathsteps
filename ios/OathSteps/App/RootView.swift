import OathStepsCore
import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var phase

    var body: some View {
        @Bindable var model = model
        Group {
            if model.data.profile.onboarded {
                MainTabs()
            } else {
                OnboardingFlow()
            }
        }
        .tint(OS.teal)
        .preferredColorScheme(colorScheme)
        .modifier(TextSizeOverride(size: model.data.profile.textSize))
        .transaction { if model.data.profile.reduceMotion { $0.animation = nil } }
        .overlay(alignment: .bottom) { ToastView() }
        .overlay(alignment: .top) {
            if let e = model.storageError {
                Text(e).font(.footnote).padding(10).frame(maxWidth: .infinity).background(OS.amberSoft).foregroundStyle(OS.amber)
            }
        }
        .sheet(isPresented: $model.showSettings) { SettingsView() }
        .onChange(of: phase, initial: true) { _, p in
            if p == .active {
                model.rescheduleNotifications()
                Task {
                    await model.account.refreshSession()
                    if model.syncEnabled { _ = await model.syncNow() }
                }
            } else if p == .background, model.syncEnabled {
                Task { _ = await model.push() }
            }
        }
    }

    private var colorScheme: ColorScheme? {
        switch model.data.profile.theme {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

/// "Larger" and "Largest" raise text above the system size; "Standard" follows the system setting.
private struct TextSizeOverride: ViewModifier {
    let size: TextSize
    func body(content: Content) -> some View {
        switch size {
        case .normal: content
        case .large: content.dynamicTypeSize(.xxLarge)
        case .xlarge: content.dynamicTypeSize(.xxxLarge)
        }
    }
}

struct MainTabs: View {
    var body: some View {
        TabView {
            NavigationStack { TodayView().withDestinations() }
                .tabItem { Label("Today", systemImage: "sun.max") }
            NavigationStack { PracticeView().withDestinations() }
                .tabItem { Label("Practice", systemImage: "rectangle.stack") }
            NavigationStack { InterviewView().withDestinations() }
                .tabItem { Label("Interview", systemImage: "bubble.left") }
            NavigationStack { JourneyView().withDestinations() }
                .tabItem { Label("Journey", systemImage: "stairs") }
        }
    }
}

struct ToastView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if let t = model.toast {
            HStack(spacing: 12) {
                Text(t.text).font(.subheadline).foregroundStyle(OS.bg).frame(maxWidth: .infinity, alignment: .leading)
                if let undo = t.undo {
                    Button("Undo") {
                        undo()
                        model.toast = nil
                    }
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(OS.bg)
                }
                Button {
                    model.toast = nil
                } label: {
                    Image(systemName: "xmark").foregroundStyle(OS.bg)
                }
                .accessibilityLabel("Dismiss")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(OS.ink, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.horizontal, 12)
            .padding(.bottom, 64)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .task(id: t.id) {
                try? await Task.sleep(for: .seconds(t.undo == nil ? 4 : 6))
                if model.toast?.id == t.id { model.toast = nil }
            }
            .accessibilityIdentifier("toast")
        }
    }
}
