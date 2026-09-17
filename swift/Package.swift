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
            path: "Sources/MacOSMCPBridge",
            linkerSettings: [
                // Embed Info.plist into the executable's __TEXT,__info_plist section.
                // Required on macOS 14+: EventKit's requestFullAccessToEvents fails
                // immediately (no consent dialog) unless the calling executable
                // declares NSCalendarsFullAccessUsageDescription.
                .unsafeFlags([
                    "-Xlinker", "-sectcreate",
                    "-Xlinker", "__TEXT",
                    "-Xlinker", "__info_plist",
                    "-Xlinker", "Resources/Info.plist"
                ])
            ]
        )
    ]
)
