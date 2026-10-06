import Foundation

public struct DynamicRule: Codable, Sendable, Equatable, Hashable {
    public enum Scope: String, Codable, Sendable { case federal, state, district }
    public var kind: String
    public var lookupUrl: String
    public var lookupLabel: String
    public var scope: Scope
}

public struct Question: Codable, Sendable, Equatable, Identifiable, Hashable {
    public var id: String
    public var number: Int
    public var bank: Bank
    public var section: String
    public var subsection: String
    public var prompt: String
    public var answers: [AnswerVariant]
    public var requiredCount: Int
    public var special: Bool
    public var dynamic: DynamicRule?
}

public struct ReviewInfo: Codable, Sendable, Equatable {
    public var machineChecked: Bool
    public var humanReviewed: Bool
    public var note: String
    /// For packs: date of the expert review. For the guide: when the sources were last checked.
    public var reviewedAt: String?
    public var humanReviewedAt: String?
    public var reviewerCredential: String?
}

public struct ContentPack: Codable, Sendable {
    public struct Rules: Codable, Sendable { public var standard: MockRules; public var special: MockRules }
    public struct Source: Codable, Sendable { public var id: String; public var title: String; public var url: String; public var sha256: String; public var retrievedAt: String }
    public var packId: String
    public var bank: Bank
    public var title: String
    public var appliesWhen: String
    public var version: String
    public var contentHash: String
    public var generatedAt: String
    public var rules: Rules
    public var source: Source
    public var review: ReviewInfo
    public var questions: [Question]
}

public struct GuideSource: Codable, Sendable, Equatable { public var label: String; public var url: String }

public struct GuideItem: Codable, Sendable, Equatable, Identifiable {
    public enum Action: String, Codable, Sendable { case filing, settings, journey }
    public var id: String
    public var text: String
    public var why: String
    public var links: [String]
    public var action: Action?
    public var actionLabel: String?
}

public struct GuideStage: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var title: String
    public var items: [GuideItem]
}

public struct Guide: Codable, Sendable {
    public var version: String
    public var review: ReviewInfo
    public var sources: [String: GuideSource]
    public var stages: [GuideStage]

    public var allItems: [GuideItem] { stages.flatMap(\.items) }
    public func item(_ id: String) -> GuideItem? { allItems.first { $0.id == id } }
}

public struct EnglishTasks: Codable, Sendable {
    public struct Sentence: Codable, Sendable, Equatable, Identifiable { public var id: String; public var text: String }
    public struct Instruction: Codable, Sendable, Equatable, Identifiable { public var id: String; public var text: String; public var meaning: String }
    public struct Vocabulary: Codable, Sendable, Equatable, Identifiable { public var id: String; public var term: String; public var meaning: String }
    public struct Conversation: Codable, Sendable, Equatable, Identifiable { public var id: String; public var prompt: String; public var tip: String }
    public var version: String
    public var review: ReviewInfo
    public var sources: [GuideSource]
    public var reading: [Sentence]
    public var writing: [Sentence]
    public var instructions: [Instruction]
    public var vocabulary: [Vocabulary]
    public var conversation: [Conversation]
}

public struct Topic: Sendable, Equatable, Identifiable {
    public var section: String
    public var subsection: String
    public var questionIds: [String]
    public var id: String { "\(section)|\(subsection)" }
}

/// All bundled content: the two official banks, the guide and the English material.
/// The app bundles the same JSON files the web app imports (content/), so both read one source.
public struct ContentLibrary: Sendable {
    public let packs: [Bank: ContentPack]
    public let guide: Guide
    public let english: EnglishTasks
    private let byId: [String: Question]

    public init(packs: [Bank: ContentPack], guide: Guide, english: EnglishTasks) {
        self.packs = packs
        self.guide = guide
        self.english = english
        var map: [String: Question] = [:]
        for p in packs.values { for q in p.questions { map[q.id] = q } }
        byId = map
    }

    /// Loads civics-2025.json, civics-2008.json, stages.json and tasks.json from one directory.
    public static func load(directory: URL) throws -> ContentLibrary {
        try load { name in directory.appendingPathComponent(name) }
    }

    public static func load(url: (String) throws -> URL) throws -> ContentLibrary {
        let d = JSONDecoder()
        func read<T: Decodable>(_ name: String, _ t: T.Type) throws -> T { try d.decode(t, from: Data(contentsOf: try url(name))) }
        return ContentLibrary(
            packs: [.v2025: try read("civics-2025.json", ContentPack.self), .v2008: try read("civics-2008.json", ContentPack.self)],
            guide: try read("stages.json", Guide.self),
            english: try read("tasks.json", EnglishTasks.self)
        )
    }

    public func pack(_ bank: Bank) -> ContentPack { packs[bank]! }
    public func question(_ id: String) -> Question? { byId[id] }

    public func questions(_ bank: Bank, special: Bool) -> [Question] {
        let qs = pack(bank).questions
        return special ? qs.filter(\.special) : qs
    }

    public func topics(_ bank: Bank, special: Bool) -> [Topic] {
        var out: [Topic] = []
        for q in questions(bank, special: special) {
            if let i = out.firstIndex(where: { $0.section == q.section && $0.subsection == q.subsection }) { out[i].questionIds.append(q.id) }
            else { out.append(Topic(section: q.section, subsection: q.subsection, questionIds: [q.id])) }
        }
        return out
    }

    public var allPacks: [ContentPack] { [pack(.v2025), pack(.v2008)] }
}
