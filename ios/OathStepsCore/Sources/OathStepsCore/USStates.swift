import Foundation

public struct USState: Sendable, Identifiable, Equatable {
    public enum Kind: String, Sendable { case state, district, territory }
    public let code: String
    public let name: String
    public let kind: Kind
    public var id: String { code }
}

public let US_STATES: [USState] = [
    ("AL", "Alabama"), ("AK", "Alaska"), ("AZ", "Arizona"), ("AR", "Arkansas"), ("CA", "California"), ("CO", "Colorado"), ("CT", "Connecticut"), ("DE", "Delaware"), ("FL", "Florida"), ("GA", "Georgia"),
    ("HI", "Hawaii"), ("ID", "Idaho"), ("IL", "Illinois"), ("IN", "Indiana"), ("IA", "Iowa"), ("KS", "Kansas"), ("KY", "Kentucky"), ("LA", "Louisiana"), ("ME", "Maine"), ("MD", "Maryland"),
    ("MA", "Massachusetts"), ("MI", "Michigan"), ("MN", "Minnesota"), ("MS", "Mississippi"), ("MO", "Missouri"), ("MT", "Montana"), ("NE", "Nebraska"), ("NV", "Nevada"), ("NH", "New Hampshire"), ("NJ", "New Jersey"),
    ("NM", "New Mexico"), ("NY", "New York"), ("NC", "North Carolina"), ("ND", "North Dakota"), ("OH", "Ohio"), ("OK", "Oklahoma"), ("OR", "Oregon"), ("PA", "Pennsylvania"), ("RI", "Rhode Island"), ("SC", "South Carolina"),
    ("SD", "South Dakota"), ("TN", "Tennessee"), ("TX", "Texas"), ("UT", "Utah"), ("VT", "Vermont"), ("VA", "Virginia"), ("WA", "Washington"), ("WV", "West Virginia"), ("WI", "Wisconsin"), ("WY", "Wyoming"),
].map { USState(code: $0.0, name: $0.1, kind: .state) } + [
    USState(code: "DC", name: "District of Columbia", kind: .district),
    USState(code: "PR", name: "Puerto Rico", kind: .territory),
    USState(code: "GU", name: "Guam", kind: .territory),
    USState(code: "VI", name: "U.S. Virgin Islands", kind: .territory),
    USState(code: "AS", name: "American Samoa", kind: .territory),
    USState(code: "MP", name: "Northern Mariana Islands", kind: .territory),
]

/// Display name for a stored state. Older web data may hold the name itself, which is shown as is.
public func stateName(_ stored: String?) -> String? {
    guard let stored, !stored.isEmpty else { return nil }
    return US_STATES.first { $0.code == stored }?.name ?? stored
}
