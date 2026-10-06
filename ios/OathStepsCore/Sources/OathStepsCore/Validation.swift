import Foundation

private let MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/// Human-friendly date, e.g. "Oct 5, 2026". Date-only, no time zone involved.
public func fmtDate(_ iso: DateOnly?) -> String {
    guard let iso, !iso.isEmpty else { return "" }
    let p = iso.split(separator: "-").map(String.init)
    guard p.count == 3, let m = Int(p[1]), (1...12).contains(m), let d = Int(p[2]) else { return iso }
    return "\(MONTHS[m - 1]) \(d), \(p[0])"
}

/// The learner's local calendar day for a stored instant. Slicing the ISO string would show the UTC day, a day ahead on US evenings.
public func fmtLocalDay(_ at: Instant?, timeZone: TimeZone = .current) -> String {
    guard let at, !at.isEmpty else { return "" }
    return fmtDate(instantToDateOnly(at, timeZone: timeZone))
}

/// Empty string means valid. Mirrors the web wording.
public func validateFiling(date: String, unsure: Bool, today: DateOnly) -> String {
    if unsure { return "" }
    if date.isEmpty { return "Enter your filing date, or choose “I’m not sure”." }
    if !isValidDateOnly(date) { return "Enter a full date: month, day and year." }
    if date > today { return "That date is in the future. Check the date on your receipt notice." }
    if date < "1990-01-01" { return "Check the year. That date looks too early." }
    return ""
}

public func validateInterviewDate(_ date: String, filing: DateOnly?) -> String {
    if date.isEmpty { return "" }
    if !isValidDateOnly(date) { return "Enter a full date: month, day and year." }
    if let filing, date < filing { return "Your interview can’t be before your filing date (\(fmtDate(filing)))." }
    return ""
}
