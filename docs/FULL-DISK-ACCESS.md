# Full Disk Access

Apple Notes MCP works almost entirely without any special disk permission. The
tools that need **Full Disk Access (FDA)** for the process that runs the MCP
server are the ones that read Notes' own SQLite store:

- **`get-checklist-state`** — reads a note's checklist done/undone state.
- **Checklist annotations in `get-note-markdown`** — the `[x]` / `[ ]` prefixes on
  checklist items.
- **`get-note-metadata` (BETA)** — pinned state, checklist flags, trash/recovery
  state, snippets, password hint. These columns exist nowhere else, so this tool
  needs FDA unconditionally.
- **`get-note-link`** — its primary path reads the note's `ZIDENTIFIER` from the
  database. On macOS 12–15 it can fall back to the AppleScript `note link`
  property; that property is absent from the Notes SDEF on macOS 26+, so there
  FDA is the only route.
- **`get-sync-status`** — degrades rather than fails: without database access it
  cannot see pending uploads or recent write activity.

Everything else (creating, reading, searching, updating, moving, deleting notes;
folders, accounts, attachments, stats, export, etc.) works **without** Full Disk
Access.

## Why it's needed

Apple Notes stores checklist items as a paragraph style inside a gzipped protobuf
blob in its SQLite store, `NoteStore.sqlite`. AppleScript's `body of note`
interface strips that state — it can't tell you whether a checklist item is
checked. The same store also holds the pinned/trash/snippet columns behind
`get-note-metadata` and the `ZIDENTIFIER` value behind `get-note-link`. To
recover any of them, the MCP reads the SQLite store directly.

That database lives in a macOS-protected directory:

```
~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite
```

Reading anything under `~/Library/Group Containers/` requires **Full Disk
Access** for the process macOS authorizes — without it, macOS denies the read.
(The MCP only ever **reads** this database; it never writes to it.) Which app
entry is responsible can depend on the host and runtime launch context; this
repository has not verified one universal grant target across configurations.

## How to grant Full Disk Access

1. Open **System Settings** (or **System Preferences** on older macOS).
2. Go to **Privacy & Security → Full Disk Access**.
3. Click the **+** button (you may need to unlock with Touch ID / your password
   first), and add the app macOS associates with this server's database access.
   Do not assume the host app or the Node executable is always the correct entry;
   the responsible identity can depend on the launch method.
4. Make sure the selected entry is enabled, then fully quit and restart the
   relevant host/process.
5. Run `doctor` and try a database-backed read to verify access. If it still
   fails, remove any unnecessary grants and consult the macOS privacy settings
   for the actual app/process responsible for the denied access.

> **Grant FDA narrowly.** Grant it only to the app macOS associates with the
> denied database access. This can depend on the host/runtime launch context;
> confirm with `doctor` and an actual database-backed read instead of granting
> access to both a host and Node by default.

## Verifying it worked

Run the **`doctor`** tool. It reports a dedicated **Full Disk Access** check as
`ok` / `warn` / `fail` with the reason, so you can confirm the grant took effect
without guessing. You can also just call `get-checklist-state` on a note that has
a checklist — if it returns items with `[x]`/`[ ]` state, FDA is working.

## Without Full Disk Access

The server degrades gracefully — nothing crashes:

- `get-checklist-state` returns a clear error explaining that database access is
  needed (and points here).
- `get-note-metadata` returns the same kind of error — it has no non-database
  path, so it cannot answer at all without FDA.
- `get-note-link` returns an error on macOS 26+. On macOS 12–15 it still works,
  via the AppleScript `note link` fallback.
- `get-note-markdown` still returns the note as Markdown, but checklist items
  appear as plain list items without the `[x]`/`[ ]` annotations.
- `get-sync-status` still answers, but with no database visibility it reports no
  pending uploads and no active sync — treat that as "unknown", not "idle".
- **Every other tool works normally**, since the rest of the server is pure
  AppleScript.

See also: [Known Limitations](../README.md#known-limitations) and
[Creating Checklists](../README.md#creating-checklists) in the README.
