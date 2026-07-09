"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountToast, type CountToastItem } from "@/components/CountToast";
import { ProductCard } from "@/components/ProductCard";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { COUNT_POLL_INTERVAL_MS } from "@/lib/count-collab-constants";
import {
  convertPieceOverflowToCase,
  isEntryCounted,
} from "@/lib/unit-converter";
import {
  type CountDocumentWithLocksResponse,
  DocumentStatus,
  type LineLockInfo,
  type SaveEntryErrorResponse,
  VersionStatus,
  type CountDocumentDetail,
  type CountEntry,
  type ProductLine,
  type SyncStatus,
} from "@/types/count";

const AUTO_SAVE_DELAY_MS = 1000;

export default function TabletCountPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const [document, setDocument] = useState<CountDocumentDetail | null>(null);
  const [documentNote, setDocumentNote] = useState("");
  const [entries, setEntries] = useState<Record<string, CountEntry>>({});
  const [syncStatusByLine, setSyncStatusByLine] = useState<
    Record<string, SyncStatus>
  >({});
  const [noteSyncStatus, setNoteSyncStatus] = useState<SyncStatus>("idle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeFilter, setCodeFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [showUncountedOnly, setShowUncountedOnly] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [locks, setLocks] = useState<Record<string, LineLockInfo>>({});
  const [conflictByLine, setConflictByLine] = useState<Record<string, string>>(
    {},
  );
  const [serverEntryByLine, setServerEntryByLine] = useState<
    Record<string, CountEntry>
  >({});
  const [toasts, setToasts] = useState<CountToastItem[]>([]);

  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const pendingSavesRef = useRef<
    Record<string, Record<string, unknown>>
  >({});
  const noteSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyLinesRef = useRef(new Set<string>());
  const notifiedRevisionsRef = useRef(new Set<string>());
  const entriesRef = useRef<Record<string, CountEntry>>({});
  const syncStatusByLineRef = useRef<Record<string, SyncStatus>>({});
  const scrollYRef = useRef(0);

  const pushToast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setToasts((prev) => [...prev, { id, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const lines = document?.lines ?? [];
  const versionId = document?.currentVersionId;
  const isEditable =
    document?.status === DocumentStatus.COUNTING &&
    document?.version?.status === VersionStatus.DRAFT;

  const productCodeByLineId = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of lines) {
      map.set(line.lineId, line.productCode);
    }
    return map;
  }, [lines]);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    syncStatusByLineRef.current = syncStatusByLine;
  }, [syncStatusByLine]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      const res = await fetch("/api/me");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) return;

      const data = (await res.json()) as { user?: { userId?: string } };
      if (!cancelled) {
        setCurrentUserId(data.user?.userId ?? null);
      }
    }

    void loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const parseLocks = useCallback((lockList: LineLockInfo[]) => {
    const lockMap: Record<string, LineLockInfo> = {};
    for (const lock of lockList) {
      lockMap[lock.lineId] = lock;
    }
    return lockMap;
  }, []);

  const fetchDocumentWithLocks = useCallback(async () => {
    const res = await fetch(`/api/count-documents/${documentId}`);
    if (res.status === 401) {
      router.push("/login");
      return null;
    }
    if (!res.ok) throw new Error("Failed to load document");
    return (await res.json()) as CountDocumentWithLocksResponse;
  }, [documentId, router]);

  const loadDocument = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocumentWithLocks();
      if (!data) return;

      const doc = data.document as CountDocumentDetail;
      setDocument(doc);
      setDocumentNote(doc.note ?? "");
      setLocks(parseLocks(data.locks ?? []));

      const entryMap: Record<string, CountEntry> = {};
      for (const entry of doc.entries) {
        entryMap[entry.lineId] = entry;
      }
      setEntries(entryMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [fetchDocumentWithLocks, parseLocks]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const markOverwriteNotified = useCallback(
    (
      lineId: string,
      revision: number,
      fallbackProductCode: string | undefined,
      updatedByName: string | undefined,
    ) => {
      const key = `${lineId}@${revision}`;
      if (notifiedRevisionsRef.current.has(key)) return;

      notifiedRevisionsRef.current.add(key);
      pushToast(
        `${fallbackProductCode ?? lineId} ถูกบันทึกโดย ${updatedByName ?? "ผู้ใช้อื่น"}`,
      );
    },
    [pushToast],
  );

  const refreshDocumentSilent = useCallback(async () => {
    scrollYRef.current = window.scrollY;
    try {
      const data = await fetchDocumentWithLocks();
      if (!data) return;

      const nextDocument = data.document;
      const serverEntries = nextDocument.entries ?? [];

      setDocument((prev) => {
        if (!prev) return nextDocument;

        const statusChanged =
          prev.status !== nextDocument.status ||
          prev.countedLines !== nextDocument.countedLines ||
          prev.currentVersionId !== nextDocument.currentVersionId ||
          prev.currentVersionNo !== nextDocument.currentVersionNo ||
          prev.version?.status !== nextDocument.version?.status;

        if (!statusChanged) return prev;
        return {
          ...prev,
          status: nextDocument.status,
          countedLines: nextDocument.countedLines,
          currentVersionId: nextDocument.currentVersionId,
          currentVersionNo: nextDocument.currentVersionNo,
          version: nextDocument.version,
        };
      });

      setLocks(parseLocks(data.locks ?? []));
      setEntries((prev) => {
        const next = { ...prev };

        for (const server of serverEntries) {
          const lineId = server.lineId;
          const local = prev[lineId];
          const isSaving = syncStatusByLineRef.current[lineId] === "saving";

          if (!local) {
            next[lineId] = server;
            continue;
          }

          if (dirtyLinesRef.current.has(lineId) || isSaving) {
            if (
              server.revision > local.revision &&
              server.updatedBy !== currentUserId
            ) {
              setConflictByLine((prevConflict) => ({
                ...prevConflict,
                [lineId]: "มีคนอื่นบันทึกทับขณะคุณยังไม่ได้บันทึก — โปรดตรวจสอบ",
              }));
              setServerEntryByLine((prevServer) => ({
                ...prevServer,
                [lineId]: server,
              }));
              markOverwriteNotified(
                lineId,
                server.revision,
                productCodeByLineId.get(lineId),
                server.updatedByName,
              );
            }
            continue;
          }

          if (
            server.revision > local.revision &&
            server.updatedBy !== currentUserId
          ) {
            next[lineId] = server;
            markOverwriteNotified(
              lineId,
              server.revision,
              productCodeByLineId.get(lineId),
              server.updatedByName,
            );
          }
        }

        return next;
      });
    } catch {
      // keep silent polling non-disruptive
    } finally {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollYRef.current });
      });
    }
  }, [
    currentUserId,
    fetchDocumentWithLocks,
    markOverwriteNotified,
    parseLocks,
    productCodeByLineId,
  ]);

  useEffect(() => {
    if (!isEditable) return;

    const intervalId = setInterval(() => {
      void refreshDocumentSilent();
    }, COUNT_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isEditable, refreshDocumentSilent]);

  const ensureLock = useCallback(
    async (lineId: string) => {
      if (!versionId) return false;

      const res = await fetch(
        `/api/count-documents/${documentId}/versions/${versionId}/locks/${lineId}`,
        { method: "POST" },
      );

      if (res.status === 409) {
        const data = (await res.json()) as { message?: string };
        pushToast(data.message ?? "รายการนี้ถูกจองโดยผู้ใช้อื่น");
        return false;
      }

      if (!res.ok) return false;

      const data = (await res.json()) as { lock: LineLockInfo };
      setLocks((prev) => ({ ...prev, [lineId]: data.lock }));
      return true;
    },
    [documentId, pushToast, versionId],
  );

  const releaseLock = useCallback(
    async (lineId: string) => {
      if (!versionId) return;

      await fetch(
        `/api/count-documents/${documentId}/versions/${versionId}/locks/${lineId}`,
        { method: "DELETE" },
      );

      setLocks((prev) => {
        const next = { ...prev };
        delete next[lineId];
        return next;
      });
    },
    [documentId, versionId],
  );

  const filteredLines = useMemo(() => {
    const codeQuery = codeFilter.trim().toLowerCase();
    const nameQuery = nameFilter.trim().toLowerCase();

    return lines.filter((line) => {
      if (codeQuery && !line.productCode.toLowerCase().includes(codeQuery)) {
        return false;
      }
      if (nameQuery && !line.productName.toLowerCase().includes(nameQuery)) {
        return false;
      }
      if (showUncountedOnly) {
        const entry = entries[line.lineId];
        const counted = entry
          ? isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece)
          : false;
        if (counted) return false;

        const lock = locks[line.lineId];
        if (
          lock &&
          lock.lockedByUserId !== currentUserId &&
          new Date(lock.expiresAt) > new Date()
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    lines,
    entries,
    locks,
    currentUserId,
    codeFilter,
    nameFilter,
    showUncountedOnly,
  ]);

  const countedSummary = useMemo(() => {
    const counted = lines.filter((line) => {
      const entry = entries[line.lineId];
      return entry
        ? isEntryCounted(entry.qtyCase, entry.qtyPack, entry.qtyPiece)
        : false;
    }).length;
    return { counted, total: lines.length };
  }, [lines, entries]);

  const saveEntry = useCallback(
    async (lineId: string, payload: Record<string, unknown>) => {
      if (!versionId) return;

      setSyncStatusByLine((prev) => ({ ...prev, [lineId]: "saving" }));
      try {
        const res = await fetch(
          `/api/count-documents/${documentId}/versions/${versionId}/entries/${lineId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );

        if (res.status === 409) {
          const data = (await res.json()) as SaveEntryErrorResponse;

          if (data.error === "CONFLICT" && data.entry) {
            setEntries((prev) => ({ ...prev, [lineId]: data.entry as CountEntry }));
            setServerEntryByLine((prev) => ({
              ...prev,
              [lineId]: data.entry as CountEntry,
            }));
            setConflictByLine((prev) => ({
              ...prev,
              [lineId]: data.message,
            }));
            pushToast(
              `${productCodeByLineId.get(lineId) ?? lineId} ${data.message}`,
            );
            dirtyLinesRef.current.delete(lineId);
          } else if (data.error === "LOCKED") {
            pushToast(data.message ?? "รายการนี้ถูกจองโดยผู้ใช้อื่น");
          }

          setSyncStatusByLine((prev) => ({ ...prev, [lineId]: "failed" }));
          return;
        }

        if (!res.ok) {
          throw new Error("Save failed");
        }

        const data = await res.json();
        setEntries((prev) => ({
          ...prev,
          [lineId]: data.entry,
        }));
        dirtyLinesRef.current.delete(lineId);
        setConflictByLine((prev) => {
          if (!prev[lineId]) return prev;
          const next = { ...prev };
          delete next[lineId];
          return next;
        });
        setSyncStatusByLine((prev) => ({ ...prev, [lineId]: "saved" }));
      } catch {
        setSyncStatusByLine((prev) => ({ ...prev, [lineId]: "failed" }));
      }
    },
    [documentId, productCodeByLineId, pushToast, versionId],
  );

  const saveDocumentNote = useCallback(
    async (note: string) => {
      setNoteSyncStatus("saving");
      try {
        const res = await fetch(`/api/count-documents/${documentId}/note`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note || null }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Save note failed");
        }

        const data = await res.json();
        setDocument((prev) =>
          prev ? { ...prev, note: data.note ?? null } : prev,
        );
        setNoteSyncStatus("saved");
      } catch {
        setNoteSyncStatus("failed");
      }
    },
    [documentId],
  );

  const scheduleSave = useCallback(
    (lineId: string, payload: Record<string, unknown>) => {
      pendingSavesRef.current[lineId] = payload;

      if (saveTimersRef.current[lineId]) {
        clearTimeout(saveTimersRef.current[lineId]);
      }

      saveTimersRef.current[lineId] = setTimeout(() => {
        const pending = pendingSavesRef.current[lineId];
        if (pending) {
          saveEntry(lineId, pending);
          delete pendingSavesRef.current[lineId];
        }
      }, AUTO_SAVE_DELAY_MS);
    },
    [saveEntry],
  );

  function buildPayload(
    line: ProductLine,
    field: "qtyCase" | "qtyPack" | "qtyPiece",
    value: number | null,
  ) {
    const existing = entriesRef.current[line.lineId];
    let qtyCase =
      field === "qtyCase" ? value : (existing?.qtyCase ?? null);
    const qtyPack =
      field === "qtyPack" ? value : (existing?.qtyPack ?? null);
    let qtyPiece =
      field === "qtyPiece" ? value : (existing?.qtyPiece ?? null);

    // When user enters pieces, auto-convert full cases (e.g. 72 pieces → 1 case).
    if (field === "qtyPiece" || field === "qtyCase") {
      const converted = convertPieceOverflowToCase(line, qtyCase, qtyPiece);
      qtyCase = converted.qtyCase;
      qtyPiece = converted.qtyPiece;
    }

    return {
      qtyCase,
      qtyPack,
      qtyPiece,
      baseRevision: existing?.revision,
    };
  }

  async function updateEntry(
    line: ProductLine,
    field: "qtyCase" | "qtyPack" | "qtyPiece",
    value: number | null,
  ) {
    if (!isEditable) return;
    const gotLock = await ensureLock(line.lineId);
    if (!gotLock) return;
    dirtyLinesRef.current.add(line.lineId);

    const existing = entriesRef.current[line.lineId];
    const payload = buildPayload(line, field, value);

    setEntries((prev) => ({
      ...prev,
      [line.lineId]: {
        lineId: line.lineId,
        qtyCase: payload.qtyCase as number | null,
        qtyPack: payload.qtyPack as number | null,
        qtyPiece: payload.qtyPiece as number | null,
        totalBaseQty: existing?.totalBaseQty ?? null,
        note: null,
        revision: existing?.revision ?? 0,
        updatedAt: new Date().toISOString(),
        updatedBy: existing?.updatedBy ?? "",
      },
    }));
    setConflictByLine((prev) => {
      if (!prev[line.lineId]) return prev;
      const next = { ...prev };
      delete next[line.lineId];
      return next;
    });

    scheduleSave(line.lineId, payload);
  }

  const acceptServerEntry = useCallback((lineId: string) => {
    const serverEntry = serverEntryByLine[lineId];
    if (!serverEntry) return;

    setEntries((prev) => ({ ...prev, [lineId]: serverEntry }));
    setConflictByLine((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
    dirtyLinesRef.current.delete(lineId);
    setSyncStatusByLine((prev) => ({ ...prev, [lineId]: "idle" }));
  }, [serverEntryByLine]);

  function updateDocumentNote(note: string) {
    if (!isEditable) return;

    setDocumentNote(note);
    if (noteSaveTimerRef.current) {
      clearTimeout(noteSaveTimerRef.current);
    }

    noteSaveTimerRef.current = setTimeout(() => {
      saveDocumentNote(note);
    }, AUTO_SAVE_DELAY_MS);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-500">กำลังโหลดเอกสาร...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100">
        <p className="text-slate-500">ไม่พบเอกสาร</p>
        <Link href="/tablet/documents" className="text-blue-600">
          กลับรายการเอกสาร
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/tablet/documents"
            className="text-sm text-blue-600 hover:underline"
          >
            ← กลับ
          </Link>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {document.documentNo}
              </h1>
              <p className="text-sm text-slate-500">
                {document.branchCode}
                {document.branchExpressLocationCode
                  ? ` (Express ${document.branchExpressLocationCode})`
                  : ""}{" "}
                · วันที่ {document.documentDate} · เวอร์ชัน{" "}
                {document.currentVersionNo} · นับแล้ว {countedSummary.counted}/
                {countedSummary.total} รายการ
              </p>
            </div>
            <Link
              href={`/tablet/count/${documentId}/summary`}
              className={`rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 ${
                !isEditable ? "pointer-events-none opacity-40" : ""
              }`}
            >
              สรุปและส่งให้หัวหน้างาน
            </Link>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <label
                htmlFor="document-note"
                className="text-sm font-medium text-slate-600"
              >
                หมายเหตุเอกสาร
              </label>
              <SyncStatusBadge status={noteSyncStatus} />
            </div>
            <textarea
              id="document-note"
              rows={2}
              disabled={!isEditable}
              value={documentNote}
              onChange={(e) => updateDocumentNote(e.target.value)}
              placeholder="เพิ่มหมายเหตุสำหรับเอกสารนี้ (ถ้ามี)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-4">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-600">
                ค้นหารหัสสินค้า
              </span>
              <input
                type="text"
                value={codeFilter}
                onChange={(e) => setCodeFilter(e.target.value)}
                placeholder="เช่น P001"
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-600">
                ค้นหาชื่อสินค้า
              </span>
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="เช่น น้ำดื่ม"
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              แสดง {filteredLines.length} จาก {lines.length} รายการ
            </p>
            <button
              type="button"
              onClick={() => setShowUncountedOnly((v) => !v)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                showUncountedOnly
                  ? "bg-orange-100 text-orange-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {showUncountedOnly ? "แสดงทั้งหมด" : "เฉพาะที่ยังไม่นับ"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {filteredLines.map((line) => (
            (() => {
              const lock = locks[line.lineId];
              const lockHeldByOther =
                lock &&
                lock.lockedByUserId !== currentUserId &&
                new Date(lock.expiresAt) > new Date()
                  ? lock.lockedByUserName
                  : null;

              return (
                <ProductCard
                  key={line.lineId}
                  line={line}
                  entry={entries[line.lineId]}
                  syncStatus={syncStatusByLine[line.lineId] ?? "idle"}
                  disabled={!isEditable || !!lockHeldByOther}
                  lockHeldByOther={lockHeldByOther}
                  conflictMessage={conflictByLine[line.lineId] ?? null}
                  onAcceptServer={() => acceptServerEntry(line.lineId)}
                  onEditStart={() => {
                    void ensureLock(line.lineId);
                  }}
                  onEditEnd={() => {
                    void releaseLock(line.lineId);
                  }}
                  onQtyChange={(field, value) => {
                    void updateEntry(line, field, value);
                  }}
                />
              );
            })()
          ))}

          {filteredLines.length === 0 && (
            <p className="py-12 text-center text-slate-500">
              ไม่พบสินค้าที่ตรงกับตัวกรอง
            </p>
          )}
        </div>
      </main>
      <CountToast items={toasts} onDismiss={dismissToast} />
    </div>
  );
}
