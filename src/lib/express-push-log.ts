/** Verbose Express push logging (full payload + response body). */
export function isExpressPushDebug(): boolean {
  const v = process.env.EXPRESS_PUSH_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function logExpressPush(
  message: string,
  data?: Record<string, unknown>,
): void {
  const prefix = "[Express push]";
  if (data === undefined) {
    console.log(prefix, message);
    return;
  }
  console.log(prefix, message, JSON.stringify(data, null, 2));
}
