import Foundation
import OathStepsCore

/// One JSON file in Application Support, written atomically and protected until first unlock.
struct FileStore {
    let url: URL

    static var standard: FileStore {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("OathSteps", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return FileStore(url: dir.appendingPathComponent("data.json"))
    }

    /// nil when nothing is saved yet. A file that exists but cannot be read is moved aside, never
    /// overwritten, so a bad update cannot silently erase someone's progress.
    func load() -> (data: AppData?, keptAside: URL?) {
        guard let raw = try? Data(contentsOf: url) else { return (nil, nil) }
        if let data = try? JSONDecoder().decode(AppData.self, from: raw) { return (data, nil) }
        let aside = url.deletingLastPathComponent().appendingPathComponent("data-unreadable-\(Int(Date().timeIntervalSince1970)).json")
        try? FileManager.default.moveItem(at: url, to: aside)
        return (nil, aside)
    }

    func save(_ value: AppData) throws {
        let data = try JSONEncoder().encode(value)
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    func delete() { try? FileManager.default.removeItem(at: url) }
}
