export function httpStatusForServiceError(
  error: string,
): 400 | 403 | 404 | 409 {
  if (error === "CONFLICT") return 409;
  if (error.includes("Access denied") || error.includes("ไม่มีสิทธิ์")) {
    return 403;
  }
  if (error.toLowerCase().includes("not found") || error.includes("ไม่พบ")) {
    return 404;
  }
  return 400;
}
