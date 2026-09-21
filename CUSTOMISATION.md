# Derivative and permission policy

This repository is an unofficial derivative of [sweetrb/apple-notes-mcp](https://github.com/sweetrb/apple-notes-mcp). It preserves the upstream MIT licence and copyright notices; see [LICENSE](LICENSE). This file documents downstream-specific behavior and provenance; it does not imply upstream endorsement.

## Capability policy

The default runtime is read-only. Set the following variables in the server process environment or in its JSON config file when additional capabilities are intentionally needed:

| Environment variable | Default | Effect when exactly `"true"` |
|---|---|---|
| `APPLE_NOTES_MCP_ALLOW_READ` | enabled | Registers read tools, resources, and read prompts. If set to any other value, read capability is disabled. |
| `APPLE_NOTES_MCP_ALLOW_WRITE` | disabled | Registers note/folder create, update, append, move, batch-move, and `save-attachment` tools; also registers `new-meeting-note`. |
| `APPLE_NOTES_MCP_ALLOW_DESTRUCTIVE` | disabled | Registers only `delete-note`, `delete-folder`, and `batch-delete-notes`. This is independent from write access. |

Only the exact lowercase string `"true"` enables any capability. For read, a missing value defaults to enabled; any supplied value other than `"true"` disables it. Write and destructive access default to disabled, including when missing, empty, malformed, or false-like. Tools associated with disabled capabilities are not registered and are not visible to MCP clients. Disabling read also hides the read resources and prompts. `health-check` reports the effective capability booleans and registered tool count in its structured runtime result.

When enabled, `save-attachment` still applies its existing absolute-path, allowed-root, and symlink protections. Permission opt-ins do not remove those constraints.
