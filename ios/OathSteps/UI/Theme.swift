import SwiftUI
import UIKit

extension UIColor {
    nonisolated convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }

    /// SwiftUI also resolves colors on its render thread (for example while a switch animates),
    /// so this provider must not be main-actor isolated or the isolation check traps.
    nonisolated static func adaptive(light: UInt32, dark: UInt32) -> UIColor {
        UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) }
    }
}

extension Color {
    /// A color that follows light and dark mode, with the design handoff's token values.
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: .adaptive(light: light, dark: dark))
    }
}

/// Design tokens from the web stylesheet (`.o-app` and `.o-dark`).
enum OS {
    static let bg = Color(light: 0xF7FAF9, dark: 0x0F1A22)
    static let surface = Color(light: 0xFFFFFF, dark: 0x172530)
    static let ink = Color(light: 0x17324B, dark: 0xE6EEF2)
    static let muted = Color(light: 0x4A5D6E, dark: 0xA9B8C3)
    static let line = Color(light: 0xD9E3E3, dark: 0x2A3A46)
    static let control = Color(light: 0x7C8C99, dark: 0x6F8494)
    static let teal = Color(light: 0x087E8B, dark: 0x087E8B)
    static let tealStrong = Color(light: 0x066B76, dark: 0x5CC8D3)
    static let tealSoft = Color(light: 0xE2F3F3, dark: 0x12343A)
    static let tealBorder = Color(light: 0xB9DCDD, dark: 0x1E4A52)
    static let amber = Color(light: 0x8A5A0A, dark: 0xF0C066)
    static let amberSoft = Color(light: 0xFBF0DA, dark: 0x3A2D12)
    static let amberBorder = Color(light: 0xE8CF9C, dark: 0x5A4520)
    static let forest = Color(light: 0x2F6B47, dark: 0x7FD19C)
    static let forestSoft = Color(light: 0xE3F1E8, dark: 0x15301F)
    static let neutralSoft = Color(light: 0xEDF2F2, dark: 0x22323D)
    static let cardBorder = Color(light: 0xDFE7E7, dark: 0x2A3A46)
}

enum CardTone { case plain, guide, amber, ok, neutral }

struct CardStyle: ViewModifier {
    var tone: CardTone = .plain
    var padding: CGFloat = 18

    func body(content: Content) -> some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                if tone == .plain { RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(OS.cardBorder) }
            }
    }

    private var background: Color {
        switch tone {
        case .plain: OS.surface
        case .guide: OS.tealSoft
        case .amber: OS.amberSoft
        case .ok: OS.forestSoft
        case .neutral: OS.neutralSoft
        }
    }
}

extension View {
    func card(_ tone: CardTone = .plain, padding: CGFloat = 18) -> some View { modifier(CardStyle(tone: tone, padding: padding)) }
}

/// Filled teal call to action.
struct PrimaryButton: ButtonStyle {
    var large = true
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(large ? .headline : .subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: large ? 52 : 44)
            .padding(.horizontal, 16)
            .background(OS.teal.opacity(enabled ? (configuration.isPressed ? 0.85 : 1) : 0.45), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .contentShape(Rectangle())
    }
}

/// Outlined button (secondary or neutral).
struct OutlineButton: ButtonStyle {
    var tint: Color = OS.tealStrong
    var border: Color = OS.tealStrong
    var fill = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(tint)
            .frame(maxWidth: fill ? .infinity : nil, minHeight: 44)
            .padding(.horizontal, 16)
            .background(OS.surface.opacity(configuration.isPressed ? 0.7 : 1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(border, lineWidth: 1.5))
            .contentShape(Rectangle())
    }
}

/// Text-only button in the strong teal.
struct GhostButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(OS.tealStrong)
            .frame(minHeight: 44)
            .opacity(configuration.isPressed ? 0.6 : 1)
            .contentShape(Rectangle())
    }
}

struct DangerButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(OS.bg)
            .frame(maxWidth: .infinity, minHeight: 44)
            .padding(.horizontal, 16)
            .background(OS.ink.opacity(configuration.isPressed ? 0.8 : 1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

extension ButtonStyle where Self == PrimaryButton {
    static var primary: PrimaryButton { PrimaryButton() }
    static var primarySmall: PrimaryButton { PrimaryButton(large: false) }
}
extension ButtonStyle where Self == OutlineButton {
    static var secondary: OutlineButton { OutlineButton() }
    static var secondaryFill: OutlineButton { OutlineButton(fill: true) }
    static var neutral: OutlineButton { OutlineButton(tint: OS.ink, border: OS.control) }
    static var neutralFill: OutlineButton { OutlineButton(tint: OS.ink, border: OS.control, fill: true) }
}
extension ButtonStyle where Self == GhostButton {
    static var ghost: GhostButton { GhostButton() }
}
extension ButtonStyle where Self == DangerButton {
    static var danger: DangerButton { DangerButton() }
}

extension Font {
    static let h1 = Font.title.weight(.bold)
    static let h2 = Font.headline
    static let meta = Font.footnote.weight(.medium)
}
