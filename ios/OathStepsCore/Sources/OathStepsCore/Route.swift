import Foundation

/// The learner's study path in the design's words. Mirrors src/lib/path.ts.
public struct Route: Sendable, Equatable {
    public enum Key: String, Sendable { case v2008 = "2008", v2025 = "2025", none }
    public var key: Key
    /// Full name, e.g. "2025 civics test, 65/20 format".
    public var name: String
    /// Tag text, e.g. "2025 civics test · 65/20" or "Test version not set".
    public var short: String
    public var lines: [String]
    public var reason: String
    public var bankSize: Int?
    public var asked: Int?
    public var mock: String
    /// Source key in the guide's sources map.
    public var src: String
    public var special: Bool

    public var bank: Bank? { key == .none ? nil : Bank(rawValue: key.rawValue) }
}

public func routeFor(filingDate: DateOnly?, filingDateUnknown: Bool, specialConsideration: Bool) -> Route {
    guard !filingDateUnknown, let filing = filingDate, !filing.isEmpty else {
        return Route(key: .none, name: "Test version not chosen", short: "Test version not set", lines: [], reason: "", bankSize: nil, asked: nil, mock: "Add your filing date to see your format.", src: "q128", special: specialConsideration)
    }
    let is2025 = filing >= CUTOVER_DATE
    var r = is2025
        ? Route(key: .v2025, name: "2025 civics test", short: "2025 civics test", lines: ["128 questions to study", "Up to 20 asked · 12 correct to pass", "Stops at 12 correct or 9 incorrect"], reason: "Filed on or after Oct 20, 2025.", bankSize: 128, asked: 20, mock: "Up to 20 asked · 12 correct to pass.", src: "q128", special: false)
        : Route(key: .v2008, name: "2008 civics test", short: "2008 civics test", lines: ["100 questions to study", "Up to 10 asked · 6 correct to pass"], reason: "Filed before Oct 20, 2025.", bankSize: 100, asked: 10, mock: "Up to 10 asked · 6 correct to pass.", src: "q100", special: false)
    if specialConsideration {
        let bank: Bank = is2025 ? .v2025 : .v2008
        r.short = "\(r.name) · 65/20"
        r.name = "\(r.name), 65/20 format"
        r.lines = ["20 designated questions to study", "10 asked · 6 correct to pass"]
        r.bankSize = rules(bank).specialSize
        r.asked = rules(bank).special.asked
        r.mock = "10 of 20 asked · 6 correct to pass."
        r.reason += " You chose the 65/20 format."
        r.special = true
    }
    return r
}

public func routeFor(_ p: StudyProfile) -> Route {
    routeFor(filingDate: p.filingDate, filingDateUnknown: p.filingDateUnknown, specialConsideration: p.specialConsideration)
}

/// Bank used for practice. Unknown version practices the 2025 list, labeled as such on screen,
/// until the learner adds a filing date. A visible choice, never a silent default.
public func practiceBank(_ route: Route) -> Bank { route.bank ?? .v2025 }

public func practiceQuestions(_ route: Route, _ content: ContentLibrary) -> [Question] {
    content.questions(practiceBank(route), special: route.special)
}
