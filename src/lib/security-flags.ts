/**
 * Operator acknowledgement that the app runs over plain HTTP on a trusted
 * network (e.g. a Tailscale/WireGuard LAN where transport is already
 * encrypted). When set, the cleartext-HTTP / insecure-cookie warnings are
 * silenced — the underlying behaviour is unchanged.
 */
export function isInsecureHttpAcknowledged(): boolean {
  const flag = process.env.ACKNOWLEDGE_INSECURE_HTTP?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}
