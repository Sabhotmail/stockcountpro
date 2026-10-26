import type { SyncStatus } from "@/types/count";

const STILL_SAVING_TOAST = "ยังบันทึกไม่เสร็จ กรุณารอแล้วกดสรุปอีกครั้ง";
const FAILED_TOAST = "บันทึกบางรายการไม่สำเร็จ กรุณากดบันทึกอีกครั้งก่อนส่งสรุป";

export function summaryFlushToast(input: {
  lineStatuses: SyncStatus[];
  noteFailed: boolean;
}): string | null {
  if (input.noteFailed || input.lineStatuses.some((status) => status === "failed")) {
    return FAILED_TOAST;
  }
  if (
    input.lineStatuses.some(
      (status) => status === "saving" || status === "waiting",
    )
  ) {
    return STILL_SAVING_TOAST;
  }
  return null;
}
