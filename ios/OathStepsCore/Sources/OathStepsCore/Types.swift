import Foundation

/// Calendar date without time, formatted YYYY-MM-DD. Filing and appointment dates are date-only.
public typealias DateOnly = String
/// ISO-8601 instant, e.g. 2026-01-10T15:00:00.000Z.
public typealias Instant = String

public enum Bank: String, Codable, Sendable, CaseIterable, Hashable {
    case v2008 = "2008"
    case v2025 = "2025"
}

public enum Outcome: String, Codable, Sendable, Hashable {
    case correct, incorrect, uncertain
}

/// How an outcome was obtained. Only `selfUnprompted` counts as independent oral recall.
public enum AssessmentMethod: String, Codable, Sendable {
    case selfUnprompted = "self-unprompted"
    case selfHinted = "self-hinted"
    case multipleChoice = "multiple-choice"
    case mockSelf = "mock-self"
    case typedMatch = "typed-match"
    case voiceSelf = "voice-self"
}

public enum PracticeContext: String, Codable, Sendable {
    case practice, review, mock, topic, voice
}

public struct PracticeAttempt: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var questionId: String
    public var bank: Bank
    public var packVersion: String
    public var outcome: Outcome
    public var method: AssessmentMethod
    /// Answer was visible or a hint/choices were shown before the learner committed.
    public var prompted: Bool
    public var context: PracticeContext
    public var mockId: String?
    public var at: Instant

    public init(id: String = newId(), questionId: String, bank: Bank, packVersion: String, outcome: Outcome, method: AssessmentMethod, prompted: Bool, context: PracticeContext, mockId: String? = nil, at: Instant) {
        self.id = id
        self.questionId = questionId
        self.bank = bank
        self.packVersion = packVersion
        self.outcome = outcome
        self.method = method
        self.prompted = prompted
        self.context = context
        self.mockId = mockId
        self.at = at
    }
}

public struct ReviewState: Codable, Sendable, Equatable {
    public var questionId: String
    public var bank: Bank
    /// 0...5 ladder position; see Scheduler.swift for the interval table.
    public var box: Int
    public var dueOn: DateOnly
    public var lastOutcome: Outcome?
    public var lastAt: Instant?
    public var lastAttemptId: String?
    /// Instants of unprompted correct answers, used for the delayed-recall indicator.
    public var unpromptedCorrectAt: [Instant]
    public var seenCount: Int

    public init(questionId: String, bank: Bank, box: Int, dueOn: DateOnly, lastOutcome: Outcome? = nil, lastAt: Instant? = nil, lastAttemptId: String? = nil, unpromptedCorrectAt: [Instant] = [], seenCount: Int = 0) {
        self.questionId = questionId
        self.bank = bank
        self.box = box
        self.dueOn = dueOn
        self.lastOutcome = lastOutcome
        self.lastAt = lastAt
        self.lastAttemptId = lastAttemptId
        self.unpromptedCorrectAt = unpromptedCorrectAt
        self.seenCount = seenCount
    }
}

public struct ChecklistEntry: Codable, Sendable, Equatable {
    public var itemId: String
    public var completedAt: Instant?
    /// "Remind me" switch on a guide task.
    public var remind: Bool

    public init(itemId: String, completedAt: Instant?, remind: Bool) {
        self.itemId = itemId
        self.completedAt = completedAt
        self.remind = remind
    }
}

public enum EnglishKind: String, Codable, Sendable, CaseIterable {
    case reading, writing
}

public struct EnglishTaskRecord: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var kind: EnglishKind
    public var taskId: String
    public var outcome: Outcome
    /// Short learner-facing summary, e.g. "Read clearly (your own check)" or "1 word different".
    public var text: String
    public var selfReported: Bool
    public var at: Instant

    public init(id: String = newId(), kind: EnglishKind, taskId: String, outcome: Outcome, text: String, at: Instant) {
        self.id = id
        self.kind = kind
        self.taskId = taskId
        self.outcome = outcome
        self.text = text
        self.selfReported = true
        self.at = at
    }
}

public struct ReminderSettings: Codable, Sendable, Equatable {
    public var study: Bool
    public var daily: Bool
    public var review: Bool
    public var appointments: Bool
    public var quietFrom: Int
    public var quietTo: Int

    public init(study: Bool = true, daily: Bool = true, review: Bool = true, appointments: Bool = true, quietFrom: Int = 21, quietTo: Int = 8) {
        self.study = study
        self.daily = daily
        self.review = review
        self.appointments = appointments
        self.quietFrom = quietFrom
        self.quietTo = quietTo
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = ReminderSettings()
        study = try c.decodeIfPresent(Bool.self, forKey: .study) ?? d.study
        daily = try c.decodeIfPresent(Bool.self, forKey: .daily) ?? d.daily
        review = try c.decodeIfPresent(Bool.self, forKey: .review) ?? d.review
        appointments = try c.decodeIfPresent(Bool.self, forKey: .appointments) ?? d.appointments
        quietFrom = try c.decodeIfPresent(Int.self, forKey: .quietFrom) ?? d.quietFrom
        quietTo = try c.decodeIfPresent(Int.self, forKey: .quietTo) ?? d.quietTo
    }
}

public enum TextSize: String, Codable, Sendable, CaseIterable { case normal, large, xlarge }
public enum Appearance: String, Codable, Sendable, CaseIterable { case system, light, dark }
public enum PracticeMode: String, Codable, Sendable { case recall, choice }

public struct StudyProfile: Codable, Sendable, Equatable {
    public var id: String = "local"
    public var filingDate: DateOnly?
    public var filingDateUnknown: Bool
    /// Learner says the 65/20 special consideration may apply. Not a determination.
    public var specialConsideration: Bool
    public var state: String?
    public var textSize: TextSize
    public var theme: Appearance
    /// Speech rate: 0.8 slower, 1 normal, 1.2 faster.
    public var audioRate: Double
    public var reduceMotion: Bool
    /// Practice answer mode. Multiple choice never counts as recall.
    public var mode: PracticeMode
    /// Read questions aloud automatically when a card opens.
    public var autoplay: Bool
    public var reminders: ReminderSettings
    public var createdAt: Instant
    public var updatedAt: Instant
    public var onboarded: Bool

    public static func fresh(now: Date = Date()) -> StudyProfile {
        let t = formatInstant(now)
        return StudyProfile(filingDate: nil, filingDateUnknown: false, specialConsideration: false, state: nil, textSize: .normal, theme: .system, audioRate: 1, reduceMotion: false, mode: .recall, autoplay: false, reminders: ReminderSettings(), createdAt: t, updatedAt: t, onboarded: false)
    }

    public init(filingDate: DateOnly?, filingDateUnknown: Bool, specialConsideration: Bool, state: String?, textSize: TextSize, theme: Appearance, audioRate: Double, reduceMotion: Bool, mode: PracticeMode, autoplay: Bool, reminders: ReminderSettings, createdAt: Instant, updatedAt: Instant, onboarded: Bool) {
        self.filingDate = filingDate
        self.filingDateUnknown = filingDateUnknown
        self.specialConsideration = specialConsideration
        self.state = state
        self.textSize = textSize
        self.theme = theme
        self.audioRate = audioRate
        self.reduceMotion = reduceMotion
        self.mode = mode
        self.autoplay = autoplay
        self.reminders = reminders
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.onboarded = onboarded
    }

    /// Profiles synced from another client may lack newer fields; missing ones take defaults, as on the web.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = StudyProfile.fresh()
        filingDate = try c.decodeIfPresent(String.self, forKey: .filingDate)
        filingDateUnknown = try c.decodeIfPresent(Bool.self, forKey: .filingDateUnknown) ?? d.filingDateUnknown
        specialConsideration = try c.decodeIfPresent(Bool.self, forKey: .specialConsideration) ?? d.specialConsideration
        state = try c.decodeIfPresent(String.self, forKey: .state)
        textSize = (try? c.decodeIfPresent(TextSize.self, forKey: .textSize)) ?? d.textSize
        theme = (try? c.decodeIfPresent(Appearance.self, forKey: .theme)) ?? d.theme
        audioRate = try c.decodeIfPresent(Double.self, forKey: .audioRate) ?? d.audioRate
        reduceMotion = try c.decodeIfPresent(Bool.self, forKey: .reduceMotion) ?? d.reduceMotion
        mode = (try? c.decodeIfPresent(PracticeMode.self, forKey: .mode)) ?? d.mode
        autoplay = try c.decodeIfPresent(Bool.self, forKey: .autoplay) ?? d.autoplay
        reminders = try c.decodeIfPresent(ReminderSettings.self, forKey: .reminders) ?? d.reminders
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? d.createdAt
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt) ?? d.updatedAt
        onboarded = try c.decodeIfPresent(Bool.self, forKey: .onboarded) ?? d.onboarded
    }
}

public struct ConfirmedDynamicAnswer: Codable, Sendable, Equatable {
    public var questionId: String
    public var answer: String
    public var region: String
    public var confirmedOn: DateOnly
    public var sourceUrl: String

    public init(questionId: String, answer: String, region: String, confirmedOn: DateOnly, sourceUrl: String) {
        self.questionId = questionId
        self.answer = answer
        self.region = region
        self.confirmedOn = confirmedOn
        self.sourceUrl = sourceUrl
    }
}

/// "Report a problem with this answer": stored locally, exported, and synced with an account.
public struct CorrectionReport: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var questionId: String
    public var packVersion: String
    public var reason: String
    public var message: String
    public var createdAt: Instant

    public init(id: String = newId(), questionId: String, packVersion: String, reason: String, message: String, createdAt: Instant) {
        self.id = id
        self.questionId = questionId
        self.packVersion = packVersion
        self.reason = reason
        self.message = message
        self.createdAt = createdAt
    }
}

/// Lowercase UUID, the format the server and the web client use.
public func newId() -> String { UUID().uuidString.lowercased() }
