import { formatCountQtyCasePiece } from "@/lib/count-qty";
import { dateKeyToDmy } from "@/lib/datetime";
import { isEntryCounted } from "@/lib/unit-converter";
import { AuditAction, type AuditLog } from "@/types/audit";

type ProductLineRef = {
  productCode: string;
  productName: string;
  allowCase: boolean;
  allowPack: boolean;
  allowPiece: boolean;
  unitCaseName: string | null;
  unitPackName: string | null;
  unitPieceName: string | null;
};

type EntryRef = {
  qtyCase: number | null;
  qtyPack: number | null;
  qtyPiece: number | null;
};

export type AuditLogEnrichment = {
  lineById: Record<string, ProductLineRef>;
  versionNoById: Record<string, number>;
  entryByLineId: Record<string, EntryRef>;
  documentNoById: Record<string, string>;
  totalLinesByDocumentId: Record<string, number>;
};

function versionLabel(
  versionId: string | undefined,
  enrichment: AuditLogEnrichment,
): string | null {
  if (!versionId) return null;
  const no = enrichment.versionNoById[versionId];
  return no != null ? `V${no}` : null;
}

function lineLabel(
  lineId: string | undefined,
  enrichment: AuditLogEnrichment,
): string | null {
  if (!lineId) return null;
  const line = enrichment.lineById[lineId];
  if (!line) return null;
  return `${line.productCode} · ${line.productName}`;
}

function entryQtyLabel(
  lineId: string | undefined,
  line: ProductLineRef | undefined,
  entry: EntryRef | undefined,
): string | null {
  if (!line || !entry) return null;
  const counted = isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece);
  const qty = formatCountQtyCasePiece({
    qtyCase: entry.qtyCase,
    qtyPack: entry.qtyPack,
    qtyPiece: entry.qtyPiece,
    allowCase: line.allowCase,
    allowPack: line.allowPack,
    allowPiece: line.allowPiece,
    unitCaseName: line.unitCaseName,
    unitPackName: line.unitPackName,
    unitPieceName: line.unitPieceName,
    isCounted: counted,
  });
  return qty === "—" ? null : qty;
}

function humanizeExpressSyncDetail(detail: string): string {
  const parts = detail.split(";").map((part) => part.trim());
  const values: Record<string, string> = {};
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (!key || rest.length === 0) continue;
    values[key.trim()] = rest.join("=").trim();
  }

  const chunks: string[] = [];
  if (values.date) {
    chunks.push(`วันที่ ${dateKeyToDmy(values.date) || values.date}`);
  }
  if (values.lines) chunks.push(`${values.lines} รายการจาก Express`);
  if (values.created) chunks.push(`สร้าง ${values.created}`);
  if (values.updated) chunks.push(`อัปเดต ${values.updated}`);
  if (values.skipped) chunks.push(`ข้าม ${values.skipped}`);
  if (values.locations) chunks.push(`คลัง ${values.locations.replace(/,/g, ", ")}`);

  return chunks.length > 0 ? chunks.join(" · ") : detail;
}

function humanizeStoredDetail(detail: string, action: AuditAction): string {
  const trimmed = detail.trim();
  if (action === AuditAction.IMPORT_FROM_EXPRESS && trimmed.includes("=")) {
    return humanizeExpressSyncDetail(trimmed);
  }
  if (action === AuditAction.CREATE_VERSION) {
    const match = /Created version (\d+) from/.exec(trimmed);
    if (match) return `สร้างเวอร์ชัน V${match[1]}`;
  }
  if (action === AuditAction.REQUEST_RECOUNT) {
    const match = /Full-document recount \((\d+) lines\): (.+)/.exec(trimmed);
    if (match) return `ขอนับใหม่ ${match[1]} รายการ · ${match[2]}`;
  }
  if (trimmed === "Mock login") return "เข้าสู่ระบบ";
  return trimmed;
}

export function deriveAuditLogDetail(
  log: AuditLog,
  enrichment: AuditLogEnrichment,
): string | null {
  const version = versionLabel(log.versionId, enrichment);
  const line = lineLabel(log.lineId, enrichment);
  const productLine = log.lineId ? enrichment.lineById[log.lineId] : undefined;
  const entry = log.lineId ? enrichment.entryByLineId[log.lineId] : undefined;
  const qty = entryQtyLabel(log.lineId, productLine, entry);
  const documentNo = log.documentId
    ? enrichment.documentNoById[log.documentId]
    : undefined;

  switch (log.action) {
    case AuditAction.START_COUNT:
      return version ? `เริ่มนับ · ${version}` : "เริ่มนับ";
    case AuditAction.AUTO_SAVE_COUNT: {
      if (line && qty) return `${line} → ${qty}`;
      if (line) return line;
      return log.lineId ? `รายการ ${log.lineId}` : null;
    }
    case AuditAction.SUBMIT_TO_SUPERVISOR:
      return version ? `ส่ง ${version} ให้หัวหน้างาน` : "ส่งให้หัวหน้างาน";
    case AuditAction.APPROVE_VERSION:
      return version ? `อนุมัติ ${version}` : "อนุมัติ";
    case AuditAction.COMPLETE_DOCUMENT:
      return documentNo ? `ปิดเอกสาร ${documentNo}` : "ปิดเอกสาร";
    case AuditAction.LOGIN:
      return "เข้าสู่ระบบ";
    case AuditAction.OPEN_DOCUMENT:
      return documentNo ? `เปิด ${documentNo}` : null;
    case AuditAction.DELETE_DOCUMENT:
      return null;
    case AuditAction.PUSH_TO_EXPRESS:
      return null;
    default:
      return null;
  }
}

export function formatAuditLogDetail(
  log: AuditLog,
  enrichment: AuditLogEnrichment,
): string {
  if (log.detail?.trim()) {
    return humanizeStoredDetail(log.detail, log.action);
  }

  return deriveAuditLogDetail(log, enrichment) ?? "—";
}

export function buildAutoSaveDetail(
  line: ProductLineRef,
  entry: EntryRef,
): string {
  const counted = isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece);
  const qty = formatCountQtyCasePiece({
    qtyCase: entry.qtyCase,
    qtyPack: entry.qtyPack,
    qtyPiece: entry.qtyPiece,
    allowCase: line.allowCase,
    allowPack: line.allowPack,
    allowPiece: line.allowPiece,
    unitCaseName: line.unitCaseName,
    unitPackName: line.unitPackName,
    unitPieceName: line.unitPieceName,
    isCounted: counted,
  });

  return `${line.productCode} · ${qty}`;
}
