# Contributing to this Apple Notes MCP derivative

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/anthonypaddison/apple-notes-mcp.git
   cd apple-notes-mcp
   ```

2. **Install dependencies**
   ```bash
   corepack pnpm install --frozen-lockfile
   ```

   This derivative pins pnpm via `packageManager` in `package.json`. The MCP server requires Node.js >= 20. Use Node.js >= 22.13 for development tooling, as declared by the repository's CI configuration.

3. **Build the project**
   ```bash
   corepack pnpm run build
   ```

4. **Run tests**
   ```bash
   corepack pnpm test
   ```

## Code Style

This project uses ESLint and Prettier for code quality and formatting.

```bash
# Check for linting issues
pnpm run lint

# Auto-fix linting issues
pnpm run lint:fix

# Format code
pnpm run format

# Check formatting
pnpm run format:check
```

## Testing

All new features should include tests. We use Vitest for testing. Unit tests mock AppleScript; do not run the live suite against a personal Notes library.

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm run test:watch
```

### Testing Guidelines

- Tests mock the `runAppleScript` function since AppleScript only works on macOS
- Test both success and failure paths
- Test edge cases (empty strings, special characters, etc.)

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b ap-your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add JSDoc comments for new functions
   - Add tests for new functionality

3. **Run all checks**
   ```bash
   corepack pnpm run lint
   corepack pnpm run typecheck
   corepack pnpm run format:check
   corepack pnpm test
   corepack pnpm run build
   ```

4. **Version bump & committed bundle** (shipped-code changes only)
   - Any change to shipped code (`src/**` excluding tests, or the runtime `dependencies` in `package.json`) must bump `package.json` at least a patch (`pnpm version patch --no-git-tag-version`) and add a CHANGELOG.md entry in the same PR — the `require-version-bump` CI check fails the PR otherwise. Docs-only and test-only PRs are exempt.
   - The bundled `build/index.js` is committed to git: after source changes, rebuild (`pnpm run build`) and commit the updated bundle alongside `src/` — CI verifies the committed bundle matches the source.

5. **Commit your changes**
   - Use clear, descriptive commit messages
   - Reference any related issues

6. **Push and create a PR**
   - Describe what your PR does
   - Link any related issues

## Adding New Tools

When adding a new MCP tool:

1. **Add the schema** in `src/index.ts` (with a structured `Use when: / Returns: / Do not use when:` description, plus `Safety:` for any write/destructive tool)
2. **Implement the method** in `src/services/appleNotesManager.ts`
3. **Add type definitions** in `src/types.ts`
4. **Write tests** in `src/services/appleNotesManager.test.ts`
5. **Update documentation** in README.md and CHANGELOG.md. If the skill guidance changed, edit `skills/apple-notes/SKILL.md` (the canonical copy) and run `pnpm run sync:skills` — the `codex/` and `.antigravity-plugin/` copies are generated from it and CI fails if they drift

## AppleScript Guidelines

- Always escape user input using `escapeForAppleScript()` for plain text or `escapeHtmlForAppleScript()` for HTML content
- Handle errors gracefully (return null/false instead of throwing)
- Log errors with `console.error()` for debugging
- Test on actual macOS when possible

## Questions?

Open an issue for any questions about contributing.
