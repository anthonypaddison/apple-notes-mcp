/**
 * Explicit capability policy for the private derivative.
 *
 * Environment and file-config values are untrusted strings. Read access is
 * enabled when unspecified; write and destructive access require the exact
 * value "true". Explicitly supplied malformed or false-like values deny it.
 */
export type Permission = "read" | "write" | "destructive";

export interface Permissions {
  read: boolean;
  write: boolean;
  destructive: boolean;
}

const ENVIRONMENT_KEYS: Record<Permission, string> = {
  read: "APPLE_NOTES_MCP_ALLOW_READ",
  write: "APPLE_NOTES_MCP_ALLOW_WRITE",
  destructive: "APPLE_NOTES_MCP_ALLOW_DESTRUCTIVE",
};

export const TOOL_PERMISSIONS = {
  "create-note": "write",
  "search-notes": "read",
  "get-note-content": "read",
  "get-note-plaintext": "read",
  "get-note-by-id": "read",
  "get-note-details": "read",
  "show-note": "read",
  "get-note-link": "read",
  "show-folder": "read",
  "show-account": "read",
  "update-note": "write",
  "append-to-note": "write",
  "delete-note": "destructive",
  "move-note": "write",
  "list-notes": "read",
  "get-selected-notes": "read",
  "list-folders": "read",
  "create-folder": "write",
  "delete-folder": "destructive",
  "list-accounts": "read",
  "get-default-location": "read",
  "list-shared-notes": "read",
  "get-sync-status": "read",
  "health-check": "read",
  doctor: "read",
  "get-notes-stats": "read",
  "list-attachments": "read",
  "batch-delete-notes": "destructive",
  "batch-move-notes": "write",
  "save-attachment": "write",
  "fetch-attachment": "read",
  "show-attachment": "read",
  "export-notes-json": "read",
  "get-note-markdown": "read",
  "get-checklist-state": "read",
  "get-note-metadata": "read",
} as const satisfies Record<string, Permission>;

function readCapability(env: NodeJS.ProcessEnv, key: string, defaultValue: boolean): boolean {
  const value = env[key];
  return value === undefined ? defaultValue : value === "true";
}

export function resolvePermissions(env: NodeJS.ProcessEnv = process.env): Permissions {
  return {
    read: readCapability(env, ENVIRONMENT_KEYS.read, true),
    write: readCapability(env, ENVIRONMENT_KEYS.write, false),
    destructive: readCapability(env, ENVIRONMENT_KEYS.destructive, false),
  };
}

export function toolPermission(name: string): Permission | undefined {
  return TOOL_PERMISSIONS[name as keyof typeof TOOL_PERMISSIONS];
}

export function allowedToolNames(permissions: Permissions): string[] {
  return Object.entries(TOOL_PERMISSIONS)
    .filter(([, permission]) => permissions[permission])
    .map(([name]) => name);
}
