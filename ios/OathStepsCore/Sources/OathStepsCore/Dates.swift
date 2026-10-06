import Foundation

private let utc = TimeZone(identifier: "UTC")!

private var utcCalendar: Calendar {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = utc
    return c
}

private func parts(_ value: String) -> (Int, Int, Int)? {
    guard value.utf8.count == 10, let m = value.wholeMatch(of: #/(\d{4})-(\d{2})-(\d{2})/#) else { return nil }
    guard let y = Int(m.1), let mo = Int(m.2), let d = Int(m.3) else { return nil }
    return (y, mo, d)
}

/// Strict calendar validation of a YYYY-MM-DD string (no 30 February, no 2025-1-1).
public func isValidDateOnly(_ value: String) -> Bool {
    guard let (y, mo, d) = parts(value), (1...12).contains(mo), (1...31).contains(d) else { return false }
    guard let date = utcCalendar.date(from: DateComponents(year: y, month: mo, day: d)) else { return false }
    let back = utcCalendar.dateComponents([.year, .month, .day], from: date)
    return back.year == y && back.month == mo && back.day == d
}

/// Lexicographic comparison is correct for zero-padded YYYY-MM-DD.
public func compareDateOnly(_ a: DateOnly, _ b: DateOnly) -> Int {
    a < b ? -1 : a > b ? 1 : 0
}

private func utcMidnight(_ d: DateOnly) -> Date {
    let (y, m, day) = parts(d) ?? (1970, 1, 1)
    return utcCalendar.date(from: DateComponents(year: y, month: m, day: day))!
}

/// Whole days from `from` to `to`; negative when `to` is earlier.
public func daysBetween(_ from: DateOnly, _ to: DateOnly) -> Int {
    Int((utcMidnight(to).timeIntervalSince(utcMidnight(from)) / 86_400).rounded())
}

public func addDays(_ d: DateOnly, _ days: Int) -> DateOnly {
    formatDateOnly(utcMidnight(d).addingTimeInterval(Double(days) * 86_400), timeZone: utc)
}

/// The calendar date of `date` in `timeZone`, as YYYY-MM-DD.
public func formatDateOnly(_ date: Date, timeZone: TimeZone = .current) -> DateOnly {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = timeZone
    let p = c.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", p.year ?? 1970, p.month ?? 1, p.day ?? 1)
}

/// Today's calendar date in the learner's time zone. Filing-date comparisons never depend on the time of day.
public func todayDateOnly(now: Date = Date(), timeZone: TimeZone = .current) -> DateOnly {
    formatDateOnly(now, timeZone: timeZone)
}

public func instantToDateOnly(_ at: Instant, timeZone: TimeZone = .current) -> DateOnly {
    formatDateOnly(parseInstant(at) ?? Date(timeIntervalSince1970: 0), timeZone: timeZone)
}

/// Parses ISO-8601 instants with or without fractional seconds.
public func parseInstant(_ s: String) -> Date? {
    if let d = try? Date(s, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)) { return d }
    return try? Date(s, strategy: Date.ISO8601FormatStyle())
}

/// Formats like JavaScript's toISOString: 2026-01-10T15:00:00.000Z.
public func formatInstant(_ d: Date) -> Instant {
    d.formatted(Date.ISO8601FormatStyle(includingFractionalSeconds: true))
}

public func nowIso() -> Instant { formatInstant(Date()) }

public func hoursBetween(_ a: Instant, _ b: Instant) -> Double {
    guard let x = parseInstant(a), let y = parseInstant(b) else { return 0 }
    return y.timeIntervalSince(x) / 3_600
}
