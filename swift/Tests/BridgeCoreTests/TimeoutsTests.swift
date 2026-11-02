import XCTest
@testable import BridgeCore

final class TimeoutsTests: XCTestCase {
    func testWaitReturnsWhenSignalled() throws {
        let semaphore = DispatchSemaphore(value: 0)
        DispatchQueue.global().async { semaphore.signal() }
        XCTAssertNoThrow(try waitForCallback(semaphore, seconds: 5, waitingFor: "a test"))
    }
    func testWaitThrowsInsteadOfHanging() {
        let semaphore = DispatchSemaphore(value: 0)
        XCTAssertThrowsError(try waitForCallback(semaphore, seconds: 0.01, waitingFor: "a test")) { error in
            XCTAssertTrue(error.localizedDescription.contains("Timed out"))
            XCTAssertTrue(error.localizedDescription.contains("a test"))
        }
    }
    func testWatchdogFires() {
        let fired = expectation(description: "watchdog")
        startWatchdog(after: 0.01) { fired.fulfill() }
        wait(for: [fired], timeout: 5)
    }
    func testBudgetsLeaveRoomForATCCPromptAndForTheFetchErrorToWin() {
        XCTAssertGreaterThanOrEqual(remindersFetchTimeoutSeconds, 60)
        XCTAssertLessThan(remindersFetchTimeoutSeconds, bridgeWatchdogSeconds)
        // src/utils/eventkit-cli.ts BRIDGE_TIMEOUT_MS is 180 s, so the bridge's own clear error arrives first.
        XCTAssertLessThan(bridgeWatchdogSeconds, 180)
        XCTAssertGreaterThanOrEqual(bridgeWatchdogSeconds, 120)
    }
}
