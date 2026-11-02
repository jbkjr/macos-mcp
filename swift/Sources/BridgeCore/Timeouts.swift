import Foundation

/// Whole-process budget, long enough for someone to answer a TCC prompt. It sits below
/// BRIDGE_TIMEOUT_MS in src/utils/eventkit-cli.ts so the bridge's own error arrives first.
public let bridgeWatchdogSeconds: TimeInterval = 150

/// Fetching reminders has no prompt behind it, but a large store can be slow.
public let remindersFetchTimeoutSeconds: TimeInterval = 120

/// Waits for an EventKit completion handler, throwing rather than hanging if it never comes.
public func waitForCallback(_ semaphore: DispatchSemaphore, seconds: TimeInterval, waitingFor what: String) throws {
    guard semaphore.wait(timeout: .now() + seconds) == .success else {
        throw NSError(domain: "", code: 408, userInfo: [NSLocalizedDescriptionKey: "Timed out after \(Int(seconds)) s waiting for \(what)."])
    }
}

/// Runs `onFire` on a background queue after `seconds`, whatever the main thread is stuck in.
public func startWatchdog(after seconds: TimeInterval, onFire: @escaping () -> Void) {
    DispatchQueue.global().asyncAfter(deadline: .now() + seconds, execute: onFire)
}
