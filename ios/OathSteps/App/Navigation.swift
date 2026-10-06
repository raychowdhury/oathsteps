import OathStepsCore
import SwiftUI

/// What a practice session contains.
enum SessionKind: Hashable {
    case daily, review, fresh, weak, saved, uncertain
    case topic(String)
    case ids([String], String)
}

enum Destination: Hashable {
    case session(SessionKind)
    case mock(MockConfig.Kind)
    case readiness
    case guide(open: String?)
    case voice, reading, writing, instructions, conversation, journey
}

extension View {
    func withDestinations() -> some View {
        navigationDestination(for: Destination.self) { d in
            switch d {
            case .session(let kind): SessionView(kind: kind)
            case .mock(let kind): MockView(kind: kind)
            case .readiness: ReadinessView()
            case .guide(let open): GuideView(open: open)
            case .voice: VoiceView()
            case .reading: ReadingView()
            case .writing: WritingView()
            case .instructions: InstructionsView()
            case .conversation: ConversationView()
            case .journey: JourneyView()
            }
        }
    }
}
