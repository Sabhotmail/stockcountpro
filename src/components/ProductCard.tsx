"use client";

import { useCallback, useRef, type FocusEvent, type MouseEvent } from "react";
import type { CountEntry, ProductLine, SyncStatus } from "@/types/count";
import { ProductImage } from "@/components/ProductImage";
import { QtyInput } from "@/components/QtyInput";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { calculateTotalBaseQty, isEntryCounted } from "@/lib/unit-converter";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  line: ProductLine;
  entry: CountEntry | undefined;
  syncStatus: SyncStatus;
  disabled?: boolean;
  lockHeldByOther?: string | null;
  conflictMessage?: string | null;
  onAcceptServer?: () => void;
  onQtyChange: (
    field: "qtyCase" | "qtyPack" | "qtyPiece",
    value: number | null,
  ) => void;
  onEditStart?: () => void;
  /** Fired when focus leaves all qty inputs on this card (not when tabbing between them). */
  onEditEnd?: () => void;
  /** True while this card is the one currently being counted. */
  active?: boolean;
}

function normalizeUnitLabel(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  if (!value) return fallback;

  // Express sometimes sends unit codes (e.g. CT/EA/PCS) instead of Thai unit names.
  // If it doesn't contain Thai characters, show a friendly Thai fallback.
  if (!/[ก-๙]/.test(value)) return fallback;
  return value;
}

function getConversionNotes(line: ProductLine, pieceUnitLabel: string): string[] {
  const notes: string[] = [];

  if (line.allowCase && line.caseRatio > 1) {
    notes.push(
      `(${line.caseRatio} ${pieceUnitLabel} = 1 ${line.unitCaseName ?? "ลัง"})`,
    );
  }

  if (line.allowPack && line.packRatio > 1) {
    notes.push(
      `(${line.packRatio} ${pieceUnitLabel} = 1 ${line.unitPackName ?? "แพ็ค"})`,
    );
  }

  return notes;
}

export function ProductCard({
  line,
  entry,
  syncStatus,
  disabled,
  lockHeldByOther,
  conflictMessage,
  onAcceptServer,
  onQtyChange,
  onEditStart,
  onEditEnd,
  active = false,
}: ProductCardProps) {
  const qtyAreaRef = useRef<HTMLDivElement>(null);
  const counted = entry
    ? isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece)
    : false;
  const pieceUnitLabel = normalizeUnitLabel(line.unitPieceName, "ชิ้น");
  const conversionNotes = getConversionNotes(line, pieceUnitLabel);
  const totalBaseQty = entry
    ? calculateTotalBaseQty(
        { caseRatio: line.caseRatio, packRatio: line.packRatio },
        entry.qtyCase,
        entry.qtyPack,
        entry.qtyPiece,
      )
    : null;

  const handleQtyBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const next = event.relatedTarget;
      if (next instanceof Node && qtyAreaRef.current?.contains(next)) {
        // Still editing this line (e.g. Case → Piece) — keep the lock.
        return;
      }

      // Mobile browsers often leave relatedTarget null when tapping another input.
      // Defer and re-check where focus landed.
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active && qtyAreaRef.current?.contains(active)) return;
        onEditEnd?.();
      });
    },
    [onEditEnd],
  );

  const handleCardClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("input, button, textarea")) return;
      qtyAreaRef.current?.querySelector("input")?.focus();
    },
    [disabled],
  );

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "rounded-xl border p-4 shadow-sm transition-colors duration-150",
        !disabled && "cursor-pointer",
        counted ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50/40",
        active
          ? "border-sky-400 bg-sky-50 ring-2 ring-sky-200"
          : "focus-within:border-sky-400 focus-within:bg-sky-50 focus-within:ring-2 focus-within:ring-sky-200",
      )}
    >
      {lockHeldByOther && (
        <div className="mb-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
          กำลังนับโดย {lockHeldByOther}
        </div>
      )}

      {conflictMessage && (
        <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{conflictMessage}</p>
          {onAcceptServer && (
            <button
              type="button"
              onClick={onAcceptServer}
              className="mt-2 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white"
            >
              ใช้ข้อมูลของระบบ
            </button>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <ProductImage
          src={line.productImageUrl}
          productCode={line.productCode}
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

          <div
            ref={qtyAreaRef}
            className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"
          >
            <span className="text-sm font-medium text-slate-600">จำนวน</span>
            {line.allowCase && (
              <QtyInput
                compact
                label={line.unitCaseName ?? "ลัง"}
                value={entry?.qtyCase ?? null}
                disabled={disabled}
                onFocus={onEditStart}
                onBlur={handleQtyBlur}
                onChange={(value) => onQtyChange("qtyCase", value)}
              />
            )}
            {line.allowPack && (
              <QtyInput
                compact
                label={line.unitPackName ?? "แพ็ค"}
                value={entry?.qtyPack ?? null}
                disabled={disabled}
                onFocus={onEditStart}
                onBlur={handleQtyBlur}
                onChange={(value) => onQtyChange("qtyPack", value)}
              />
            )}
            {line.allowPiece && (
              <QtyInput
                compact
                label={pieceUnitLabel}
                value={entry?.qtyPiece ?? null}
                disabled={disabled}
                onFocus={onEditStart}
                onBlur={handleQtyBlur}
                onChange={(value) => onQtyChange("qtyPiece", value)}
              />
            )}
          </div>

          {counted && (
            <>
              <p className="mt-2 text-xs text-slate-500">
                รวม ({pieceUnitLabel}): {totalBaseQty ?? "—"}
              </p>
              {entry?.updatedByName && (
                <p className="mt-1 text-xs text-slate-400">
                  บันทึกโดย {entry.updatedByName}
                </p>
              )}
            </>
          )}

          {conversionNotes.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {conversionNotes.join(" · ")} · กรอกชิ้นครบลังแล้วระบบจะแปลงให้เอง
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
