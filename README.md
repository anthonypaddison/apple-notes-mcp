# Apple Notes MCP Server (Unofficial Derivative)

An unofficial derivative of [sweetrb/apple-notes-mcp](https://github.com/sweetrb/apple-notes-mcp), a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for Apple Notes on macOS. This repository preserves the upstream MIT licence and notices; see [LICENSE](LICENSE) and [CUSTOMISATION.md](CUSTOMISATION.md).

[![platform: macOS](https://img.shields.io/badge/platform-macOS-111?logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-server-blue)](https://modelcontextprotocol.io)

For this source-only release, the only supported installation path is to clone and build this repository, then configure the local executable below. Repository plugin manifests are not supported installation methods: the Codex and Antigravity templates invoke `npx apple-notes-mcp` and can resolve the upstream package, while the Claude manifest's local bundle is part of a separate plugin distribution path. Do not install these templates as this derivative; plugin packaging and marketplace distribution are out of scope.

## What is This?

This server acts as a bridge between AI assistants and Apple Notes. Once configured, you can ask Claude (or any MCP-compatible AI) to:

- "Save this conversation as a note called 'Meeting Summary'"
- "Find all my notes about the project deadline"
- "Read my shopping list note"
- "Move my draft notes to the Archive folder"
- "What notes do I have in my Work folder?"

The MCP server communicates with its host over local stdio and uses AppleScript to interact with Notes.app. The host or model may receive note content returned by read operations; where that content is sent depends on the MCP client and its privacy settings.

### Permission defaults

Read capability is enabled by default. Write and destructive capabilities are separate opt-ins and both default to disabled. A capability is enabled only when its corresponding environment value is exactly the lowercase string `"true"`; values such as `TRUE`, `1`, `yes`, `false`, empty, or malformed values disable it. Tools requiring a disabled capability are not registered, so MCP clients do not see them. Read resources and prompts are also hidden when read is disabled; the `new-meeting-note` prompt is available only when write is enabled. See [Configuration](#configuration) for the three exact variables.

## Installation

Build and run this derivative from a clone of this repository. No npm package or marketplace installation for this derivative is documented or implied here.

```bash
git clone https://github.com/anthonypaddison/apple-notes-mcp.git
cd apple-notes-mcp
corepack pnpm install --frozen-lockfile
corepack pnpm run build
```

Register the resulting `build/index.js` with your MCP host using absolute paths. For example, in a host configuration that uses the `mcpServers` format:

```json
{
  "mcpServers": {
    "apple-notes": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/apple-notes-mcp/build/index.js"]
    }
  }
}
```

Use the Node executable available on your machine (Node.js 20 or newer) and replace both paths. Do not substitute `npx apple-notes-mcp`: that package name currently resolves outside this repository. The tracked Codex and Antigravity plugin configurations have the same limitation; use the local executable entry above, not those repository plugin templates.

On first use, macOS may prompt an app to control Notes.app through Automation. Allow only if you intend to grant that access. Full Disk Access is optional and only needed for the database-backed features listed in [Full Disk Access](#full-disk-access). The app macOS associates with access can depend on the host and runtime; follow the [Full Disk Access guide](docs/FULL-DISK-ACCESS.md) and verify with `doctor` rather than assuming a universal target.

## Requirements

- **macOS** - Apple Notes and AppleScript are macOS-only
- **Node.js 20+** - Required for the MCP server
- **Notes.app** - Available on macOS; an account containing notes is needed for useful note operations

## Features

| Feature | Description |
|---------|-------------|
| **Create Notes** | Create notes with titles, content, and optional folder/account targeting (write opt-in) |
| **Search Notes** | Find notes by title or search within note content |
| **Read Notes** | Retrieve note content and metadata |
| **Update Notes** | Modify existing notes (title and/or content; write opt-in) |
| **Delete Notes** | Delete notes (destructive opt-in) |
| **Move Notes** | Organize notes into folders (supports nested paths; write opt-in) |
| **Folder Management** | List folders by default; creating folders requires write and deleting folders requires destructive access |
| **Multi-Account** | Work with iCloud, Gmail, Exchange, or any configured account, including account IDs and default folders |
| **Batch Operations** | Move multiple notes (write opt-in) or delete multiple notes (destructive opt-in) |
| **Checklist State** | Read checklist done/undone state directly from the Notes database (requires Full Disk Access) |
| **Export** | Export all notes as JSON or get individual notes as Markdown |
| **Attachments** | List and fetch attachments by default; saving an attachment to disk requires write access |
| **Notes.app UI State** | Reveal a note in Notes.app or read the current Notes.app selection |
| **Sync Awareness** | Detect iCloud sync in progress, warn about incomplete results |
| **Collaboration** | Detect shared notes, warn before modifying |
| **Diagnostics** | `health-check` plus a richer `doctor` (reachability, automation permission, accounts, Full Disk Access), sync status, and statistics |

Read/list/get tools also return **structured JSON** (`structuredContent`) alongside the text, so agents can consume results without parsing prose. Write and destructive tools described below are available only when their respective capabilities are explicitly enabled; otherwise, they are absent from the client's tool list.

### MCP resources & prompts

When read capability is enabled, resources expose read-only context the client can attach without a tool call:
`notes://accounts`, `notes://folders`, `notes://stats`, and the
`notes://note/{id}` template (returns the note as Markdown). Prompts package
common read workflows: `find-note`, `weekly-review`. The `new-meeting-note` prompt is registered only when write access is enabled.

### AppleScript limitations

A few Notes UI features are not exposed to AppleScript. Some are recovered by
reading Notes' own database instead; the rest genuinely cannot be supported. See
**[AppleScript limitations](docs/APPLESCRIPT-LIMITATIONS.md)**
for the investigation and verification behind each:

- **Pinned notes** — Notes has no scriptable `pinned` property via AppleScript. Pin state can now be **read** with the BETA `get-note-metadata` tool (from the NoteStore database), but it still cannot be **set** programmatically.
- **Note-to-note links** — AppleScript exposes no link property or link element, so link *relationships* between notes cannot be read, and a link cannot be inserted into a note body. A shareable `notes://showNote?identifier=<uuid>` deep link **is** available via [`get-note-link`](#get-note-link).

---

## Tool Reference

This section documents the implementation's full tool surface. Tools appear to an MCP client only when their required permission is enabled; by default, read tools are available and write/destructive tools are hidden.

### Note Operations

#### `create-note`

Creates a new note in Apple Notes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | The title of the note. Automatically prepended as `<h1>` — do NOT include the title in `content` |
| `content` | string | Yes | The body content of the note (do not repeat the title here) |
| `tags` | string[] | No | Returned-only metadata — **NOT written to Notes.app**. Apple Notes tags can't be set via AppleScript, so values passed here are echoed back in the response but do not appear on the created note. Use inline `#hashtags` in `content` instead (Notes.app turns those into real tags) |
| `folder` | string | No | Folder to create the note in. Supports nested paths like `"Work/Clients"`. **The folder must already exist** — create it first with [`create-folder`](#create-folder). Defaults to account root |
| `account` | string | No | Account name (defaults to Notes.app's default account; matched exactly or by a *unique* prefix — an ambiguous prefix is refused). Must be an account Notes.app already has configured — see [`list-accounts`](#list-accounts) |
| `format` | string | No | Content format: `"plaintext"` (default) or `"html"`. In both formats, the title is automatically prepended as `<h1>`. In plaintext mode, newlines become `<br>`, tabs become `<br>`, and backslashes are preserved as HTML entities |

**Example (tagged with inline hashtags):**
```json
{
  "title": "Meeting Notes",
  "content": "Discussed Q4 roadmap and budget allocation\n\n#work #meetings"
}
```

**Example - Create in a specific folder:**
```json
{
  "title": "Client Meeting",
  "content": "Discussed project timeline",
  "folder": "Work/Clients"
}
```

**Example - HTML formatting:**
```json
{
  "title": "Status Report",
  "content": "<h2>Summary</h2><p>All tasks <b>on track</b>.</p><ul><li>Feature A: complete</li><li>Feature B: in progress</li></ul>",
  "format": "html"
}
```

> **Note:** The title is automatically prepended as `<h1>` in both plaintext and HTML formats. Do not include a `<h1>` title tag in the `content` parameter, or the title will appear twice.

**Returns:** Confirmation message with note title and ID. Save the ID for subsequent operations like `update-note`, `delete-note`, etc.

---

#### `search-notes`

Searches for notes by title or content.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Text to search for |
| `searchContent` | boolean | No | If `true`, searches note body; if `false` (default), searches titles only |
| `account` | string | No | Account to search in (defaults to Notes.app's default account; exact or unique-prefix match) |
| `folder` | string | No | Limit search to a specific folder (supports nested paths like `"Work/Clients"`) |
| `modifiedSince` | string | No | ISO 8601 date string to filter notes modified on or after this date (e.g., `"2025-01-01"`) |
| `limit` | number | No | Maximum number of results to return. **Defaults to 50** — a broad query reads several properties per match via AppleScript (~200ms/note), so an unbounded search over hundreds of matches can exceed Notes' 30s timeout and return an error instead of results. Pass a higher value to see more; the applied limit (and whether it truncated the results) is disclosed in the response. |

**Example - Search titles:**
```json
{
  "query": "meeting"
}
```

**Example - Search content:**
```json
{
  "query": "budget allocation",
  "searchContent": true
}
```

**Example - Search recent notes with limit:**
```json
{
  "query": "todo",
  "searchContent": true,
  "modifiedSince": "2025-01-01",
  "limit": 10
}
```

**Returns:** List of matching notes with titles, folder names, and IDs. Use the returned ID for subsequent operations like `get-note-content`, `update-note`, etc.

---

#### `get-note-content`

Retrieves the full content of a specific note.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | No | Note ID (preferred - more reliable than title) |
| `title` | string | No | Note title (use `id` instead when available) |
| `account` | string | No | Account containing the note (defaults to Notes.app's default account; exact or unique-prefix match, ignored if `id` is provided) |

**Note:** Either `id` or `title` must be provided. Using `id` is recommended as it's unique and avoids issues with duplicate titles.

**Example - Using ID (recommended):**
```json
{
  "id": "x-coredata://ABC123/ICNote/p456"
}
```

**Example - Using title:**
```json
{
  "title": "Shopping List"
}
```

**Returns:** The HTML content of the note, or error if not found. The
`structuredContent` also includes `hashtags` — any inline `#hashtag` tags parsed
from the body. Apple Notes tags are inline hashtags, not a scriptable property;
see [AppleScript limitations](docs/APPLESCRIPT-LIMITATIONS.md#tags--hashtags-29). Smart Folders are not scriptable.

**⚠️ The returned body can be lossy — do not write it back verbatim.** Inline
base64 images larger than `APPLE_NOTES_MCP_MAX_INLINE_IMAGE_BYTES` (default
256 KB) are replaced with `[inline image omitted: …]` text placeholders so an
image-heavy note cannot blow the MCP message limit. `structuredContent` reports
this as `strippedImages` (count) and `truncated` (boolean). When either is set,
passing this body to [`update-note`](#update-note) would replace the real images
with the placeholder text — use [`append-to-note`](#append-to-note) for
additions, or export the images with `save-attachment` / `fetch-attachment`
first.

---

#### `get-note-plaintext`

Retrieves a note's body as plain text, with no HTML markup.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | No | Note ID (preferred - more reliable than title) |
| `title` | string | No | Note title (use `id` instead when available) |
| `account` | string | No | Account containing the note (defaults to Notes.app's default account; exact or unique-prefix match, ignored if `id` is provided) |

**Note:** Either `id` or `title` must be provided. This reads the note's native `plaintext` property, so it skips the HTML-to-text conversion that `get-note-content` plus a Markdown pass would do. Use `get-note-content` when you need the HTML, or `get-note-markdown` when you want Markdown with checklist state.

**Returns:** The plain-text content of the note in `structuredContent.plaintext`, or error if not found.

---

#### `get-note-details`

Retrieves metadata about a note (without full content).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Exact title of the note |
| `account` | string | No | Account containing the note (defaults to Notes.app's default account; exact or unique-prefix match) |

**Example:**
```json
{
  "title": "Project Plan"
}
```

**Returns:** JSON with note metadata:
```json
{
  "id": "x-coredata://...",
  "title": "Project Plan",
  "created": "2025-01-15T10:30:00.000Z",
  "modified": "2025-01-20T14:22:00.000Z",
  "shared": false,
  "passwordProtected": false,
  "account": "iCloud"
}
```

---

#### `get-note-by-id`

Retrieves a note using its unique CoreData identifier.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The CoreData URL identifier (e.g., `x-coredata://...`) |

**Returns:** JSON with note metadata, or error if not found.

---

#### `show-note`

Reveals a note in Notes.app using its unique CoreData identifier.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The CoreData URL identifier (e.g., `x-coredata://...`) |
| `separately` | boolean | No | Open in a separate note window when supported by Notes.app |

**Returns:** Confirmation that Notes.app accepted the show command.

---

#### `update-note`

Updates an existing note's content and/or title.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | No | Note ID (preferred - more reliable than title) |
| `title` | string | No | Current title of the note to update (use `id` instead when available) |
| `newTitle` | string | No | New title (if changing the title; ignored when `format` is `"html"`) |
| `newContent` | string | Yes | New content for the note body |
| `account` | string | No | Account containing the note (defaults to Notes.app's default account; exact or unique-prefix match, ignored if `id` is provided) |
| `format` | string | No | Content format: `"plaintext"` (default) or `"html"`. When `"html"`, content replaces the entire note body as raw HTML and `newTitle` is ignored (the first HTML element serves as the title) |

**Note:** Either `id` or `title` must be provided. Using `id` is recommended.

**Returns:** Confirmation with the note's visible title and, for ID-based updates, its ID. For HTML updates, the title comes from the first rendered line of `newContent`, matching Notes.app. The response also warns if the note is shared.

**Example - Using ID (recommended):**
```json
{
  "id": "x-coredata://ABC123/ICNote/p456",
  "newContent": "Updated content here"
}
```

**Example - Update content only:**
```json
{
  "title": "Shopping List",
  "newContent": "- Milk\n- Eggs\n- Bread\n- Butter"
}
```

**Example - Update title and content:**
```json
{
  "title": "Draft",
  "newTitle": "Final Version",
  "newContent": "This is the completed document."
}
```

**Example - Update with HTML formatting:**
```json
{
  "id": "x-coredata://ABC123/ICNote/p456",
  "newContent": "<p>New findings with <b>bold</b> emphasis.</p><pre><code>console.log('hello');</code></pre>",
  "format": "html"
}
```

**Returns:** Confirmation message, or error if note not found.

**Note:** `newContent` **replaces the entire note body** — it is not appended. To add to a note, prefer [`append-to-note`](#append-to-note), which does the read-and-concatenate for you and always round-trips the body as HTML. If you do read-modify-write by hand, note that `get-note-content` replaces oversized inline images with text placeholders (see [`get-note-content`](#get-note-content)) — writing that body back bakes the placeholders in.

**Attachments:** A full-body replace can drop embedded files, images, scans, PDFs, or audio. When a note may hold attachments, run [`list-attachments`](#list-attachments) first, and either save them with `save-attachment` or build a new note rather than overwriting. See the [Apple Notes skill](skills/apple-notes/SKILL.md#attachment-safe-updates) guidance.

---

#### `delete-note`

Deletes a note (moves to Recently Deleted in Notes.app).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | No | Note ID (preferred - more reliable than title) |
| `title` | string | No | Exact title of the note to delete (use `id` instead when available) |
| `account` | string | No | Account containing the note (defaults to Notes.app's default account; exact or unique-prefix match, ignored if `id` is provided) |

**Note:** Either `id` or `title` must be provided. Using `id` is recommended.

**Example - Using ID (recommended):**
```json
{
  "id": "x-coredata://ABC123/ICNote/p456"
}
```

**Example - Using title:**
```json
{
  "title": "Old Draft"
}
```

**Returns:** Confirmation message, or error if note not found.

**⚠️ Safety:** Irreversible from the agent's side — requires explicit user confirmation before calling. Prefer `search-notes` / `list-notes` first to confirm the exact id(s) being deleted.

---

#### `move-note`

Moves a note to a different folder. The note is relocated in place via Notes.app's native `move`, so its id, creation date, and all embedded attachments (files, images, scans, PDFs, audio) are preserved. The destination folder must already exist — create it first with [`create-folder`](#create-folder).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | No | Note ID (preferred - more reliable than title) |
| `title` | string | No | Title of the note to move (use `id` instead when available) |
| `folder` | string | Yes | Destination folder name or nested path (e.g., `"Work/Clients"`) |
| `account` | string | No | Account containing the note (defaults to Notes.app's default account; exact or unique-prefix match, ignored if `id` is provided) |

**Note:** Either `id` or `title` must be provided. Using `id` is recommended.

**Example - Using ID (recommended):**
```json
{
  "id": "x-coredata://ABC123/ICNote/p456",
  "folder": "Archive"
}
```

**Example - Using title:**
```json
{
  "title": "Completed Task",
  "folder": "Archive"
}
```

**Returns:** Confirmation message, or error if note or folder not found.

---

#### `append-to-note`

Appends or prepends content to an existing note without replacing it. Always reads and writes as HTML, preserving all existing rich formatting.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | No | Note ID (preferred - more reliable than title) |
| `title` | string | No | Note title (use `id` instead when available) |
| `content` | string | Yes | Text to append to the note body |
| `position` | string | No | `"after"` (default) appends to the end; `"before"` prepends to the start |
| `separator` | string | No | String placed between existing content and new content (default: two newlines → `<div><br></div>` in HTML) |
| `format` | string | No | Format of the content being appended: `"plaintext"` (default) or `"html"` |
| `account` | string | No | Account containing the note (defaults to Notes.app's default account; exact or unique-prefix match, ignored if `id` is provided) |

**Note:** Either `id` or `title` must be provided. Using `id` is recommended.

**Example - Append plaintext:**
```json
{
  "id": "x-coredata://ABC123/ICNote/p456",
  "content": "New item added today"
}
```

**Example - Prepend HTML:**
```json
{
  "id": "x-coredata://ABC123/ICNote/p456",
  "content": "<div><b>Status:</b> done</div>",
  "format": "html",
  "position": "before"
}
```

**Returns:** Confirmation with note id and title. Warns when the note is shared with collaborators.

**⚠️ Safety:** Reads the existing body first, concatenates, then writes back. Run `list-attachments` first if the note may hold embedded files — a full-body rewrite can drop attachments.

---

#### `get-note-link`

Returns the `notes://showNote?identifier=<uuid>` deep-link URL for a note. The URL opens the note in Notes.app on iOS and macOS and can be stored in Reminders tasks or shared links.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | No | Note ID (preferred - more reliable than title) |
| `title` | string | No | Note title (use `id` instead when available) |
| `account` | string | No | Account containing the note (defaults to Notes.app's default account; exact or unique-prefix match, ignored if `id` is provided) |

**Note:** Either `id` or `title` must be provided. Using `id` is recommended. Password-protected notes cannot be linked.

**Example:**
```json
{
  "id": "x-coredata://ABC123/ICNote/p456"
}
```

**Returns:** `notes://showNote?identifier=<uuid>` URL string, plus the note id and title.

**Note:** The database-backed path requires Full Disk Access for the process macOS authorizes for that access. On macOS 12–15 the tool can fall back to the AppleScript `note link` property; on macOS 26+ it cannot. The responsible permission entry depends on the host/runtime launch context. Run `doctor` and call the tool to verify access; see [Full Disk Access](#full-disk-access).

---

#### `list-notes`

Lists all notes, optionally filtered by folder, date, and limit.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account` | string | No | Account to list notes from (defaults to Notes.app's default account; exact or unique-prefix match) |
| `folder` | string | No | Filter to notes in this folder only (supports nested paths like `"Work/Clients"`) |
| `modifiedSince` | string | No | ISO 8601 date string to filter notes modified on or after this date (e.g., `"2025-01-01"`) |
| `limit` | number | No | Maximum number of notes to return |

**Example - All notes:**
```json
{}
```

**Example - Notes in a folder:**
```json
{
  "folder": "Work"
}
```

**Example - Recent notes with limit:**
```json
{
  "modifiedSince": "2025-06-01",
  "limit": 20
}
```

**Returns:** List of notes as `{title, id}` pairs — `notes: Array<{title, id}>`, plus `count`. The human-readable line is `  - <title> [id: <id>]`.

Use the returned `id` for any follow-up read/update/move/delete rather than re-resolving the title: titles are not unique, and a by-title lookup resolves a duplicated title to the same one note every time, silently skipping the others.

> **Changed in 2.7.0:** `notes` was previously `string[]` (titles only). Callers that treated the array as strings must now read `.title`.

---

#### `get-selected-notes`

Reads the currently selected note(s) from the Notes.app UI.

**Parameters:** None

**Returns:** Selected note metadata, including IDs for follow-up operations. Returns an empty list when Notes.app has no selected note.

---

### Folder Operations

#### `list-folders`

Lists all folders in an account with full hierarchical paths.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `account` | string | No | Account to list folders from (defaults to Notes.app's default account; exact or unique-prefix match) |

**Example:**
```json
{}
```

**Returns:** List of folders with IDs, paths, account names, and shared state. Nested folders are shown as full paths (e.g., `Work/Clients/Omnia`). Duplicate folder names are disambiguated by their full path. Literal slashes in folder names are escaped as `\/` (e.g., `Spain\/Portugal 2023`).

---

#### `create-folder`

Creates a new folder, including a whole nested hierarchy in one call.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Folder name, or a nested path separated by `/` (e.g. `"Retro Tech/PC/CPUs"`). Every intermediate folder is created; segments that already exist are skipped |
| `account` | string | No | Account to create folder in (defaults to Notes.app's default account; exact or unique-prefix match) |

**Example:**
```json
{
  "name": "Work Projects"
}
```

**Example - Create a nested hierarchy:**
```json
{
  "name": "Work/Clients/Omnia"
}
```

**Returns:** Confirmation message. The call is **idempotent** — an already-existing folder (or path segment) is skipped rather than treated as an error, so it is safe to call before every `create-note` that targets a folder.

---

#### `delete-folder`

Deletes a folder.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Name or path of the folder to delete (supports nested paths like `"Work/Old"`) |
| `account` | string | No | Account containing the folder (defaults to Notes.app's default account; exact or unique-prefix match) |

**Example:**
```json
{
  "name": "Old Projects"
}
```

**Returns:** Confirmation message, or error if folder not found or not empty.

**⚠️ Safety:** Irreversible — requires explicit user confirmation before calling. Prefer `list-folders` first to confirm the exact folder path being deleted.

---

#### `show-folder`

Reveals a folder in Notes.app using its unique CoreData identifier.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The folder's CoreData identifier (from `list-folders`) |
| `separately` | boolean | No | Open in a separate window when supported by Notes.app |

**Returns:** Confirmation that Notes.app accepted the show command.

---

### Account Operations

#### `list-accounts`

Lists all configured Notes accounts.

**Parameters:** None

**Example:**
```json
{}
```

**Returns:** List of accounts with names, IDs, upgraded state, and default folder metadata.

---

#### `get-default-location`

Returns the default account and folder Notes.app uses for newly created notes.

**Parameters:** None

**Returns:** Default account and folder metadata, including IDs and shared state.

---

#### `show-account`

Reveals an account in Notes.app using its unique CoreData identifier.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The account's CoreData identifier (from `list-accounts`) |
| `separately` | boolean | No | Open in a separate window when supported by Notes.app |

**Returns:** Confirmation that Notes.app accepted the show command.

---

### Batch Operations

#### `batch-delete-notes`

Deletes multiple notes at once by ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ids` | string[] | Yes | Array of note IDs to delete (max 500 per request) |

**Returns:** Summary of successes and failures.

**⚠️ Safety:** Irreversible — requires explicit user confirmation before calling. Prefer `search-notes` / `list-notes` first to confirm the exact ids being deleted.

---

#### `batch-move-notes`

Moves multiple notes to a folder.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ids` | string[] | Yes | Array of note IDs to move (max 500 per request) |
| `folder` | string | Yes | Destination folder name or nested path (e.g., `"Work/Clients"`). Must already exist — create it with [`create-folder`](#create-folder) |
| `account` | string | No | Account containing the folder |

**Returns:** Summary of successes and failures.

---

### Export Operations

#### `export-notes-json`

Exports all notes as a JSON structure.

**Parameters:** None

**Returns:** Complete JSON export with all accounts, folders, and notes including metadata.

---

#### `get-note-markdown`

Gets a note's content as Markdown instead of HTML. If the note contains checklists and Full Disk Access is granted, checklist items are automatically annotated with `[x]` (done) or `[ ]` (undone).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | No | Note ID (preferred) |
| `title` | string | No | Note title |
| `account` | string | No | Account containing the note |

**Returns:** Note content converted to Markdown format. Checklist items include `[x]`/`[ ]` prefixes when database access is available.

---

#### `get-checklist-state`

Reads checklist done/undone state for a note. This bypasses the AppleScript limitation where `body of note` strips checklist state, by reading directly from the NoteStore SQLite database.

**Requires:** Full Disk Access for the process macOS authorizes for this database read (see [Full Disk Access](#full-disk-access)); verify access with `doctor` and a database-backed read.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Note ID (use `search-notes` to find it first) |

**Example:**
```json
{
  "id": "x-coredata://ABC123/ICNote/p456"
}
```

**Returns:** Checklist items with done/undone state and progress count:
```
Checklist for "Shopping List" (2/4 done):
[x] Buy milk
[x] Get bread
[ ] Pick up laundry
[ ] Call dentist
```

---

#### `get-note-metadata` (BETA)

Reads note metadata that AppleScript cannot expose, by querying the NoteStore SQLite database directly: pinned state, checklist flags, trash/recovery state, the preview snippet, and the password hint. The available fields vary by macOS version.

**Requires:** Full Disk Access for the process macOS authorizes for this database read (see [Full Disk Access](#full-disk-access)); verify access with `doctor` and a database-backed read.

**BETA:** the NoteStore schema changes between macOS releases, so some fields can be absent on older or newer systems. The database is only ever read, never written.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Note ID (use `search-notes` to find it first) |

**Returns:** A metadata object in `structuredContent` holding any of `pinned`, `hasChecklist`, `hasChecklistInProgress`, `recoveringFromTrash`, `passwordProtected`, `passwordHint`, `snippet`, `widgetSnippet`, and `smartFolderQuery`. Unlike most read tools, it also resolves trashed notes that AppleScript can no longer find.

---

#### `list-attachments`

Lists attachments in a note.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | No | Note ID (preferred) |
| `title` | string | No | Note title |
| `account` | string | No | Account containing the note |

**Returns:** List of attachments with IDs, names, content identifiers, URLs when available, created/modified dates, and shared state.

**⚠️ Safety:** A lookup failure is reported as an error, never as an empty list — so an empty result reliably means the note has no attachments and is safe to replace wholesale. Treat an error as "unknown", not "none".

---

#### `save-attachment`

Saves a note attachment to disk.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `noteId` | string | Yes | CoreData note ID (from `search-notes`/`list-notes`) |
| `attachmentId` | string | Yes | Attachment ID (from `list-attachments`) |
| `savePath` | string | Yes | Absolute destination file path. Must be under your home directory, a temp directory, or `/Volumes` |

**Returns:** Confirmation with the saved path, name, and content type (also in `structuredContent`).

---

#### `fetch-attachment`

Returns a note attachment's bytes as base64, without writing to disk (the read counterpart to `save-attachment`).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `noteId` | string | Yes | CoreData note ID (from `search-notes`/`list-notes`) |
| `attachmentId` | string | Yes | Attachment ID (from `list-attachments`) |

**Returns:** The attachment name, content type, byte count, and base64 payload in `structuredContent.base64`.

---

#### `show-attachment`

Reveals one note attachment in Notes.app. Attachments are elements of a note, so this takes both the note id and the attachment id (the same pair used by `save-attachment` / `fetch-attachment`).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `noteId` | string | Yes | CoreData note ID (from `search-notes`/`list-notes`) |
| `attachmentId` | string | Yes | Attachment ID (from `list-attachments`) |
| `separately` | boolean | No | Open in a separate window when supported by Notes.app |

**Returns:** Confirmation that Notes.app revealed the attachment.

---

### Diagnostics

#### `health-check`

Verifies Notes.app connectivity and permissions.

**Parameters:** None

**Returns:** Status of all health checks (app installed, permissions, account access).

---

#### `doctor`

Run a full setup diagnostic: Notes.app reachability, the Automation permission, configured accounts, and Full Disk Access — each reported as ok / warn / fail with an actionable message. This is the richer counterpart to `health-check`; reach for it first when something isn't working.

**Parameters:** None

**Returns:** A per-check report (`structuredContent` carries the raw `{healthy, checks[]}`). The Full Disk Access check tells you whether checklist-state features will work — see [Full Disk Access](#full-disk-access).

---

#### `get-notes-stats`

Gets comprehensive statistics about your notes.

**Parameters:** None

**Returns:** Total counts, per-account breakdown, folder statistics, and recently modified counts.

The `structuredContent` also includes a `coverage` object — `{ complete, scanned, covered, warnings[] }`. If `complete` is `false`, one or more accounts (or the recent-activity scan) could not be read and the counts reflect only the scopes that succeeded; the text output adds a "⚠️ Partial results" line. This lets you tell a genuinely empty library apart from a partial failure.

---

#### `get-sync-status`

Checks iCloud sync status.

**Parameters:** None

**Returns:** Whether sync is active, pending uploads, and last activity time.

---

#### `list-shared-notes`

Lists all notes shared with collaborators.

**Parameters:** None

**Returns:** List of shared notes with warnings about collaboration.

---

## Usage Patterns

### Basic Workflow

```
User: "Create a note called 'Todo' with my tasks for today"
AI: [calls create-note with title="Todo", content="Tasks for today..."]
    "I've created a note called 'Todo' with your tasks."

User: "What notes do I have?"
AI: [calls list-notes]
    "You have 15 notes: Todo, Shopping List, Meeting Notes..."

User: "Show me the Shopping List"
AI: [calls get-note-content with title="Shopping List"]
    "Here's your shopping list: - Milk - Eggs - Bread..."
```

### Working with Accounts

Omit `account` and an operation targets whichever account **Notes.app itself
reports as the default** — not a hardcoded "iCloud". That matters if your default
is a non-iCloud account, if the account name is localized, or if it carries a
trailing U+F8FF () character.

```
User: "What accounts do I have?"
AI: [calls list-accounts]
    "You have 3 accounts: iCloud, Gmail, Exchange"

User: "List notes in my Gmail account"
AI: [calls list-notes with account="Gmail"]
    "Your Gmail account has 5 notes..."
```

When you do pass `account`, it is resolved in this order:

1. **Exact name match** wins outright.
2. A **unique prefix match** resolves — `account="work"` finds
   `work-notes`.
3. An **ambiguous prefix is refused**, with every candidate named:

   ```
   Account "work" is ambiguous - it matches 2 accounts:
   work-notes, work-archive. Use the full account name.
   ```

That third rule is deliberate. Silently taking the *first* prefix match would
make `delete-note` or `move-note` land in the wrong account and report success.
An unresolvable account is reported as such rather than as "note not found", so
you are not sent looking for the wrong problem.

### Organizing with Folders

```
User: "Create a folder called 'Archive'"
AI: [calls create-folder with name="Archive"]
    "Created folder 'Archive'"

User: "Move my old meeting notes to Archive"
AI: [calls move-note with title="Old Meeting Notes", folder="Archive"]
    "Moved 'Old Meeting Notes' to 'Archive'"

User: "What folders do I have?"
AI: [calls list-folders]
    "You have 5 folders: Work, Work/Clients, Work/Clients/Omnia, Archive, Recipes"

User: "Create a note in Work/Clients about Acme Corp"
AI: [calls create-note with title="Acme Corp", content="...", folder="Work/Clients"]
    "Created 'Acme Corp' in Work/Clients"
```

---

---

## Configuration

### Environment variables

All configuration is optional — the server works out of the box. Override behavior with these variables (set them in your MCP client's `env` block, or via the [config file](#configuration-file-when-the-host-strips-env) below):

Permission switches (also accepted through the JSON config file) are:

| Variable | Default | Enablement rule |
|----------|---------|-----------------|
| `APPLE_NOTES_MCP_ALLOW_READ` | enabled | Read tools, resources, and read prompts are enabled when missing. If supplied, only the exact lowercase string `"true"` enables them. |
| `APPLE_NOTES_MCP_ALLOW_WRITE` | disabled | Write tools and the `new-meeting-note` prompt are registered only when the exact lowercase string `"true"` is supplied. |
| `APPLE_NOTES_MCP_ALLOW_DESTRUCTIVE` | disabled | Destructive tools are registered only when the exact lowercase string `"true"` is supplied. This switch is independent of write access. |

Tools requiring a disabled capability are not registered with the MCP server, so clients cannot see or call them. The three capabilities are independent: enabling destructive access does not implicitly enable write access, and vice versa.

| Variable | Default | Description |
|----------|---------|-------------|
| `APPLE_NOTES_MCP_MAX_BUFFER` | `67108864` (64 MB) | Max bytes captured from a single AppleScript invocation. Raise it if a very large export/list is truncated; lower it to cap memory. |
| `APPLE_NOTES_MCP_MAX_ATTACHMENT_BYTES` | `26214400` (25 MB) | Max size of an attachment that [`fetch-attachment`](#fetch-attachment) will base64-encode inline. Larger attachments are rejected with an error pointing at [`save-attachment`](#save-attachment) (which streams to disk and has no such limit). Raise it to fetch bigger attachments inline; lower it to cap memory. |
| `APPLE_NOTES_MCP_MAX_INLINE_IMAGE_BYTES` | `262144` (256 KB) | Per-image cap on the base64 payload kept inline in a [`get-note-content`](#get-note-content) response. Inline images over the cap are replaced with placeholders (with a warning appended) so an image-heavy note cannot exceed the MCP client's message limit and drop the connection; export the real files with [`save-attachment`](#save-attachment) or [`fetch-attachment`](#fetch-attachment). Raise it to keep bigger images inline. |
| `APPLE_NOTES_MCP_CONFIG_FILE` | `~/Library/Application Support/apple-notes-mcp/config.json` | Path to the JSON config file (see below). |
| `APPLE_NOTES_MCP_TIMEOUT_MS` | `30000` (30 s) | Total AppleScript operation timeout, including retry attempts and delays. Raise it if full-library operations (large searches, exports) time out on a big Notes library. Per-call `timeoutMs` options still win. |
| `APPLE_NOTES_MCP_MAX_RETRIES` | `2` | Maximum attempts for a read-only AppleScript call that fails with a **transient** error (Notes.app busy / not responding / lost connection). `2` means one retry; set `1` to fail fast with no retries. Retries share the single `APPLE_NOTES_MCP_TIMEOUT_MS` budget rather than each getting a fresh one, and a retry is skipped when under a second of that budget remains — so this is a ceiling, not a guarantee. In particular a call that exhausts the budget with a **timeout** has no time left to retry by construction. Mutating operations run once because a timeout can occur after Notes.app applied the change. Non-transient errors (e.g. "note not found") never retry. |
| `APPLE_NOTES_MCP_RETRY_DELAY_MS` | `1000` (1 s) | Base delay before the first retry; subsequent retries back off exponentially (1s, 2s, 4s, ...). |
| `DEBUG` / `VERBOSE` | unset | Set either to enable verbose diagnostic logging to stderr. |

### Configuration file (when the host strips `env`)

Some host apps (e.g. Claude Desktop) launch the MCP server with a scrubbed
environment and ignore the `env` block in their server config, so there's no way
to pass `APPLE_NOTES_MCP_*` settings through it. In that case, put them in a JSON
file the host doesn't manage — `APPLE_NOTES_MCP_CONFIG_FILE`, or by default
`~/Library/Application Support/apple-notes-mcp/config.json`:

```json
{
  "APPLE_NOTES_MCP_MAX_BUFFER": "134217728",
  "DEBUG": "1"
}
```

The server reads it at startup and merges string values into the environment.
A non-empty value already present in the process environment wins; an empty
value is treated as unset and can be replaced by the file. This config is not a
secret store, so keep credentials and other secrets out of it.

---

## Full Disk Access

Several tools read directly from the Apple Notes SQLite database, which lives in a macOS-protected directory. Those tools require **Full Disk Access** for the process macOS authorizes: `get-checklist-state`, `get-note-metadata`, `get-note-link`, the checklist annotations in `get-note-markdown`, and the database half of `get-sync-status`.

> 📘 **For the full why-and-how walkthrough (which app to grant, verifying with `doctor`, graceful degradation), see the [Full Disk Access guide](docs/FULL-DISK-ACCESS.md).** The summary below is the quick version.

### How to Grant Full Disk Access

1. Open **System Settings** (or System Preferences on older macOS)
2. Go to **Privacy & Security > Full Disk Access**
3. Click the **+** button and add the application macOS associates with the
   server process for this launch method. Which entry is responsible can depend
   on the host and runtime; this repository's source and documentation do not
   establish a universal target. Avoid granting access to extra apps by guess.
4. Restart the relevant host/process and run `doctor`; confirm database-backed
   reads work before relying on them.

### Without Full Disk Access

Every tool that does not read the Notes database works normally without Full Disk Access — that is the whole AppleScript surface (create, read, search, update, move, delete, folders, accounts, attachments, stats, export). The database-backed tools degrade like this:
- `get-checklist-state` returns an error explaining that database access is needed
- `get-note-metadata` returns the same kind of error — it has no non-database path
- `get-note-link` returns an error on macOS 26+; on macOS 12–15 it still works via the AppleScript `note link` fallback
- `get-note-markdown` returns plain list items without `[x]`/`[ ]` annotations (graceful fallback)
- `get-sync-status` still answers, but reports no pending uploads and no active sync — treat that as "unknown", not "idle"

---

## Security and Privacy

- **Local process** - The server uses local stdio and AppleScript and does not itself implement network requests. An MCP host or model may transmit returned note content according to its own service and privacy settings.
- **Automation permission** - macOS may prompt the responsible app to control Notes.app when Apple Events are first used.
- **Password-protected notes** - Protected note content is unavailable unless unlocked in Notes.app; some metadata may still be visible.
- **No credential storage** - The server doesn't store any passwords or authentication tokens.

---

## Known Limitations

| Limitation | Reason |
|------------|--------|
| macOS only | Apple Notes and AppleScript are macOS-specific |
| Batch ops run per-note | `batch-delete-notes` / `batch-move-notes` apply each note individually rather than as one bulk operation — AppleScript has no bulk equivalent to IMAP's `UID STORE`/`MOVE`. This is deliberate: it preserves per-note success/failure reporting. ([#26](https://github.com/sweetrb/apple-notes-mcp/issues/26)) |
| Pinned notes are read-only | AppleScript exposes no `pinned` property. Pin state is readable via the BETA `get-note-metadata` tool (NoteStore database, needs Full Disk Access) but cannot be set ([#28](https://github.com/sweetrb/apple-notes-mcp/issues/28)) |
| Limited rich formatting | Use `format: "html"` on create/update for headings, lists, bold, code blocks; some complex formatting may not render |
| Title matching | Most operations require exact title matches |
| Checklist state | Requires [Full Disk Access](docs/FULL-DISK-ACCESS.md) to read done/undone state from the database |
| Checklist **creation** | Not supported. AppleScript's `body of note` setter strips `<input type="checkbox">` and ignores any checklist-styling CSS class. Apple Notes stores checklist items as a protobuf paragraph style (`style_type=103`) that AppleScript doesn't expose, and the SQLite database is read-only. See [Creating Checklists](#creating-checklists) below for the workaround. |

### Creating Checklists

**There is no programmatic way to create a true Apple Notes checklist via AppleScript** — and therefore no way via this MCP server. This is an Apple limitation, not a bug.

When a note is created or updated via AppleScript:

| You send | What Notes.app actually renders |
|----------|--------------------------------|
| `<input type="checkbox"> Item` | `Item` (the `<input>` tag is stripped) |
| `<ul class="checklist"><li>Item</li></ul>` | A plain bulleted list — the `checklist` class is dropped |
| Markdown `- [ ] Item` (in `plaintext` mode) | The literal text `- [ ] Item` |

Apple Notes stores checklists as a paragraph style (`style_type=103`) inside a gzipped protobuf blob in the `NoteStore.sqlite` database. AppleScript's note `body` interface does not expose paragraph styles, and writing directly to the live database is unsafe.

**Workarounds:**

1. **Create the note with bulleted list items, then convert manually in Notes.app.** Select the items and press <kbd>⇧⌘L</kbd> (or **Format → Checklist**). This converts the list in place and the resulting checklist will be readable by `get-checklist-state` and annotated by `get-note-markdown`.
2. **Use the Apple Shortcuts app** to script the checklist creation, since Shortcuts can manipulate Notes content at a higher level than AppleScript.
3. **Read-only checklist support is fully implemented** — once a checklist exists (created manually or by another app), `get-checklist-state` and `get-note-markdown` will read its done/undone state correctly (with Full Disk Access).

If you need to *track* todos programmatically and don't strictly need them rendered as Apple Notes checklist UI, plain markdown-style `- [ ] item` / `- [x] item` lines in a `plaintext` note are a reasonable alternative — they are searchable, human-readable, and can be parsed by downstream tooling.

### Backslash Escaping (Important for AI Agents)

When sending content containing backslashes (`\`) to this MCP server, **you must escape them as `\\`** in the JSON parameters.

**Why:** The MCP protocol uses JSON for parameter passing. In JSON, a single backslash is an escape character. To include a literal backslash in content, it must be escaped as `\\`.

**Example - Shell command with escaped path:**
```json
{
  "title": "Install Script",
  "content": "cp ~/Library/Mobile\\ Documents/file.txt ~/.config/"
}
```
→ arrives as: `cp ~/Library/Mobile\ Documents/file.txt ~/.config/`

In a JSON string literal the two characters `\\` denote **one** literal backslash. Doubling them to `\\\\` denotes *two* backslashes in the note, which is almost never what you want.

**Example - Literal double backslash:**
```json
{
  "title": "Escaping Notes",
  "content": "Send \\\\ only when you want two backslashes"
}
```
→ arrives as: `Send \\ only when you want two backslashes`

**Common patterns requiring escaping:**
- Shell escaped spaces: `Mobile\ Documents` → `Mobile\\ Documents` in JSON
- Regex patterns: `\d+` → `\\d+` in JSON
- Literal double backslash: `\\` → `\\\\` in JSON

**If you see errors** when creating/updating notes with backslashes, double-check that backslashes are properly escaped in the JSON payload.

---

## Troubleshooting

### "Notes.app not responding"
- Ensure Notes.app is not frozen
- Try opening Notes.app manually
- Restart the MCP server

### "Permission denied"
- macOS needs automation permission
- Go to System Settings > Privacy & Security > Automation
- Ensure your terminal/Claude has permission to control Notes

### "Note not found"
- Note titles must match exactly (case-sensitive)
- Check if the note is in a different account
- Use `list-notes` to see available notes

### Note creation/update fails silently with backslashes
- Content containing `\` characters requires JSON escaping
- Use `\\` to represent each literal backslash
- See "Backslash Escaping" section under Known Limitations

### Notes accumulate blank lines after repeated updates
- Repeatedly updating a note (especially with HTML content) can accumulate whitespace artifacts — `<div><br></div>` tags that persist between sections even after you remove them from your content
- Apple Notes' internal HTML processing preserves empty divs from previous edits, so the gaps are baked into the note's internal representation and cannot be fixed through further updates
- Fix: delete the note with `delete-note` and create a fresh one with `create-note`

### Every tool is refused: "invalid outputSchema … unsupported dialect"

If your client reports something like

```
Tool 'list-notes' has an invalid outputSchema: JSON Schema declares an unsupported
dialect ("$schema": "http://json-schema.org/draft-07/schema#"). The default
validator supports JSON Schema 2020-12 only.
```

you are on a version older than **2.7.2**. MCP standardized on JSON Schema
2020-12, and every tool this server advertised carried the older draft-07
dialect, so clients rejected all of them at once — nothing about your Notes
library, permissions, or configuration is involved.

- Fix: use a corrected version of this derivative built from this repository;
  do not use `npx apple-notes-mcp` or an upstream marketplace plugin to update
  this checkout.
- Running from a clone: pull the intended repository revision, run
  `corepack pnpm install --frozen-lockfile && corepack pnpm run build`, then
  restart the client.

### `apple-notes` server fails to connect
- Confirm the host's MCP entry launches the local absolute path to `build/index.js` from this repository; the tracked Codex and Antigravity plugin templates currently launch an npm package instead.
- Rebuild after source changes with `corepack pnpm run build` and restart the host.
- Check the host's MCP server status and logs for startup or permission errors.

---

## Development

Development uses [pnpm](https://pnpm.io/) (see `packageManager` in `package.json`):

```bash
pnpm install            # Install dependencies
pnpm run build          # Typecheck, then bundle src/index.ts into build/index.js (esbuild)
pnpm test               # Run unit test suite (mocked AppleScript)
pnpm run test:integration  # Run integration tests against real Notes.app
pnpm run test:all       # Unit + integration
pnpm run lint           # Check code style
pnpm run format         # Format code
```

The integration suite (`test/integration.test.ts`) drives the real
`AppleNotesManager → AppleScript → Notes.app` stack — creating, reading,
searching, and deleting throwaway notes. Its setup probes configured accounts by
creating and deleting a note, so the suite can modify the Notes library selected
by the test process. Do not run the live suite against a personal Notes library;
use a dedicated disposable macOS account and Notes library. The pure
path-safety and hashtag tests need no Notes.app and always run.

---

## Attribution

This repository is an unofficial derivative of [sweetrb/apple-notes-mcp](https://github.com/sweetrb/apple-notes-mcp). The upstream project's MIT licence and notices are preserved.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Related Projects

Related projects maintained upstream:

- [apple-mail-mcp](https://github.com/sweetrb/apple-mail-mcp) — MCP server for Apple Mail (read, search, send, and organize email)
- [apple-numbers-mcp](https://github.com/sweetrb/apple-numbers-mcp) — MCP server for Apple Numbers (read and write .numbers spreadsheets)
- [apple-photos-mcp](https://github.com/sweetrb/apple-photos-mcp) — MCP server for Apple Photos (query metadata and export originals)

## Recurring macOS permission prompts

If macOS repeats Full Disk Access or Automation prompts after a runtime update, the host process identity or runtime signature may have changed. See [Node runtime and TCC permissions](docs/NODE-RUNTIME-AND-TCC-PERMISSIONS.md) for background and troubleshooting; this behavior depends on macOS and the specific host/runtime, so stable permission persistence is not guaranteed.
