import Foundation
import Darwin

/// Walk with openat/O_NOFOLLOW so neither files nor any ancestor may be symlinked.
/// Provision these paths outside the writer; it never repairs permissions.
public enum PrivateFiles {
    static func checked(_ fd: Int32, directory: Bool) throws {
        var info = stat()
        guard fstat(fd, &info) == 0,
              (info.st_mode & S_IFMT) == (directory ? S_IFDIR : S_IFREG),
              (info.st_uid == 0 || info.st_uid == geteuid()), info.st_mode & 0o022 == 0,
              directory || info.st_nlink == 1 else { throw GuardFailure("unsafe guarded file ownership, mode or links") }
    }
    static func parent(_ path: String) throws -> (Int32, String) {
        let parts = path.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
        guard path.hasPrefix("/"), !parts.isEmpty, !parts.contains(".."), !parts.contains("."), !path.contains("\0") else { throw GuardFailure("invalid guarded file path") }
        var fd = open("/", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard fd >= 0 else { throw GuardFailure("cannot open guarded file ancestor") }
        do {
            try checked(fd, directory: true)
            for part in parts.dropLast() {
                let next = openat(fd, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
                guard next >= 0 else { throw GuardFailure("cannot open guarded file ancestor") }
                close(fd); fd = next
                try checked(fd, directory: true)
            }
            return (fd, parts.last!)
        } catch { close(fd); throw error }
    }
    static func readAll(_ fd: Int32, limit: Int? = nil) throws -> Data {
        var output = Data(); var buffer = [UInt8](repeating: 0, count: 16384)
        var offset: off_t = 0
        while true {
            let count = pread(fd, &buffer, buffer.count, offset)
            if count < 0 { if errno == EINTR { continue }; throw GuardFailure("cannot read guarded file") }
            if count == 0 { break }
            output.append(contentsOf: buffer.prefix(count)); offset += off_t(count)
            if let limit, output.count > limit { throw GuardFailure("guarded file exceeds limit") }
        }
        return output
    }
    public static func loadPolicy(path: String?) throws -> WriterPolicy {
        guard let path, !path.isEmpty else { throw GuardFailure("guarded policy unavailable") }
        let (parentFD, name) = try parent(path); defer { close(parentFD) }
        let fd = openat(parentFD, name, O_RDONLY | O_NOFOLLOW | O_CLOEXEC)
        guard fd >= 0 else { throw GuardFailure("guarded policy unavailable") }; defer { close(fd) }
        try checked(fd, directory: false)
        let data = try readAll(fd, limit: 65536)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              Set(object.keys) == Set(["enabled", "allowed_calendar_ids", "expected_source_ids"]) else { throw GuardFailure("invalid guarded policy schema") }
        let policy: WriterPolicy
        do { policy = try JSONDecoder().decode(WriterPolicy.self, from: data) }
        catch { throw GuardFailure("invalid guarded policy schema") }
        guard policy.enabled, !policy.allowed_calendar_ids.isEmpty,
              policy.allowed_calendar_ids.allSatisfy({ !$0.isEmpty && $0 != "*" && !(policy.expected_source_ids[$0] ?? "").isEmpty && policy.expected_source_ids[$0] != "*" }) else { throw GuardFailure("guarded policy disabled or empty") }
        return policy
    }
}

public struct WriterPolicy: Codable {
    public let enabled: Bool
    public let allowed_calendar_ids: [String]
    public let expected_source_ids: [String: String]
}
/// Captured from the launch environment only, and loaded at most once.
public final class GuardedLaunchPolicy {
    private let path: String?
    private let loader: (String?) throws -> WriterPolicy
    private lazy var loaded = Result { try loader(path) }
    public init(environment: [String: String], loader: @escaping (String?) throws -> WriterPolicy = PrivateFiles.loadPolicy) {
        path = environment["MACOS_MCP_CALENDAR_POLICY"]; self.loader = loader
    }
    public func requirePolicy() throws -> WriterPolicy { try loaded.get() }
}
