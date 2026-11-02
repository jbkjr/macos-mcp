import Foundation

/// The bridge's argv: strictly `--flag value` pairs. A value is whatever follows its
/// flag, so text such as "--completed" in a note can never act as a flag. Values may
/// be empty, and there are no bare flags.
public struct BridgeArguments {
    private let values: [String: String]

    public init(_ arguments: [String]) throws {
        func invalid(_ reason: String) -> NSError {
            NSError(domain: "", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid bridge arguments: \(reason)"])
        }
        guard arguments.count % 2 == 0 else { throw invalid("expected --flag value pairs.") }
        var values = [String: String]()
        for index in stride(from: 0, to: arguments.count, by: 2) {
            let flag = arguments[index]
            guard flag.hasPrefix("--"), flag.count > 2 else { throw invalid("expected a --flag at position \(index).") }
            let key = String(flag.dropFirst(2))
            guard values[key] == nil else { throw invalid("--\(key) given twice.") }
            values[key] = arguments[index + 1]
        }
        self.values = values
    }

    public func get(_ key: String) -> String? {
        return values[key]
    }
}
