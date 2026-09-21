# Node runtime & TCC permission diagnostics

macOS gates this MCP server's access to your data behind **TCC** permissions —
**Full Disk Access** (to read app data such as Mail, Notes, or Photos) and
**Automation / Apple Events** (to drive an app like Mail.app or Notes.app via
AppleScript). See this repo's Full Disk Access / Automation notes for *which*
operations need which permission.

This page describes a reported permission-prompt pattern after runtime updates.
The server's `doctor` tool inspects the Node executable's signature and warns
when it is ad-hoc signed. That warning is diagnostic, not proof that replacing
Node will fix every host's TCC behavior.

## Symptom

- You granted Full Disk Access (and/or Automation) to "node", but days later
  macOS prompts again — `"node" wants access to ...` or `"node" wants to control
  "Mail"`.
- System Settings → Privacy & Security → Full Disk Access shows **several
  identical "node" rows**, usually only one enabled.
- It tends to happen immediately after you update Node.

## Cause

The `doctor` check treats an ad-hoc signature (no Team ID) as a possible source
of repeated prompts when an executable changes. The responsible TCC identity
and the item that must be granted can vary with macOS, the host application, and
how the MCP process is launched. This repository has not verified a universal
host-versus-Node rule or guaranteed persistence across runtime updates.

To inspect a Node binary, use the absolute path configured in your MCP host.
The following read-only example uses a placeholder; resolving `node` from a
terminal may inspect a different executable than the server uses:

```bash
NODE_EXECUTABLE="/absolute/path/to/the/configured/node"
codesign -dvvv "$NODE_EXECUTABLE" 2>&1 | grep -E 'Signature|TeamIdentifier'
Signature=adhoc
TeamIdentifier=not set
```

If it reports an ad-hoc signature, `doctor` will flag that condition. It does
not establish that a particular macOS prompt or permission entry is caused by
the signature; verify the actual host/runtime behavior before changing Node or
granting additional access.

## Before changing the runtime

Do not replace a working Node installation or grant Full Disk Access to extra
apps solely on the basis of the ad-hoc-signature warning. First use `doctor`,
identify which process macOS associates with the denied operation, and verify
whether a runtime change resolves the prompt on the target host and macOS
version. See [Full Disk Access](FULL-DISK-ACCESS.md) for the database permission
scope. Permission persistence is not guaranteed by this guide.

If testing another Node runtime, obtain it from its official distributor,
verify its current signature and checksum, configure the MCP host to use the
local executable, then verify the actual macOS permission behavior. This
repository does not recommend a particular alternate runtime or guarantee that
permissions persist across updates.
