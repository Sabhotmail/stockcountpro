import type { RecountRequestRecord } from "@/types/count";

export const initialRecountRequests: RecountRequestRecord[] = [
  {
    id: "recount_001",
    documentId: "doc_bkk1_004",
    baseVersionId: "ver_bkk1_004_v1",
    newVersionId: "ver_bkk1_004_v2",
    items: [
      {
        lineId: "doc_bkk1_004_line_002",
        reason: "จำนวนผิดปกติ",
      },
      {
        lineId: "doc_bkk1_004_line_005",
        reason: "สินค้าจัดวางผิดตำแหน่ง",
      },
    ],
    requestedBy: "user_bkk1_supervisor",
    requestedAt: "2026-07-08T11:30:00.000Z",
  },
];
