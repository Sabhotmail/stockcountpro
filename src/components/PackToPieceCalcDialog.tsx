"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isQtyFieldCounted } from "@/lib/count-qty";
import {
  calculatePackToPiece,
  parsePiecesPerPackFromProductName,
} from "@/lib/pack-to-piece";

interface PackToPieceCalcDialogProps {
  open: boolean;
  productCode: string;
  productName: string;
  pieceUnitLabel: string;
  /** Current piece field value; when already counted, show replace + add. */
  existingPieceQty: number | null;
  onApply: (totalPieces: number) => void;
  onCancel: () => void;
}

function parseNonNegIntDraft(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export function PackToPieceCalcDialog({
  open,
  productCode,
  productName,
  pieceUnitLabel,
  existingPieceQty,
  onApply,
  onCancel,
}: PackToPieceCalcDialogProps) {
  const [packsDraft, setPacksDraft] = useState("");
  const [perPackDraft, setPerPackDraft] = useState("");

  useEffect(() => {
    if (open) {
      setPacksDraft("");
      const inferred = parsePiecesPerPackFromProductName(productName);
      setPerPackDraft(inferred !== null ? String(inferred) : "");
    }
  }, [open, productName]);

  const packs = parseNonNegIntDraft(packsDraft);
  const piecesPerPack = parseNonNegIntDraft(perPackDraft);
  const total =
    packs !== null && piecesPerPack !== null
      ? calculatePackToPiece(packs, piecesPerPack)
      : null;

  const hasExisting = isQtyFieldCounted(existingPieceQty);
  const existing = hasExisting ? (existingPieceQty as number) : null;
  const addedTotal =
    total !== null && existing !== null ? existing + total : null;

  const preview =
    total !== null && packs !== null && piecesPerPack !== null
      ? hasExisting && existing !== null && addedTotal !== null
        ? `${packs} แพ๊ค × ${piecesPerPack} ${pieceUnitLabel}/แพ๊ค = ${total} ${pieceUnitLabel} · ปัจจุบัน ${existing} → แทนที่ ${total} / บวกเพิ่ม ${addedTotal}`
        : `${packs} แพ๊ค × ${piecesPerPack} ${pieceUnitLabel}/แพ๊ค = ${total} ${pieceUnitLabel}`
      : `กรอกจำนวนแพ๊คและ${pieceUnitLabel}ต่อแพ๊ค`;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>แปลงแพ๊คเป็นชิ้น</DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">{productCode}</span>{" "}
            {productName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="pack-to-piece-packs">จำนวนแพ๊ค</Label>
            <Input
              id="pack-to-piece-packs"
              inputMode="numeric"
              autoFocus
              value={packsDraft}
              onChange={(event) => {
                const next = event.target.value;
                if (next === "" || /^\d*$/.test(next)) {
                  setPacksDraft(next);
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pack-to-piece-per-pack">
              {pieceUnitLabel}ต่อแพ๊ค
            </Label>
            <Input
              id="pack-to-piece-per-pack"
              inputMode="numeric"
              value={perPackDraft}
              onChange={(event) => {
                const next = event.target.value;
                if (next === "" || /^\d*$/.test(next)) {
                  setPerPackDraft(next);
                }
              }}
            />
          </div>
          <p
            className={
              total !== null
                ? "rounded-lg bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900"
                : "rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500"
            }
          >
            {preview}
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            ยกเลิก
          </Button>
          {hasExisting ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={total === null}
                onClick={() => {
                  if (total === null) return;
                  onApply(total);
                }}
              >
                แทนที่
              </Button>
              <Button
                type="button"
                disabled={addedTotal === null}
                onClick={() => {
                  if (addedTotal === null) return;
                  onApply(addedTotal);
                }}
              >
                บวกเพิ่ม
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={total === null}
              onClick={() => {
                if (total === null) return;
                onApply(total);
              }}
            >
              ใส่ช่องชิ้น
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
