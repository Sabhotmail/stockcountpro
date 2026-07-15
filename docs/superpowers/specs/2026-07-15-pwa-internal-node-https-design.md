# PWA Internal Node HTTPS Design

Date: 2026-07-15
Status: Approved for planning
Scope: Installable internal PWA over LAN IP using a custom Node HTTPS server. Offline counting is out of scope.

## Goal

StockCount Pro should be installable on internal warehouse tablets from a LAN IP address, without Caddy or a public domain. The app should open like a standalone app from the tablet home screen while keeping the existing online counting workflow unchanged.

Success means:

- Tablet users can open `https://100.106.34.125:3443` and install StockCount Pro.
- Installed app starts at `/login` in standalone display mode.
- The app has a recognizable box-and-check icon.
- Login, document list, counting, review, printing, and Express push continue to require network access.
- If the app shell is opened while offline, users see a clear Thai offline page instead of a blank failure.

## Non-Goals

- No offline stock counting.
- No IndexedDB mutation queue.
- No background sync or conflict resolution.
- No push notifications.
- No Caddy, nginx, IIS, or public DNS requirement.
- No committing private certificate keys.

## HTTPS Architecture

Chrome and Android require a secure context for installable PWA behavior when not using `localhost`. Since this deployment uses an internal IP address, the app will run behind a custom Node HTTPS server.

```text
Tablet Chrome / Installed PWA
  -> https://100.106.34.125:3443
  -> server.mjs (Node HTTPS)
  -> Next.js request handler
  -> StockCount Pro
```

Implementation shape:

- Add `server.mjs` at the project root.
- `server.mjs` loads certificate files from `certs/`.
- The server prepares Next.js and delegates all requests to Next's request handler.
- Add `npm run start:https` to run production HTTPS after `npm run build`.
- Keep existing `npm run dev`, `npm run build`, and `npm run start` unchanged for normal debugging.

Certificate expectations:

- Certificate must include IP SAN for `100.106.34.125`.
- Certificate should also include `localhost` and `127.0.0.1` for local checks.
- Private key files under `certs/` must be ignored by git.
- Internal tablets must trust the certificate authority or certificate used by the server.

Recommended file names:

```text
certs/stockcountpro-key.pem
certs/stockcountpro-cert.pem
```

These file names are configurable through environment variables:

- `HTTPS_KEY_FILE`
- `HTTPS_CERT_FILE`
- `HTTPS_HOST`
- `HTTPS_PORT`

Default runtime values:

- host: `0.0.0.0`
- port: `3443`

## PWA Surface

### Manifest

Add `src/app/manifest.ts` using the Next App Router metadata route.

Manifest values:

- `name`: `StockCount Pro`
- `short_name`: `StockCount`
- `description`: Thai/English short description for internal stock counting
- `start_url`: `/login`
- `scope`: `/`
- `display`: `standalone`
- `orientation`: `portrait-primary`
- `lang`: `th`
- `theme_color`: app green
- `background_color`: light app background
- icons:
  - `/icons/icon-192.svg`
  - `/icons/icon-512.svg`
  - `/icons/maskable-icon.svg`

SVG icons are acceptable for the first internal rollout because the app is private. They should use a simple box-and-checkmark mark, readable at Android launcher size.

### Root Metadata

Update `src/app/layout.tsx` metadata:

- `manifest: "/manifest.webmanifest"` if needed by Next output, or rely on metadata route conventions.
- `applicationName: "StockCount Pro"`
- `appleWebApp` with title and capable mode.
- `themeColor` matching the manifest.
- Keep existing `viewportFit: "cover"` for tablet safe areas.

### Service Worker

Use a minimal hand-written service worker in `public/sw.js`.

Purpose:

- Make the app installable with a service worker.
- Precache only stable shell assets needed for the offline message:
  - `/~offline`
  - app icons
- For navigation requests, try network first. If the browser is offline or the network fails, return `/~offline`.
- Do not cache `/api/*`.
- Do not cache count document payloads or mutations.

This conservative service worker avoids stale operational data and preserves the current server-authoritative counting model.

### Service Worker Registration

Add a small client component, for example `src/components/PwaRegister.tsx`, rendered once in `RootLayout`.

Behavior:

- Register `/sw.js` only when `window.isSecureContext` is true and service workers are supported.
- Do not show a custom install prompt in this phase.
- Fail silently in HTTP development so normal local debugging is not noisy.

## Offline Page

Add `src/app/~offline/page.tsx`.

Content:

- Thai title: "ไม่มีการเชื่อมต่อ"
- Explain that StockCount Pro needs network access for login, locks, autosave, review, print, and Express push.
- Provide a retry button or link back to `/login`.

The page must not imply offline counting is available.

## Internal Tablet Setup

Add `docs/pwa-internal-https.md` covering:

1. Generate or place certificate files for IP `100.106.34.125`.
2. Put cert/key in `certs/` using the expected names.
3. Trust the certificate or internal CA on Android tablets.
4. Build and start:

```powershell
npm run build
npm run start:https
```

5. Open `https://100.106.34.125:3443/login`.
6. Install from Chrome menu or native install prompt.
7. Verify standalone launch from Home Screen.

## Security And Data Rules

- API routes remain network-only.
- Count saves still require server locks and online autosave.
- Login sessions remain cookie-based.
- HTTPS should allow secure cookies when the app detects secure protocol.
- Private cert/key files must never be committed.
- The service worker must not intercept or store sensitive API responses.

## Testing

Manual checks:

- `npm run build` succeeds.
- `npm run start:https` starts on port `3443`.
- Desktop Chrome can open `https://localhost:3443/login` when the cert is trusted.
- Tablet Chrome can open `https://100.106.34.125:3443/login` when the cert is trusted.
- Chrome DevTools Application panel shows:
  - Manifest is valid.
  - Icons are loaded.
  - Service worker is registered.
  - Installability passes.
- Installed app launches in standalone mode.
- Login and count save still work online.
- `/api/*` requests are not served from cache.
- Offline navigation shows `/~offline`.

## Open Operational Notes

- The exact certificate generation command depends on the internal Windows/tablet setup. The implementation should document mkcert and OpenSSL-compatible options, but not require Caddy.
- If tablets do not trust the certificate, Chrome will block installability even if the app code is correct.
