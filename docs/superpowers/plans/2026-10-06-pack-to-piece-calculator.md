# Pack→Piece Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้ใช้นับบนแท็บเล็ตเปิดเครื่องคิดเลขข้างช่องชิ้น กรอกจำนวนแพ๊คและชิ้น/แพ๊ค แล้วใส่ผลรวมทับช่องชิ้น

**Architecture:** Pure helper คูณแพ๊ค×ชิ้น/แพ๊ค + Dialog ใหม่ตาม pattern ของ `CountQtyConfirmDialog` ผูกเข้า `ProductCard` แล้วเรียก `onQtyChange("qtyPiece", total)` เพื่อใช้ path บันทึกเดิม

**Tech Stack:** Next.js client components, shadcn Dialog/Button/Input, node assert unit tests in `src/lib/*.test.ts`

**Spec:** [docs/superpowers/specs/2026-10-06-pack-to-piece-calculator-design.html](../specs/2026-10-06-pack-to-piece-calculator-design.html)

## Global Constraints

- Manual pack + pieces-per-pack every time (no master data, no remember)
- Button beside piece field only
- Apply **replaces** `qtyPiece`
- Do not enable Express pack fields / sync changes
- Thai UI copy

---

## Task 1: Pure math helper

**Files:**
- Create `src/lib/pack-to-piece.ts`
- Create `src/lib/pack-to-piece.test.ts`

- [ ] Write failing tests: 5×12=60, 0×12=0, invalid → null
- [ ] Implement `calculatePackToPiece(packs, piecesPerPack): number | null`
- [ ] Run test: `npx tsx --test src/lib/pack-to-piece.test.ts` (or project test script)

---

## Task 2: Dialog component

**Files:**
- Create `src/components/PackToPieceCalcDialog.tsx`

- [ ] Dialog with packs + piecesPerPack inputs, live preview, Apply/Cancel
- [ ] Disable Apply until helper returns non-null
- [ ] Thai copy: แปลงแพ๊คเป็นชิ้น / ใส่ช่องชิ้น / ยกเลิก

---

## Task 3: Wire ProductCard

**Files:**
- Modify `src/components/ProductCard.tsx`

- [ ] Calc button beside piece QtyInput when `allowPiece` and not disabled
- [ ] Open dialog; on open call `onEditStart`
- [ ] On apply → `onQtyChange("qtyPiece", total)` and close
- [ ] Keep button inside `qtyAreaRef`

---

## Task 4: Verify & ship

- [ ] Run unit tests + typecheck
- [ ] Manual checklist from design HTML
- [ ] Commit and push
