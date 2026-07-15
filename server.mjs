import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import next from "next";
import { parse } from "node:url";

const hostname = process.env.HTTPS_HOST || "0.0.0.0";
const port = Number(process.env.HTTPS_PORT || 3443);
const keyFile =
  process.env.HTTPS_KEY_FILE || join("certs", "stockcountpro-key.pem");
const certFile =
  process.env.HTTPS_CERT_FILE || join("certs", "stockcountpro-cert.pem");

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  let key;
  let cert;

  try {
    key = readFileSync(keyFile);
    cert = readFileSync(certFile);
  } catch {
    console.error("Failed to read TLS certificate files:");
    console.error(`  key:  ${keyFile}`);
    console.error(`  cert: ${certFile}`);
    console.error(
      "Generate certificates before running start:https. See docs/pwa-internal-https.md",
    );
    process.exit(1);
  }

  createServer({ key, cert }, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, hostname, () => {
    const localHost = hostname === "0.0.0.0" ? "localhost" : hostname;
    console.log(`> StockCount Pro HTTPS ready on https://${localHost}:${port}`);
    console.log(`> LAN access: https://<server-ip>:${port}`);
  });
});
