// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "MacOSMCPBridge",
    platforms: [
        .macOS(.v12)
    ],
    targets: [
        .executableTarget(
            name: "MacOSMCPBridge",
            path: "Sources/MacOSMCPBridge"
        )
    ]
)
