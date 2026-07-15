import { DEFAULT_LINE_LOCK_TTL_SECONDS } from "@/lib/count-collab-constants";
import { getLineLockTtlMs } from "@/services/app-settings.service";

console.log(`Default LINE_LOCK_TTL = ${DEFAULT_LINE_LOCK_TTL_SECONDS}s (DB-backed at runtime)`);

getLineLockTtlMs().then((ms) => {
  console.log(`Current LINE_LOCK_TTL_MS from DB = ${ms} (${ms / 1000}s)`);
});

console.log(`
Manual two-user lock test checklist
===================================

Prerequisites:
- Two users (A and B) with count-mutate access to the same document
- A document with at least one product line

1. User A opens a line for editing
   - Call acquireOrRenewLineLock(sessionA, documentId, lineId)
   - Expect: returns LineLockInfo with lockedByUserId = A

2. User B tries to open the same line
   - Call acquireOrRenewLineLock(sessionB, documentId, lineId)
   - Expect: SaveLockError with message "รายการนี้กำลังถูกนับโดย {A's name}"

3. User A continues editing (lock renewal)
   - Call acquireOrRenewLineLock again within configured TTL
   - Expect: lock renewed, expiresAt extended

4. User A saves an entry
   - Call assertCallerHoldsActiveLock(sessionA, documentId, lineId)
   - Expect: { ok: true }
   - Expect: save does NOT renew expiresAt (renew only via acquire/heartbeat)

5. User A releases lock (navigates away / closes editor; tablet also releases after save when unfocused)
   - Call releaseLineLock(sessionA, documentId, lineId)
   - Expect: lock removed from DB

6. User B can now acquire
   - Call acquireOrRenewLineLock(sessionB, documentId, lineId)
   - Expect: returns LineLockInfo with lockedByUserId = B

7. Lock expiry (wait past configured TTL without renewal)
   - Do not call acquireOrRenewLineLock
   - Call assertCallerHoldsActiveLock(sessionB, documentId, lineId)
   - Expect: SaveLockError with message "การยึดรายการหมดอายุ กรุณาเริ่มนับรายการนี้ใหม่"

8. listActiveLocks
   - Call listActiveLocks(documentId) after expiry
   - Expect: expired lock not included in results
`);
