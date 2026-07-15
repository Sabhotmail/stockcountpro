# PWA Internal HTTPS Setup

StockCount Pro can be installed on Android tablets as a PWA over HTTPS on your internal LAN. No public domain or reverse proxy is required.

The server IP is chosen at deployment time. Application code does not hardcode any IP.

## Prerequisites

- Node.js with a production build (`npm run build`)
- A TLS certificate that includes your server IP
- Tablets must trust the certificate or internal CA

## 1. Choose the server IP

Find the LAN IP of the machine running StockCount Pro:

```powershell
ipconfig
```

Use that address as `<server-ip>` in the steps below. Example: `192.168.1.50`.

If the IP changes later, regenerate the certificate with the new IP and restart the server. No code changes are needed.

## 2. Generate certificates

Place files in `certs/`:

```text
certs/stockcountpro-key.pem
certs/stockcountpro-cert.pem
```

### Option A: mkcert (recommended on Windows)

Install [mkcert](https://github.com/FiloSottile/mkcert), then:

```powershell
mkcert -install
mkcert -key-file certs/stockcountpro-key.pem -cert-file certs/stockcountpro-cert.pem localhost 127.0.0.1 <server-ip>
```

To support multiple candidate IPs on one certificate, list them all:

```powershell
mkcert -key-file certs/stockcountpro-key.pem -cert-file certs/stockcountpro-cert.pem localhost 127.0.0.1 192.168.1.50 192.168.1.51
```

### Option B: OpenSSL

Create an OpenSSL config with IP SANs, then generate a self-signed certificate. Trust the certificate or your internal CA on each tablet.

## 3. Trust the certificate on tablets

Android Chrome will not allow PWA install until the certificate is trusted.

- If using mkcert: install the mkcert root CA on each tablet, or distribute it through your MDM.
- If using a self-signed cert: install the `.pem` as a trusted credential on the device.

## 4. Build and start HTTPS server

```powershell
npm run build
npm run start:https
```

Default bind:

- Host: `0.0.0.0` (all interfaces)
- Port: `3443`

Override with environment variables:

| Variable | Default |
|----------|---------|
| `HTTPS_HOST` | `0.0.0.0` |
| `HTTPS_PORT` | `3443` |
| `HTTPS_KEY_FILE` | `certs/stockcountpro-key.pem` |
| `HTTPS_CERT_FILE` | `certs/stockcountpro-cert.pem` |

Example:

```powershell
$env:HTTPS_PORT = "3443"
npm run start:https
```

## 5. Open and install on tablet

1. On the tablet, open Chrome and go to `https://<server-ip>:3443/login`
2. Accept the certificate warning only if the cert is not yet trusted
3. Log in and confirm counting works online
4. Install from Chrome menu → **Add to Home screen** / **Install app**
5. Launch from Home Screen and confirm standalone mode

## 6. Verify PWA (Chrome DevTools)

On desktop or remote debugging:

- **Application → Manifest**: valid manifest, icons loaded
- **Application → Service Workers**: `/sw.js` registered
- **Lighthouse / Installability**: passes when cert is trusted

## Offline behavior

The service worker does **not** enable offline counting. If the network is unavailable, navigation shows `/~offline` with a Thai message and retry option.

API routes (`/api/*`) are never cached.

## Changing the server IP later

1. Regenerate the certificate with the new `<server-ip>` (and keep `localhost` / `127.0.0.1` for local checks)
2. Replace files in `certs/`
3. Restart `npm run start:https`
4. Re-trust the certificate on tablets if the CA changed
5. Tablets already installed may need to open the new URL once; the app uses relative `start_url` (`/login`)

No application code changes are required.

## Normal development

Use the existing HTTP workflow:

```powershell
npm run dev
```

Service worker registration is skipped on non-secure HTTP, so local debugging stays quiet.
