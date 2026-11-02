import XCTest
@testable import BridgeCore

private struct Cases: Decodable { let accepted: [String]; let refused: [String] }
private func cases() throws -> Cases {
    let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    return try JSONDecoder().decode(Cases.self, from: Data(contentsOf: root.appendingPathComponent("tests/fixtures/due-date-cases.json")))
}

final class DueDateTests: XCTestCase {
    func testOmittedLeavesTheDueDateAlone() throws {
        XCTAssertFalse(try parseDueDateArgument(nil).isChange)
    }
    func testEmptyStringClears() throws {
        let change = try parseDueDateArgument("")
        XCTAssertTrue(change.isChange); XCTAssertNil(change.components)
    }
    func testSharedCorpusAccepted() throws {
        for value in try cases().accepted {
            XCTAssertNotNil(try parseDueDateArgument(value).components, value)
        }
    }
    func testSharedCorpusRefusedThrowsInsteadOfClearing() throws {
        for value in try cases().refused {
            XCTAssertThrowsError(try parseDueDateArgument(value), value) { error in
                XCTAssertTrue(error.localizedDescription.contains("dueDate"), value)
            }
        }
    }
}
