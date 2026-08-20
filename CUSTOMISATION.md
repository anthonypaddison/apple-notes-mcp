# Customisation

- Upstream repository: https://github.com/sweetrb/apple-notes-mcp
- Private derivative owner: anthonypaddison
- Initial baseline: `v2.7.5` (`c8207ffe9c83de26322612addd9a591ffdfc3865`)
- Purpose: private Apple Notes MCP derivative for controlled Codex use
- `origin` is the private repository; `upstream` tracks the official project.

## Capability policy

This private derivative is read-only by default. Set only the additional capabilities required by the host, either in its environment or the existing JSON config file:

```json
{
  "APPLE_NOTES_MCP_ALLOW_READ": "true",
  "APPLE_NOTES_MCP_ALLOW_WRITE": "true",
  "APPLE_NOTES_MCP_ALLOW_DESTRUCTIVE": "false"
}
```

- `READ` registers retrieval, diagnostics, exports, and Notes UI reveal tools.
- `WRITE` registers note/folder create, update, append, move, batch move, and `save-attachment`. Attachment save destinations retain the existing absolute-path, allowed-root, and symlink protections.
- `DESTRUCTIVE` registers only `delete-note`, `delete-folder`, and `batch-delete-notes`.

Only the exact lowercase string `"true"` enables a capability. Missing, empty, or malformed values deny write and destructive access. Missing READ keeps safe read access enabled; an explicit non-`"true"` value disables it. `health-check` includes the private derivative identity, effective capability booleans, and registered tool count in its structured `runtime` result.

To return to read-only mode, remove the write and destructive settings or set them to `"false"`.
