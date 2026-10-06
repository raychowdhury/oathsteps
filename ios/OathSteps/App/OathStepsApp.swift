import OathStepsCore
import SwiftUI

@main
struct OathStepsApp: App {
    @State private var model: AppModel

    init() {
        let store = FileStore.standard
        // UI tests start from an empty device.
        if CommandLine.arguments.contains("-uitest-reset") {
            store.delete()
            TokenStore.clear()
        }
        let content: ContentLibrary
        do {
            content = try ContentLibrary.load { name in
                guard let url = Bundle.main.url(forResource: name, withExtension: nil) else { throw CocoaError(.fileNoSuchFile) }
                return url
            }
        } catch {
            // The official question banks are bundled at build time; without them there is nothing to study.
            fatalError("Bundled content is missing or unreadable: \(error)")
        }
        _model = State(initialValue: AppModel(content: content, store: store, account: .fromBundle()))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(model.account)
        }
    }
}
