"use client";

import type { CountEntry, ProductLine, SyncStatus } from "@/types/count";
import { ProductImage } from "@/components/ProductImage";
import { QtyInput } from "@/components/QtyInput";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { calculateTotalBaseQty, isEntryCounted } from "@/lib/unit-converter";

interface ProductCardProps {
  line: ProductLine;
  entry: CountEntry | undefined;
  syncStatus: SyncStatus;
  disabled?: boolean;
  onQtyChange: (
    field: "qtyCase" | "qtyPack" | "qtyPiece",
    value: number | null,
  ) => void;
}

function getConversionNotes(line: ProductLine): string[] {
  const notes: string[] = [];

  if (line.allowCase && line.caseRatio > 1) {
    notes.push(
      `(${line.caseRatio} ${line.unitPieceName} = 1 ${line.unitCaseName ?? "ลัง"})`,
    );
  }

  if (line.allowPack && line.packRatio > 1) {
    notes.push(
      `(${line.packRatio} ${line.unitPieceName} = 1 ${line.unitPackName ?? "แพ็ค"})`,
    );
  }

  return notes;
}

export function ProductCard({
  line,
  entry,
  syncStatus,
  disabled,
  onQtyChange,
}: ProductCardProps) {
  const counted = entry
    ? isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece)
    : false;
  const conversionNotes = getConversionNotes(line);
  const totalBaseQty = entry
    ? calculateTotalBaseQty(
        { caseRatio: line.caseRatio, packRatio: line.packRatio },
        entry.qtyCase,
        entry.qtyPack,
        entry.qtyPiece,
      )
    : null;

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        counted ? "border-slate-200" : "border-amber-200 bg-amber-50/30"
      }`}
    >
      <div className="flex gap-4">
        <ProductImage
          src={line.productImageUrl}
          alt={line.productName}
          compact
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="text-sm text-slate-500">
                  <span className="font-medium text-slate-600">รหัส</span>{" "}
                  <span className="font-semibold text-slate-900">
                    {line.productCode}
                  </span>
                </p>
                <p className="min-w-0 text-sm text-slate-500">
                  <span className="font-medium text-slate-600">ชื่อ</span>{" "}
                  <span className="font-semibold text-slate-900">
                    {line.productName}
                  </span>
                </p>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                รายการที่ {line.lineNo}
              </p>
            </div>
            <SyncStatusBadge status={syncStatus} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-sm font-medium text-slate-600">จำนวน</span>
            {line.allowCase && (
              <QtyInput
                compact
                label={line.unitCaseName ?? "ลัง"}
                value={entry?.qtyCase ?? null}
                disabled={disabled}
                onChange={(value) => onQtyChange("qtyCase", value)}
              />
            )}
            {line.allowPack && (
              <QtyInput
                compact
                label={line.unitPackName ?? "แพ็ค"}
                value={entry?.qtyPack ?? null}
                disabled={disabled}
                onChange={(value) => onQtyChange("qtyPack", value)}
              />
            )}
            {line.allowPiece && (
              <QtyInput
                compact
                label={line.unitPieceName}
                value={entry?.qtyPiece ?? null}
                disabled={disabled}
                onChange={(value) => onQtyChange("qtyPiece", value)}
              />
            )}
          </div>

          {counted && (
            <p className="mt-2 text-xs text-slate-500">
              รวม ({line.unitPieceName}): {totalBaseQty ?? "—"}
            </p>
          )}

          {conversionNotes.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {conversionNotes.join(" · ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
