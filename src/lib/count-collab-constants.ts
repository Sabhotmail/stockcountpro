export const DEFAULT_LINE_LOCK_TTL_SECONDS = 30;
export const LINE_LOCK_TTL_MS = DEFAULT_LINE_LOCK_TTL_SECONDS * 1000;
export const COUNT_POLL_INTERVAL_MS = 10_000;
/**
 * Renew active edit lock while a qty field stays focused.
 * Must stay below LINE_LOCK_TTL_MIN_SECONDS (5s) so short admin TTL settings
 * cannot expire mid-edit / mid-autosave.
 */
export const LOCK_HEARTBEAT_INTERVAL_MS = 2_000;

export const LINE_LOCK_TTL_MIN_SECONDS = 5;
export const LINE_LOCK_TTL_MAX_SECONDS = 600;
