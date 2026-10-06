import Foundation
import Observation
import OathStepsCore
import Security

struct AccountUser: Codable, Equatable {
    var id: String
    var email: String
    var name: String
    var emailVerified: Bool
}

struct PushResult: Decodable {
    struct Rejected: Decodable { let eventId: String; let reason: String }
    let stored: [String]
    let duplicate: [String]
    let rejected: [Rejected]
}

struct AccountError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// The signed session token, kept in the Keychain (this device only).
enum TokenStore {
    private static let service = "com.raychowdhury.oathsteps.session"
    private static var base: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "session"] }

    static func read() -> String? {
        var q = base
        q[kSecReturnData as String] = true
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }

    static func write(_ token: String) {
        SecItemDelete(base as CFDictionary)
        var q = base
        q[kSecValueData as String] = Data(token.utf8)
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(q as CFDictionary, nil)
    }

    static func clear() { SecItemDelete(base as CFDictionary) }
}

/// Optional accounts against the OathSteps server. The token is the signed session value the server
/// returns in `set-auth-token`; requests send it as a bearer token, never as a cookie.
@Observable
final class AccountService {
    let baseURL: URL?
    private(set) var user: AccountUser?
    private var token: String?

    init(baseURL: URL?) {
        self.baseURL = baseURL
        token = TokenStore.read()
    }

    static func fromBundle() -> AccountService {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "OathStepsAPIBaseURL") as? String ?? "").trimmingCharacters(in: .whitespaces)
        return AccountService(baseURL: raw.isEmpty ? nil : URL(string: raw))
    }

    var configured: Bool { baseURL != nil }
    var signedIn: Bool { token != nil }

    private func request(_ path: String, method: String = "GET", body: (any Encodable)? = nil, auth: Bool = true) async throws -> (Data, HTTPURLResponse) {
        guard let baseURL else { throw AccountError(message: "Accounts are not set up in this version of the app.") }
        var r = URLRequest(url: baseURL.appendingPathComponent(path))
        r.httpMethod = method
        r.timeoutInterval = 20
        // The bearer token is the only credential; never keep or send the server's cookies.
        r.httpShouldHandleCookies = false
        r.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            r.setValue("application/json", forHTTPHeaderField: "Content-Type")
            r.httpBody = try JSONEncoder().encode(body)
        }
        if auth, let token { r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await URLSession.shared.data(for: r)
        guard let http = response as? HTTPURLResponse else { throw AccountError(message: "No response from the server.") }
        if http.statusCode == 401 && auth {
            clearSession()
            throw AccountError(message: "Not signed in")
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["message"]
                ?? (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw AccountError(message: message ?? "Request failed (\(http.statusCode)).")
        }
        return (data, http)
    }

    private struct UserEnvelope: Decodable { let user: AccountUser }

    private func adopt(_ data: Data, _ http: HTTPURLResponse) throws {
        guard let t = http.value(forHTTPHeaderField: "set-auth-token"), t.contains(".") else { throw AccountError(message: "The server did not return a session.") }
        token = t
        TokenStore.write(t)
        user = (try? JSONDecoder().decode(UserEnvelope.self, from: data))?.user
    }

    func signUp(email: String, password: String, name: String) async throws {
        struct B: Encodable { let email: String; let password: String; let name: String }
        let (d, h) = try await request("api/auth/sign-up/email", method: "POST", body: B(email: email, password: password, name: name.isEmpty ? String(email.split(separator: "@").first ?? "") : name), auth: false)
        try adopt(d, h)
    }

    func signIn(email: String, password: String) async throws {
        struct B: Encodable { let email: String; let password: String }
        let (d, h) = try await request("api/auth/sign-in/email", method: "POST", body: B(email: email, password: password), auth: false)
        try adopt(d, h)
    }

    /// The emailed link opens the web reset page; the new password then works here too.
    func requestPasswordReset(email: String) async throws {
        struct B: Encodable { let email: String; let redirectTo: String }
        let redirect = baseURL?.appendingPathComponent("account/reset").absoluteString ?? ""
        _ = try await request("api/auth/request-password-reset", method: "POST", body: B(email: email, redirectTo: redirect), auth: false)
    }

    /// Confirms the stored token still works. Offline, the token is kept; a refused or ended session is cleared.
    func refreshSession() async {
        guard token != nil, let (d, _) = try? await request("api/auth/get-session") else { return }
        struct S: Decodable { let user: AccountUser? }
        // The server answers `null` when the session has ended.
        user = (try? JSONDecoder().decode(S.self, from: d))?.user
        if user == nil { clearSession() }
    }

    func consent(_ purpose: String) async throws {
        struct B: Encodable { let purpose: String; let version: String }
        _ = try await request("api/account", method: "POST", body: B(purpose: purpose, version: "2026-10-05"))
    }

    func push(_ events: [OutboxEvent]) async throws -> PushResult {
        struct E: Encodable { let eventId: String; let type: String; let payload: JSONValue; let createdAt: String }
        struct B: Encodable { let events: [E] }
        let (d, _) = try await request("api/sync", method: "POST", body: B(events: events.map { E(eventId: $0.eventId, type: $0.type, payload: $0.payload, createdAt: $0.createdAt) }))
        return try JSONDecoder().decode(PushResult.self, from: d)
    }

    func pull() async throws -> ServerSnapshot {
        let (d, _) = try await request("api/sync")
        return try JSONDecoder().decode(ServerSnapshot.self, from: d)
    }

    func signOut() async {
        _ = try? await request("api/auth/sign-out", method: "POST", body: [String: String]())
        clearSession()
    }

    func deleteAccount() async throws {
        _ = try await request("api/account", method: "DELETE")
        clearSession()
    }

    private func clearSession() {
        token = nil
        user = nil
        TokenStore.clear()
    }
}
