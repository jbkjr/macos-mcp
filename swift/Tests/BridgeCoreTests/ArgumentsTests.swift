import XCTest
@testable import BridgeCore

final class ArgumentsTests: XCTestCase {
    func testValuesThatLookLikeFlagsAreStoredAsText() throws {
        for value in ["--completed", "-- call Mom", "--action", "--note", "--", "-x", "--completed true"] {
            let parsed = try BridgeArguments(["--action", "update-reminder", "--id", "i", "--note", value, "--title", "t"])
            XCTAssertEqual(parsed.get("note"), value)
            XCTAssertEqual(parsed.get("action"), "update-reminder")
            XCTAssertEqual(parsed.get("title"), "t")
            XCTAssertNil(parsed.get("completed"), value)
        }
    }
    func testAValueCannotInjectAnotherField() throws {
        let parsed = try BridgeArguments(["--action", "create-reminder", "--title", "--isAllDay", "--note", "--completed"])
        XCTAssertEqual(parsed.get("title"), "--isAllDay")
        XCTAssertEqual(parsed.get("note"), "--completed")
        XCTAssertNil(parsed.get("isAllDay"))
        XCTAssertNil(parsed.get("completed"))
    }
    func testEmptyValuesAreKept() throws {
        let parsed = try BridgeArguments(["--dueDate", "", "--recurrence", ""])
        XCTAssertEqual(parsed.get("dueDate"), "")
        XCTAssertEqual(parsed.get("recurrence"), "")
    }
    func testOnlyTheLeadingDashesLeaveAKey() throws {
        XCTAssertEqual(try BridgeArguments(["--a--b", "v"]).get("a--b"), "v")
    }
    func testNoArgumentsIsValid() throws {
        XCTAssertNil(try BridgeArguments([]).get("action"))
    }
    func testAnythingButFlagValuePairsIsRefused() {
        for bad in [["--completed"], ["--action", "x", "--completed"], ["action", "x"], ["--", "x"], ["--a", "1", "--a", "2"]] {
            XCTAssertThrowsError(try BridgeArguments(bad), "\(bad)")
        }
    }
}
