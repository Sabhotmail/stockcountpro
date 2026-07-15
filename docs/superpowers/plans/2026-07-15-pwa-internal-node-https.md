# PWA Internal Node HTTPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make StockCount Pro installable as an internal PWA over HTTPS on any LAN IP using a custom Node server, with a minimal offline shell page.

**Architecture:** `server.mjs` terminates TLS and delegates to Next.js. `manifest.ts`, icons, and `PwaRegister` provide installability. A conservative `public/sw.js` precaches only the offline shell and icons; navigation is network-first with `/~offline` fallback.

**Tech Stack:** Next.js 16 App Router, Node.js HTTPS, hand-written service worker, SVG icons

## Global Constraints

- No hardcoded server IP in application code
- Server binds `0.0.0.0`, port `3443` by default
- Certificate paths configurable via `HTTPS_KEY_FILE`, `HTTPS_CERT_FILE`, `HTTPS_HOST`, `HTTPS_PORT`
- No offline counting, API caching, or private cert commits
- `start_url` is relative (`/login`)
- Fail silently when SW cannot register (HTTP dev)

---

### Task 1: HTTPS server

**Files:**
- Create: `server.mjs`
- Modify: `package.json`

- [x] Add `server.mjs` with cert loading and Next handler
- [x] Add `npm run start:https`

### Task 2: Manifest and metadata

**Files:**
- Create: `src/app/manifest.ts`
- Create: `public/icons/icon-192.svg`, `icon-512.svg`, `maskable-icon.svg`
- Modify: `src/app/layout.tsx`

- [x] Manifest route with box-check icons
- [x] Root metadata + `themeColor`

### Task 3: Service worker

**Files:**
- Create: `public/sw.js`
- Create: `src/components/PwaRegister.tsx`
- Modify: `src/app/layout.tsx`

- [x] Network-first navigation, offline fallback
- [x] Register only in secure context

### Task 4: Offline page

**Files:**
- Create: `src/app/~offline/page.tsx`

- [x] Thai offline message with retry and login link

### Task 5: Docs and gitignore

**Files:**
- Create: `docs/pwa-internal-https.md`
- Modify: `.gitignore`

- [x] mkcert/OpenSSL instructions with `<server-ip>` placeholder
- [x] Ignore `certs/` directory

### Task 6: Verify

- [x] `npm run build` succeeds
