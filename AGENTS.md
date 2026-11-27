# Agent Instructions

This repository is an Inventory Count System built with Next.js.

Before coding, read these files first:

- `.cursor/rules/inventory-count-system.mdc`
- `docs/INVENTORY_COUNT_PRD.md`
- `docs/CURSOR_START_PROMPT.md`
- `docs/PRODUCTION_HARDENING_TODO.md`

Current project mode:

- Prototype / Mock-first Development
- The real Express API is not ready yet
- Build the UI and main flow first
- Keep the code flexible because requirements may change
- Do not over-engineer production security/offline/versioning yet
- But keep the structure ready for production later

Start with mock data and mock API routes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
