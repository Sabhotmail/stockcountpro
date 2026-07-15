const THAI_RESOURCE_NOT_FOUND = [
  "ไม่พบเอกสาร",
  "ไม่พบเวอร์ชัน",
  "ไม่พบรายการ",
] as const;

function isResourceNotFound(error: string): boolean {
  if (error.toLowerCase().includes("not found")) return true;
  return THAI_RESOURCE_NOT_FOUND.some((pattern) => error.includes(pattern));
}

export function httpStatusForServiceError(
  error: string,
): 400 | 403 | 404 | 409 {
  if (error === "CONFLICT") return 409;
  if (error.includes("Access denied") || error.includes("ไม่มีสิทธิ์")) {
    return 403;
  }
  if (isResourceNotFound(error)) {
    return 404;
  }
  return 400;
}
