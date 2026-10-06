import Foundation

/// Seeded PRNG (mulberry32), bit-for-bit the same sequence as the web client's, so a mock's
/// question selection is reproducible across platforms.
public final class SeededRng {
    private var a: UInt32

    public init(seed: UInt32) { a = seed }
    public convenience init(seed: Int) { self.init(seed: UInt32(truncatingIfNeeded: seed)) }

    public func next() -> Double {
        a = a &+ 0x6D2B_79F5
        var t = a
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
        return Double(t ^ (t >> 14)) / 4_294_967_296
    }
}

public func shuffle<T>(_ items: [T], _ rng: SeededRng) -> [T] {
    var out = items
    var i = out.count - 1
    while i > 0 {
        let j = Int((rng.next() * Double(i + 1)).rounded(.down))
        out.swapAt(i, j)
        i -= 1
    }
    return out
}

public func sample<T>(_ items: [T], _ count: Int, _ rng: SeededRng) -> [T] {
    Array(shuffle(items, rng).prefix(min(count, items.count)))
}

public func randomSeed() -> UInt32 { UInt32.random(in: .min ... .max) }

/// FNV-1a hash of a question id: seeds that question's multiple-choice options, so the order is stable per question (same as the web client).
public func hashId(_ s: String) -> UInt32 {
    var h: UInt32 = 2_166_136_261
    for c in s.utf16 { h = (h ^ UInt32(c)) &* 16_777_619 }
    return h
}
