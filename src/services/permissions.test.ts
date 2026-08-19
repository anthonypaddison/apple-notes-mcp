import { describe, expect, it } from "vitest";
import { allowedToolNames, resolvePermissions, toolPermission } from "@/services/permissions.js";

describe("permission policy", () => {
  it("fails closed unless each capability is explicitly true", () => {
    expect(resolvePermissions({})).toEqual({ read: true, write: false, destructive: false });
    expect(
      resolvePermissions({
        APPLE_NOTES_MCP_ALLOW_READ: "TRUE",
        APPLE_NOTES_MCP_ALLOW_WRITE: "yes",
        APPLE_NOTES_MCP_ALLOW_DESTRUCTIVE: "1",
      })
    ).toEqual({ read: false, write: false, destructive: false });
  });

  it("allows only the explicitly enabled capability category", () => {
    const permissions = resolvePermissions({ APPLE_NOTES_MCP_ALLOW_READ: "true" });

    expect(allowedToolNames(permissions)).toContain("get-note-content");
    expect(allowedToolNames(permissions)).toContain("show-note");
    expect(allowedToolNames(permissions)).not.toContain("create-note");
    expect(allowedToolNames(permissions)).not.toContain("delete-note");
  });

  it("classifies attachment saves as write and unknown tools as denied", () => {
    expect(toolPermission("save-attachment")).toBe("write");
    expect(toolPermission("not-a-real-tool")).toBeUndefined();
  });

  it("has an exhaustive, non-overlapping 26 read / 7 write / 3 destructive catalog", () => {
    expect(allowedToolNames({ read: true, write: false, destructive: false })).toHaveLength(26);
    expect(allowedToolNames({ read: false, write: true, destructive: false })).toHaveLength(7);
    expect(allowedToolNames({ read: false, write: false, destructive: true })).toHaveLength(3);
    expect(allowedToolNames({ read: true, write: true, destructive: true })).toHaveLength(36);
  });
});
