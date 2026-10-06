// swift-tools-version: 6.0
import PackageDescription

/// Platform-independent OathSteps logic, ported from src/domain and src/lib of the web app.
/// `swift test` runs on a Mac without a simulator.
let package = Package(
    name: "OathStepsCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "OathStepsCore", targets: ["OathStepsCore"])],
    targets: [
        .target(name: "OathStepsCore"),
        .testTarget(name: "OathStepsCoreTests", dependencies: ["OathStepsCore"]),
    ]
)
