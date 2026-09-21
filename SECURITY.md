# Security Policy

This repository is an unofficial derivative of [sweetrb/apple-notes-mcp](https://github.com/sweetrb/apple-notes-mcp). The upstream MIT licence and copyright notices remain in [LICENSE](LICENSE).

## Reporting a Vulnerability

There is no dedicated security contact or response-time commitment published for this derivative. If GitHub private vulnerability reporting is enabled for this repository, use that feature. If it is not available, do not post sensitive vulnerability details in a public issue; contact the repository maintainer through a contact method independently verified from the repository owner's GitHub profile.

## Security Context

The server is a local stdio MCP process that uses AppleScript to interact with Notes.app. It does not itself provide a remote service, but an MCP host or model may receive note content returned by read operations; review the host's data-handling and privacy settings. macOS Automation and, for certain database-backed reads, Full Disk Access are governed by macOS and can be revoked in System Settings.

Read capability is enabled by default. Write and destructive capabilities are separately disabled by default and require their exact opt-in settings; unavailable tools are not registered. See [README.md](README.md#permission-defaults) for the implementation's current behavior.
