import Foundation

public struct WordDiff: Sendable, Equatable {
    public struct Word: Sendable, Equatable {
        public var t: String
        public var ok: Bool
    }
    public var diffs: Int
    public var words: [Word]
}

/// Like `normalize` but keeps articles, since the writing test is about the exact sentence.
private func normalizeKeepStops(_ s: String) -> String {
    var t = s.lowercased()
    t = t.replacing(#/[’'.]/#, with: "")
    t = t.replacing(#/[^a-z0-9]+/#, with: " ")
    t = t.replacing(#/\s+/#, with: " ")
    return t.trimmingCharacters(in: .whitespaces)
}

/// Word-by-word comparison for the writing test. Punctuation and case are ignored, position
/// matters. Extra words typed beyond the sentence count as differences.
public func compareWords(_ target: String, _ typed: String) -> WordDiff {
    let tw = normalizeKeepStops(target).split(separator: " ").map(String.init)
    let yw = normalizeKeepStops(typed).split(separator: " ").map(String.init)
    let originals = target.split(separator: " ", omittingEmptySubsequences: false).map(String.init)
    var diffs = 0
    var words: [WordDiff.Word] = []
    for (i, w) in tw.enumerated() {
        let ok = i < yw.count && yw[i] == w
        if !ok { diffs += 1 }
        words.append(.init(t: i < originals.count ? originals[i] : w, ok: ok))
    }
    if yw.count > tw.count { diffs += yw.count - tw.count }
    return WordDiff(diffs: diffs, words: words)
}

public func describeDiff(_ d: WordDiff) -> String {
    d.diffs == 0 ? "Matches the sentence" : "\(d.diffs) word\(d.diffs == 1 ? "" : "s") different"
}
