export const USER_PRESENCE_TTL_MS = 5 * 60 * 1000;
export const USER_PRESENCE_HEARTBEAT_MS = 30_000;
export const ADMIN_PRESENCE_POLL_MS = 10_000;

export type PresencePathInfo = {
  pageLabel: string;
  documentId: string | null;
};

const EXACT_PAGE_LABELS: Record<string, string> = {
  "/admin/dashboard": "ภาพรวม",
  "/supervisor/dashboard": "ภาพรวม",
  "/admin/presence": "ผู้ที่กำลังใช้งาน",
  "/admin/documents": "เอกสาร",
  "/admin/users": "ผู้ใช้",
  "/admin/branches": "สาขา",
  "/admin/hubs": "ศูนย์กระจาย",
  "/admin/settings": "ตั้งค่า",
  "/admin/audit-logs": "บันทึกการใช้งาน",
  "/admin/sync": "ซิงค์ Express",
  "/admin/express-delete": "ลบรายการนับ Express",
  "/supervisor/express-delete": "ลบรายการนับ Express",
  "/supervisor/documents": "รออนุมัติ",
  "/tablet/documents": "รายการเอกสาร",
};

export function describePresencePath(path: string): PresencePathInfo {
  const pathname = path.split("?")[0] ?? path;

  const countSummary = /^\/tablet\/count\/([^/]+)\/summary$/.exec(pathname);
  if (countSummary) {
    return { pageLabel: "สรุปการนับ", documentId: countSummary[1] };
  }
  const countPage = /^\/tablet\/count\/([^/]+)$/.exec(pathname);
  if (countPage) {
    return { pageLabel: "นับสต็อก", documentId: countPage[1] };
  }
  const reviewPage = /^\/supervisor\/review\/([^/]+)$/.exec(pathname);
  if (reviewPage) {
    return { pageLabel: "ตรวจนับ", documentId: reviewPage[1] };
  }
  const adminDoc = /^\/admin\/documents\/([^/]+)$/.exec(pathname);
  if (adminDoc) {
    return { pageLabel: "เอกสาร", documentId: adminDoc[1] };
  }

  return {
    pageLabel: EXACT_PAGE_LABELS[pathname] ?? "กำลังใช้งานระบบ",
    documentId: null,
  };
}

export function composePresenceDetail(
  pageLabel: string,
  document: {
    locationCode: string | null;
    locationName: string | null;
    documentNo: string;
  } | null,
): string {
  if (!document) return pageLabel;
  const code = document.locationCode?.trim();
  const name = document.locationName?.trim();
  if (code && name) return `${pageLabel} · ${code} ${name}`;
  if (code) return `${pageLabel} · ${code}`;
  if (name) return `${pageLabel} · ${name}`;
  return `${pageLabel} · ${document.documentNo}`;
}

export function isPresenceActive(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() > now.getTime();
}
