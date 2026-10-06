import Foundation

/// Form N-400 filed on or after this date takes the 2025 civics test (Federal Register 2025-18050).
public let CUTOVER_DATE: DateOnly = "2025-10-20"

public struct MockRules: Codable, Sendable, Equatable, Hashable {
    /// Maximum questions asked.
    public var asked: Int
    /// Correct answers needed to pass; the interview stops once reached.
    public var pass: Int
    /// Incorrect answers at which the interview stops with a fail.
    public var stopIncorrect: Int

    public init(asked: Int, pass: Int, stopIncorrect: Int) {
        self.asked = asked
        self.pass = pass
        self.stopIncorrect = stopIncorrect
    }
}

public struct BankRules: Sendable {
    public let standard: MockRules
    public let special: MockRules
    public let bankSize: Int
    public let specialSize: Int
}

/// Mirrors content/packs/*.json `rules`. Kept here so routing is pure and testable.
public let RULES: [Bank: BankRules] = [
    .v2008: BankRules(standard: MockRules(asked: 10, pass: 6, stopIncorrect: 5), special: MockRules(asked: 10, pass: 6, stopIncorrect: 5), bankSize: 100, specialSize: 20),
    .v2025: BankRules(standard: MockRules(asked: 20, pass: 12, stopIncorrect: 9), special: MockRules(asked: 10, pass: 6, stopIncorrect: 5), bankSize: 128, specialSize: 20),
]

public func rules(_ bank: Bank) -> BankRules { RULES[bank]! }

public struct InvalidDate: Error, Equatable {
    public let value: String
}

public func bankForFilingDate(_ filingDate: DateOnly) throws -> Bank {
    guard isValidDateOnly(filingDate) else { throw InvalidDate(value: filingDate) }
    return compareDateOnly(filingDate, CUTOVER_DATE) < 0 ? .v2008 : .v2025
}

public struct TestPath: Sendable, Equatable {
    public enum Status: String, Sendable { case determined, provisional, unknown }
    public enum Basis: String, Sendable { case filingDate = "filing-date", learnerChoice = "learner-choice", none }
    public var status: Status
    public var bank: Bank?
    public var special: Bool
    public var rules: MockRules?
    /// Plain-language reason shown to the learner.
    public var explanation: String
    public var basis: Basis
}

public func resolveTestPath(filingDate: DateOnly?, provisionalBank: Bank? = nil, specialConsideration: Bool = false) throws -> TestPath {
    let special = specialConsideration
    if let filingDate {
        let bank = try bankForFilingDate(filingDate)
        let r = special ? rules(bank).special : rules(bank).standard
        let explanation = bank == .v2008
            ? "Your N-400 filing date (\(filingDate)) is before October 20, 2025, so the 2008 civics test applies: 100 questions, up to 10 asked, 6 correct to pass."
            : "Your N-400 filing date (\(filingDate)) is on or after October 20, 2025, so the 2025 civics test applies: 128 questions, up to 20 asked, 12 correct to pass."
        return TestPath(status: .determined, bank: bank, special: special, rules: r, explanation: explanation, basis: .filingDate)
    }
    if let bank = provisionalBank {
        let r = special ? rules(bank).special : rules(bank).standard
        return TestPath(status: .provisional, bank: bank, special: special, rules: r, explanation: "You chose the \(bank.rawValue) test while your filing date is unknown. Confirm your filing date to be sure: filed before October 20, 2025 means the 2008 test; on or after means the 2025 test.", basis: .learnerChoice)
    }
    return TestPath(status: .unknown, bank: nil, special: special, rules: nil, explanation: "Your test version depends on the date your N-400 was filed, not your interview date. Filed before October 20, 2025: 2008 test (100 questions). Filed on or after: 2025 test (128 questions). Enter your filing date, or choose a test to study provisionally.", basis: .none)
}

/// The 65/20 special consideration also applies to a chosen bank's designated 20 questions.
public func describeSpecialConsideration() -> String {
    "If you are 65 or older and have been a lawful permanent resident for 20 or more years when you file, you may study only the 20 marked questions and will be asked 10 of them (6 correct to pass). USCIS decides whether this applies; OathSteps only changes what you practice."
}
