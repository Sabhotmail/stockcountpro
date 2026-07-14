import { getDocumentForSession } from "@/lib/document-access";
import {
  getFinalCountEntries,
  resolveEffectiveEntries,
} from "@/lib/entry-snapshot";
import { todayDateKeyBangkok } from "@/lib/datetime";
import { canPushToExpress } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  calculateTotalBaseQty,
  isEntryCounted,
} from "@/lib/unit-converter";
import { effectiveQtyForTotal } from "@/lib/count-qty";
import { mapProductLine } from "@/lib/db/mappers";
import { logPushToExpress } from "@/services/audit-log.service";
import {
  putExpressCountByLocation,
  type ExpressPushCountDetail,
} from "@/services/express-api.service";
import { getUserById } from "@/services/user.service";
import { DocumentStatus } from "@/types/count";
import type { MockSession } from "@/types/user";

const EXPRESS_COUNT_FLAG = "3";
const EXPRESS_USER_ID_MAX_LEN = 8;

export type PushExpressResult =
  | {
      success: true;
      locationCode: string;
      countDate: string;
      lineCount: number;
      userIdSent: string;
    }
  | { error: string; status: 400 | 403 | 404 };

function toExpressUserId(username: string): string {
  return username.trim().slice(0, EXPRESS_USER_ID_MAX_LEN);
}

export async function pushDocumentToExpress(
  session: MockSession,
  documentId: string,
): Promise<PushExpressResult> {
  if (!canPushToExpress(session.role)) {
    return { error: "Access denied", status: 403 };
  }

  const access = await getDocumentForSession(session, documentId);
  if (!access.ok) {
    return { error: access.error, status: access.status };
  }

  const doc = access.document;
  if (doc.status !== DocumentStatus.COMPLETED) {
    return {
      error: "ส่งกลับ Express ได้เฉพาะเอกสารที่เสร็จสิ้นแล้ว",
      status: 400,
    };
  }

  const locationCode = doc.locationCode?.trim().toUpperCase() ?? "";
  if (!locationCode) {
    return { error: "เอกสารนี้ไม่มีรหัสคลัง Express", status: 400 };
  }

  const countDate = doc.documentDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(countDate)) {
    return { error: "วันที่เอกสารไม่ถูกต้อง", status: 400 };
  }

  const user = await getUserById(session.userId);
  if (!user?.username) {
    return { error: "ไม่พบ username สำหรับส่ง Express", status: 400 };
  }
  const userIdSent = toExpressUserId(user.username);
  if (!userIdSent) {
    return { error: "username ว่าง — ส่ง Express ไม่ได้", status: 400 };
  }

  const productLines = (
    await prisma.productLine.findMany({
      where: { documentId },
      orderBy: { lineNo: "asc" },
    })
  ).map(mapProductLine);

  let entries = await getFinalCountEntries(documentId);
  if (entries.length === 0 && doc.currentVersionId) {
    entries = await resolveEffectiveEntries(documentId, doc.currentVersionId);
  }
  const entryByLine = new Map(entries.map((e) => [e.lineId, e]));

  const changedDate = todayDateKeyBangkok();
  const details: ExpressPushCountDetail[] = [];

  for (const line of productLines) {
    const entry = entryByLine.get(line.lineId);
    if (!entry) continue;
    if (!isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece)) continue;

    const physical =
      entry.totalBaseQty ??
      calculateTotalBaseQty(
        line,
        entry.qtyCase,
        entry.qtyPack,
        entry.qtyPiece,
      ) ??
      0;

    details.push({
      LocationCode: locationCode,
      ProductCode: line.productCode,
      CountDate: countDate,
      CaseQty: effectiveQtyForTotal(entry.qtyCase),
      PieceQty: effectiveQtyForTotal(entry.qtyPiece),
      PhysicalBalance: physical,
      CountFlag: EXPRESS_COUNT_FLAG,
      UserID: userIdSent,
      ChangedDate: changedDate,
    });
  }

  if (details.length === 0) {
    return {
      error: "ไม่มีรายการที่นับแล้วให้ส่งกลับ Express",
      status: 400,
    };
  }

  const pushResult = await putExpressCountByLocation(
    countDate,
    locationCode,
    details,
  );

  if ("error" in pushResult) {
    await logPushToExpress(
      session.userId,
      session.userName,
      doc.branchId,
      documentId,
      `failed; location=${locationCode}; date=${countDate}; lines=${details.length}; userId=${userIdSent}; error=${pushResult.error}`,
    );
    return { error: pushResult.error, status: 400 };
  }

  await logPushToExpress(
    session.userId,
    session.userName,
    doc.branchId,
    documentId,
    `ok; location=${locationCode}; date=${countDate}; lines=${details.length}; userId=${userIdSent}`,
  );

  return {
    success: true,
    locationCode,
    countDate,
    lineCount: details.length,
    userIdSent,
  };
}
