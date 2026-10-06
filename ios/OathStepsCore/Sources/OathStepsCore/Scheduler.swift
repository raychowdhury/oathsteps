import Foundation

/// Review ladder. A question sits in a box; each unprompted correct answer moves it up one box
/// and schedules the next review after INTERVAL_DAYS[box] days.
///
///  box:        0  1  2  3   4   5
///  interval:   0  1  3  7  14  30 days
public let INTERVAL_DAYS = [0, 1, 3, 7, 14, 30]
public let MAX_BOX = INTERVAL_DAYS.count - 1

/// Two unprompted correct answers at least this far apart count as secure recall (engineering hypothesis, not a USCIS standard).
public let SECURE_RECALL_GAP_HOURS = 24.0

public func newReviewState(_ questionId: String, bank: Bank, today: DateOnly) -> ReviewState {
    ReviewState(questionId: questionId, bank: bank, box: 0, dueOn: today)
}

/// Apply one attempt to the review state. Pure; idempotent per attempt id.
/// - unprompted correct   → box + 1, due after the box interval
/// - prompted/MC correct  → box unchanged, due tomorrow (needs unprompted confirmation)
/// - uncertain            → box - 1 (min 0), due tomorrow
/// - incorrect            → box 0, due today
public func applyAttempt(_ state: ReviewState, _ attempt: PracticeAttempt, timeZone: TimeZone = .current) -> ReviewState {
    if state.lastAttemptId == attempt.id { return state }
    let today = instantToDateOnly(attempt.at, timeZone: timeZone)
    var s = state
    if attempt.outcome == .correct && attempt.method == .selfUnprompted && !attempt.prompted {
        s.box = min(MAX_BOX, s.box + 1)
        s.dueOn = addDays(today, INTERVAL_DAYS[s.box])
        s.unpromptedCorrectAt.append(attempt.at)
    } else if attempt.outcome == .correct {
        s.dueOn = addDays(today, 1)
    } else if attempt.outcome == .uncertain {
        s.box = max(0, s.box - 1)
        s.dueOn = addDays(today, 1)
    } else {
        s.box = 0
        s.dueOn = today
    }
    s.lastOutcome = attempt.outcome
    s.lastAt = attempt.at
    s.lastAttemptId = attempt.id
    s.seenCount += 1
    return s
}

public func isDue(_ s: ReviewState, today: DateOnly) -> Bool { compareDateOnly(s.dueOn, today) <= 0 }

public func overdueDays(_ s: ReviewState, today: DateOnly) -> Int { max(0, daysBetween(s.dueOn, today)) }

/// Weak = answered at least once and not currently above box 1, or last outcome not correct.
public func isWeak(_ s: ReviewState) -> Bool { s.seenCount > 0 && (s.box <= 1 || s.lastOutcome != .correct) }

public func isSecure(_ s: ReviewState) -> Bool {
    guard s.unpromptedCorrectAt.count >= 2, let first = s.unpromptedCorrectAt.first, let last = s.unpromptedCorrectAt.last else { return false }
    return hoursBetween(first, last) >= SECURE_RECALL_GAP_HOURS
}

/// Due items for today, most overdue first, capped so a missed week is a short catch-up, not a wall.
public func dueToday(_ states: [ReviewState], today: DateOnly, cap: Int) -> (due: [ReviewState], deferred: Int) {
    let all = states.filter { $0.seenCount > 0 && isDue($0, today: today) }
        .enumerated()
        .sorted { l, r in
            let a = overdueDays(l.element, today: today), b = overdueDays(r.element, today: today)
            if a != b { return a > b }
            if l.element.box != r.element.box { return l.element.box < r.element.box }
            return l.offset < r.offset
        }
        .map(\.element)
    return (Array(all.prefix(cap)), max(0, all.count - cap))
}
