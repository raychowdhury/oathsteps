import Foundation
@testable import OathStepsCore

/// The repository's content folder, so tests read the exact files the app and the web app ship.
func repoContent() throws -> ContentLibrary {
    var root = URL(fileURLWithPath: #filePath)
    for _ in 0..<5 { root.deleteLastPathComponent() }
    let paths = [
        "civics-2025.json": "content/packs/civics-2025.json", "civics-2008.json": "content/packs/civics-2008.json",
        "stages.json": "content/guide/stages.json", "tasks.json": "content/english/tasks.json",
    ]
    return try ContentLibrary.load { name in root.appendingPathComponent(paths[name]!) }
}

let UTC = TimeZone(identifier: "UTC")!

func date(_ iso: String) -> Date { parseInstant(iso)! }
