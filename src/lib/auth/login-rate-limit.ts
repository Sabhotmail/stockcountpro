const USER_LIMIT = 5;
const IP_LIMIT = 20;
const WINDOW_MS = 60_000;

type Bucket = { count: number; resetAt: number };

const byUser = new Map<string, Bucket>();
const byIp = new Map<string, Bucket>();

function touch(map: Map<string, Bucket>, key: string, limit: number): boolean {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur || cur.resetAt <= now) {
    map.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return true;
  }
  return cur.count < limit;
}

function incr(map: Map<string, Bucket>, key: string): void {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur || cur.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  cur.count += 1;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export function assertLoginAllowed(
  ip: string,
  username: string,
): { ok: true } | { ok: false } {
  const userKey = username.trim().toLowerCase();
  if (!touch(byUser, userKey, USER_LIMIT)) return { ok: false };
  if (!touch(byIp, ip, IP_LIMIT)) return { ok: false };
  return { ok: true };
}

export function recordLoginFailure(ip: string, username: string): void {
  incr(byUser, username.trim().toLowerCase());
  incr(byIp, ip);
}

export function clearLoginFailuresForUsername(username: string): void {
  byUser.delete(username.trim().toLowerCase());
}

export function resetLoginRateLimitForTests(): void {
  byUser.clear();
  byIp.clear();
}
