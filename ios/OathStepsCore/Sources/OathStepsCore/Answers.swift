import Foundation

public struct AnswerVariant: Codable, Sendable, Equatable, Hashable {
    public var text: String
    public var note: String?

    public init(text: String, note: String? = nil) {
        self.text = text
        self.note = note
    }
}

public func normalize(_ s: String) -> String {
    var t = s.lowercased()
    t = t.replacing(#/[’']/#, with: "")
    t = t.replacing(#/[^a-z0-9]+/#, with: " ")
    t = t.replacing(#/\b(the|a|an)\b/#, with: " ")
    t = t.replacing(#/\s+/#, with: " ")
    return t.trimmingCharacters(in: .whitespaces)
}

/// Expand official answer wording into comparable variants.
/// "(U.S.) Constitution" → ["u s constitution", "constitution"]; parentheses mark optional words.
public func expandVariants(_ text: String) -> [String] {
    var results: [String] = []
    func walk(_ s: String) {
        guard let m = s.firstMatch(of: #/\(([^()]*)\)/#) else {
            let n = normalize(s)
            if !n.isEmpty, !results.contains(n) { results.append(n) }
            return
        }
        walk(String(s[..<m.range.lowerBound]) + String(m.1) + String(s[m.range.upperBound...]))
        walk(String(s[..<m.range.lowerBound]) + String(s[m.range.upperBound...]))
    }
    walk(text)
    return results
}

/// Typed self-check with the prototype's tolerance: exact variant, variant contained in the text,
/// or the text being a close prefix of a variant (missing up to 4 trailing characters). A hint, never a grade.
public func answerMatches(_ typed: String, _ answers: [AnswerVariant]) -> Bool {
    let t = normalize(typed)
    if t.isEmpty { return false }
    for ans in answers {
        let a = normalize(ans.text.replacing(#/\(.*?\)/#, with: " "))
        let full = normalize(ans.text)
        if t == a || t == full || (!a.isEmpty && t.contains(a)) || (a.count > 3 && a.contains(t) && t.count >= a.count - 4) { return true }
    }
    return false
}

/// Does the learner's text match any accepted variant? Used as a hint, never as a grade.
public func matchesAnyAnswer(_ input: String, _ answers: [AnswerVariant]) -> Bool {
    let n = normalize(input)
    if n.isEmpty { return false }
    return answers.contains { a in expandVariants(a.text).contains { v in v == n || (v.count > 3 && n.contains(v)) } }
}

public struct ChoiceQuestion: Sendable {
    public var id: String
    public var subsection: String
    public var answers: [AnswerVariant]
    public var dynamic: Bool

    public init(id: String, subsection: String, answers: [AnswerVariant], dynamic: Bool = false) {
        self.id = id
        self.subsection = subsection
        self.answers = answers
        self.dynamic = dynamic
    }
}

public struct MultipleChoice: Sendable, Equatable {
    public var correct: String
    public var options: [String]
}

/// Build a 4-option multiple-choice set. Distractors come from other questions in the same
/// subsection first, then anywhere. Dynamic questions are never offered as multiple choice.
public func buildMultipleChoice(_ question: ChoiceQuestion, pool: [ChoiceQuestion], rng: SeededRng) -> MultipleChoice? {
    guard !question.dynamic, let first = question.answers.first else { return nil }
    let correct = first.text
    let own = Set(question.answers.flatMap { expandVariants($0.text) })
    func candidate(_ q: ChoiceQuestion) -> Bool { q.id != question.id && !q.dynamic }
    func pick(_ qs: [ChoiceQuestion]) -> [String] {
        qs.flatMap { $0.answers.map(\.text) }
            .filter { !expandVariants($0).contains(where: own.contains) }
            .filter { $0.firstMatch(of: #/(?i)answers will vary|testupdates/#) == nil }
    }
    let same = pick(pool.filter { candidate($0) && $0.subsection == question.subsection })
    let other = pick(pool.filter { candidate($0) && $0.subsection != question.subsection })
    var distractors: [String] = []
    for d in sample(same, 3, rng) + sample(other, 3, rng) {
        if distractors.count == 3 { break }
        if !distractors.contains(d) { distractors.append(d) }
    }
    if distractors.count < 2 { return nil }
    return MultipleChoice(correct: correct, options: sample([correct] + distractors, distractors.count + 1, rng))
}
