"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { DateInputDMY } from "@/components/DateInputDMY";
import { ListPanelSkeleton } from "@/components/loading/PageSkeletons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { todayDateKeyBangkok } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type {
  ExpressDeleteDocumentPreview,
  ExpressDeletePartialResult,
  ExpressDeletePreviewResult,
} from "@/services/express-delete.service";

type Props = {
  title?: string;
};

type PartialState = ExpressDeletePartialResult;

export function ExpressDeletePanel({
  title = "ลบรายการนับสต็อกจาก Express",
}: Props) {
  const router = useRouter();
  const [countDate, setCountDate] = useState(todayDateKeyBangkok());
  const [locationCode, setLocationCode] = useState("");
  const [preview, setPreview] = useState<ExpressDeletePreviewResult | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [partialState, setPartialState] = useState<PartialState | null>(null);

  const normalizedLocationCode = locationCode.trim().toUpperCase();
  const expectedConfirmPhrase = useMemo(() => {
    if (!countDate || !normalizedLocationCode) return "";
    return `DELETE ${countDate} ${normalizedLocationCode}`;
  }, [countDate, normalizedLocationCode]);

  const selectedDocument = useMemo(
    () =>
      preview?.deletableDocuments.find((doc) => doc.id === selectedDocumentId) ??
      null,
    [preview, selectedDocumentId],
  );

  const canPreview = countDate.length > 0 && normalizedLocationCode.length > 0;
  const canDelete =
    selectedDocumentId !== null &&
    confirmPhrase.trim() === expectedConfirmPhrase &&
    !deleting;

  const handleAuthError = useCallback(
    (status: number) => {
      if (status === 401) {
        router.push("/login");
        return true;
      }
      if (status === 403) {
        router.push("/");
        return true;
      }
      return false;
    },
    [router],
  );

  const loadPreview = useCallback(async () => {
    if (!canPreview) return;

    setLoadingPreview(true);
    setError(null);
    setSuccessMessage(null);
    setPartialState(null);
    setSelectedDocumentId(null);
    setConfirmPhrase("");

    const params = new URLSearchParams({
      countDate,
      locationCode: normalizedLocationCode,
    });

    try {
      const res = await fetch(`/api/express/delete?${params.toString()}`);
      if (handleAuthError(res.status)) return;

      const data = (await res.json()) as
        | ExpressDeletePreviewResult
        | { error: string };
      if (!res.ok) {
        setPreview(null);
        setError("error" in data ? data.error : "ไม่สามารถค้นหาเอกสารได้");
        return;
      }

      const result = data as ExpressDeletePreviewResult;
      setPreview(result);
      if (result.deletableDocuments.length === 1) {
        setSelectedDocumentId(result.deletableDocuments[0].id);
      }
    } catch {
      setPreview(null);
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoadingPreview(false);
    }
  }, [canPreview, countDate, handleAuthError, normalizedLocationCode]);

  async function handleDelete() {
    if (!selectedDocumentId || !canDelete) return;

    setDeleting(true);
    setError(null);
    setSuccessMessage(null);
    setPartialState(null);

    try {
      const res = await fetch("/api/express/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countDate,
          locationCode: normalizedLocationCode,
          documentId: selectedDocumentId,
          confirmPhrase: confirmPhrase.trim(),
        }),
      });

      if (handleAuthError(res.status)) return;

      const data = (await res.json()) as
        | { success?: boolean; partial?: boolean }
        | PartialState
        | { error: string };

      if (res.status === 207 && "partial" in data && data.partial) {
        setPartialState(data as PartialState);
        setPreview(null);
        setSelectedDocumentId(null);
        setConfirmPhrase("");
        return;
      }

      if (!res.ok) {
        setError("error" in data ? data.error : "ลบไม่สำเร็จ");
        return;
      }

      setSuccessMessage(
        `ลบเอกสารและรายการนับ Express สำหรับ ${normalizedLocationCode} วันที่ ${countDate} เรียบร้อยแล้ว`,
      );
      setPreview(null);
      setSelectedDocumentId(null);
      setConfirmPhrase("");
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRetryExpress() {
    if (!partialState) return;

    setRetrying(true);
    setError(null);

    try {
      const res = await fetch("/api/express/delete", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countDate: partialState.countDate,
          locationCode: partialState.locationCode,
        }),
      });

      if (handleAuthError(res.status)) return;

      const data = (await res.json()) as { success?: boolean } | { error: string };
      if (!res.ok) {
        setError("error" in data ? data.error : "ลบ Express อีกครั้งไม่สำเร็จ");
        return;
      }

      setPartialState(null);
      setSuccessMessage(
        `ลบรายการนับ Express สำหรับ ${partialState.locationCode} วันที่ ${partialState.countDate} เรียบร้อยแล้ว`,
      );
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setRetrying(false);
    }
  }

  function renderDocumentTable(
    documents: ExpressDeleteDocumentPreview[],
    selectable: boolean,
  ) {
    if (documents.length === 0) return null;

    return (
      <Table>
        <TableHeader>
          <TableRow>
            {selectable ? <TableHead className="w-10" /> : null}
            <TableHead>เลขที่</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>สาขา / Hub</TableHead>
            <TableHead className="text-right">ความคืบหน้า</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow
              key={doc.id}
              className={cn(
                selectable &&
                  selectedDocumentId === doc.id &&
                  "bg-muted/50",
              )}
            >
              {selectable ? (
                <TableCell>
                  <input
                    type="radio"
                    name="express-delete-document"
                    checked={selectedDocumentId === doc.id}
                    onChange={() => setSelectedDocumentId(doc.id)}
                    aria-label={`เลือก ${doc.documentNo}`}
                  />
                </TableCell>
              ) : null}
              <TableCell className="font-medium">{doc.documentNo}</TableCell>
              <TableCell>
                <DocumentStatusBadge status={doc.status} compact />
              </TableCell>
              <TableCell>
                <div className="text-sm">{doc.branchCode}</div>
                {doc.hubCode ? (
                  <div className="text-xs text-muted-foreground">
                    {doc.hubCode}
                    {doc.hubName ? ` · ${doc.hubName}` : ""}
                  </div>
                ) : null}
                {doc.blockedReason ? (
                  <div className="mt-1 text-xs text-destructive">
                    {doc.blockedReason}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {doc.countedLines}/{doc.totalLines}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ลบเอกสารใน StockCount Pro และรายการนับใน Express ตามวันที่และรหัสคลัง
          (เฉพาะสถานะยังไม่เริ่ม / กำลังนับ / ขอนับใหม่)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,10rem)_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="express-delete-date">วันที่นับ</Label>
          <DateInputDMY
            id="express-delete-date"
            value={countDate}
            onChange={setCountDate}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="express-delete-location">รหัสคลัง</Label>
          <Input
            id="express-delete-location"
            value={locationCode}
            onChange={(event) => setLocationCode(event.target.value.toUpperCase())}
            placeholder="เช่น 32F1"
            autoCapitalize="characters"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void loadPreview()}
          disabled={!canPreview || loadingPreview}
        >
          {loadingPreview ? "กำลังค้นหา..." : "ค้นหาเอกสาร"}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {partialState ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-3">
            <p>
              ลบเอกสารใน StockCount Pro แล้ว แต่ลบ Express ไม่สำเร็จ:{" "}
              {partialState.expressError}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRetryExpress()}
              disabled={retrying}
            >
              {retrying ? "กำลังลองอีกครั้ง..." : "ลองลบ Express อีกครั้ง"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {loadingPreview ? <ListPanelSkeleton rows={3} /> : null}

      {preview && !loadingPreview ? (
        <div className="space-y-6">
          {preview.deletableDocuments.length === 0 &&
          preview.blockedDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              ไม่พบเอกสารสำหรับ {preview.locationCode} วันที่ {preview.countDate}
            </p>
          ) : null}

          {preview.deletableDocuments.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">
                เอกสารที่ลบได้ ({preview.deletableDocuments.length})
              </h3>
              {preview.deletableDocuments.length > 1 ? (
                <p className="text-sm text-muted-foreground">
                  พบหลายเอกสาร — เลือกเอกสารที่ต้องการลบ
                </p>
              ) : null}
              {renderDocumentTable(preview.deletableDocuments, true)}
            </div>
          ) : null}

          {preview.blockedDocuments.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                เอกสารที่ลบไม่ได้ ({preview.blockedDocuments.length})
              </h3>
              {renderDocumentTable(preview.blockedDocuments, false)}
            </div>
          ) : null}

          {selectedDocument ? (
            <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm">
                จะลบเอกสาร <strong>{selectedDocument.documentNo}</strong> และรายการนับ
                Express สำหรับ <strong>{preview.locationCode}</strong> วันที่{" "}
                <strong>{preview.countDate}</strong>
              </p>
              <div className="space-y-2">
                <Label htmlFor="express-delete-confirm">
                  พิมพ์ <code className="text-xs">{expectedConfirmPhrase}</code> เพื่อยืนยัน
                </Label>
                <Input
                  id="express-delete-confirm"
                  value={confirmPhrase}
                  onChange={(event) => setConfirmPhrase(event.target.value)}
                  placeholder={expectedConfirmPhrase}
                  autoComplete="off"
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={!canDelete}
              >
                {deleting ? "กำลังลบ..." : "ลบเอกสารและ Express"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
