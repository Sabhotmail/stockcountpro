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
import { calculatePackToPiece } from "@/lib/pack-to-piece";

interface PackToPieceCalcDialogProps {
  open: boolean;
  productCode: string;
  productName: string;
  pieceUnitLabel: string;
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
  onApply,
  onCancel,
}: PackToPieceCalcDialogProps) {
  const [packsDraft, setPacksDraft] = useState("");
  const [perPackDraft, setPerPackDraft] = useState("");

  useEffect(() => {
    if (open) {
      setPacksDraft("");
      setPerPackDraft("");
    }
  }, [open]);

  const packs = parseNonNegIntDraft(packsDraft);
  const piecesPerPack = parseNonNegIntDraft(perPackDraft);
  const total =
    packs !== null && piecesPerPack !== null
      ? calculatePackToPiece(packs, piecesPerPack)
      : null;

  const preview =
    total !== null && packs !== null && piecesPerPack !== null
      ? `${packs} แพ๊ค × ${piecesPerPack} ${pieceUnitLabel}/แพ๊ค = ${total} ${pieceUnitLabel}`
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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onCancel}>
            ยกเลิก
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
