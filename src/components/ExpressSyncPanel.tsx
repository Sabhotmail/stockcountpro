"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListPanelSkeleton } from "@/components/loading/PageSkeletons";
import { DateInputDMY } from "@/components/DateInputDMY";
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
  ExpressSyncDocumentResult,
  ExpressSyncLocationPreview,
} from "@/services/express-sync.service";

type Props = {
  title?: string;
  onSynced?: () => void;
};

type PreviewResponse = {
  date: string;
  locations: ExpressSyncLocationPreview[];
};

type SyncResponse = {
  date: string;
  expressLineCount: number;
  results: ExpressSyncDocumentResult[];
};

export function ExpressSyncPanel({
  title = "Sync ใบตรวจนับจาก Express",
  onSynced,
}: Props) {
  const router = useRouter();
  const [countDate, setCountDate] = useState(todayDateKeyBangkok());
  const [locations, setLocations] = useState<ExpressSyncLocationPreview[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<ExpressSyncDocumentResult[] | null>(
    null,
  );

  const selectableCodes = useMemo(
    () => locations.filter((item) => item.selectable).map((item) => item.locationCode),
    [locations],
  );

  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes]);

  const selectedLocationsAreSelectable = useMemo(() => {
    if (selectedCodes.length === 0) return false;
    const selectableSet = new Set(selectableCodes);
    return selectedCodes.every((code) => selectableSet.has(code));
  }, [selectableCodes, selectedCodes]);

  const allSelectableSelected =
    selectableCodes.length > 0 &&
    selectableCodes.every((code) => selectedSet.has(code));

  const loadLocations = useCallback(async () => {
    setLoadingLocations(true);
    setError(null);
    setSyncMessage(null);
    setSyncResults(null);

    try {
      const res = await fetch(`/api/express/sync?date=${encodeURIComponent(countDate)}`, {
        credentials: "same-origin",
      });
      const data = (await res.json()) as PreviewResponse & { error?: string };

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "โหลดคลังไม่สำเร็จ");

      setLocations(data.locations);
      const nextSelectableCodes = new Set(
        data.locations
          .filter((item) => item.selectable)
          .map((item) => item.locationCode),
      );
      setSelectedCodes((current) =>
        current.filter((code) => nextSelectableCodes.has(code)),
      );
    } catch (err) {
      setLocations([]);
      setSelectedCodes([]);
      setError(err instanceof Error ? err.message : "โหลดคลังไม่สำเร็จ");
    } finally {
      setLoadingLocations(false);
    }
  }, [countDate, router]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  function toggleLocation(code: string) {
    setSelectedCodes((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  }

  function toggleAllSelectable() {
    setSelectedCodes((current) => {
      const selectableSet = new Set(selectableCodes);
      const nonSelectableCurrent = current.filter((code) => !selectableSet.has(code));

      if (allSelectableSelected) {
        return nonSelectableCurrent;
      }

      return [...nonSelectableCurrent, ...selectableCodes];
    });
  }

  const canSync =
    selectedLocationsAreSelectable && !loadingLocations && !syncing;

  async function handleSync() {
    if (!canSync) return;

    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    setSyncResults(null);

    try {
      const res = await fetch("/api/express/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          date: countDate,
          locations: selectedCodes.map((code) => {
            const location = locations.find((item) => item.locationCode === code);
            return {
              code,
              name: location?.locationName ?? null,
            };
          }),
        }),
      });
      const data = (await res.json()) as SyncResponse & { error?: string };

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      const created = data.results.filter((item) => item.status === "created").length;
      const updated = data.results.filter((item) => item.status === "updated").length;
      const skipped = data.results.filter((item) => item.status === "skipped").length;

      setSyncResults(data.results);
      setSyncMessage(
        `Sync สำเร็จ: สร้างใหม่ ${created}, อัปเดต ${updated}, ข้าม ${skipped}`,
      );
      onSynced?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="mb-5 space-y-4 border-b border-border/70 pb-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          เลือกวัน → โหลดคลัง → Sync
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid w-full gap-2 lg:max-w-xs">
            <Label htmlFor="express-sync-date">วันที่ตรวจนับ</Label>
            <DateInputDMY
              id="express-sync-date"
              value={countDate}
              allowEmpty={false}
              onChange={(next) => {
                setCountDate(next);
                setError(null);
                setSyncMessage(null);
                setSyncResults(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              ขั้นตอน: เลือกวัน → โหลดคลัง → เลือกคลัง → Sync ด้านล่าง
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:flex-wrap">
            <Button
              type="button"
              size="lg"
              className="min-h-11 w-full lg:w-auto"
              variant={locations.length === 0 && !error ? "default" : "outline"}
              onClick={() => void loadLocations()}
              disabled={loadingLocations || syncing}
            >
              {loadingLocations ? "กำลังโหลดคลัง..." : "1. โหลดคลัง"}
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-h-11 w-full lg:w-auto"
              variant="secondary"
              onClick={toggleAllSelectable}
              disabled={loadingLocations || syncing || selectableCodes.length === 0}
            >
              {allSelectableSelected ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมดที่เลือกได้"}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="space-y-1">
              <p className="font-medium">{error}</p>
              <p className="text-sm opacity-90">
                ลองเปลี่ยนวันที่ตรวจนับ แล้วกด 「โหลดคลัง」อีกครั้ง
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border">
          {loadingLocations ? (
            <ListPanelSkeleton rows={6} className="rounded-none border-0" />
          ) : locations.length === 0 ? (
            <div className="space-y-2 px-4 py-6 text-center">
              <p className="text-sm font-medium text-foreground">
                {error
                  ? "ยังไม่มีคลังให้เลือกสำหรับวันนี้"
                  : "ไม่พบคลังที่คุณมีสิทธิ์สำหรับวันที่นี้"}
              </p>
              <p className="text-sm text-muted-foreground">
                เลือกวันที่มีใบตรวจนับใน Express แล้วกด 「โหลดคลัง」
              </p>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="mt-1 min-h-11"
                onClick={() => void loadLocations()}
                disabled={loadingLocations || syncing}
              >
                โหลดคลังอีกครั้ง
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {locations.map((location) => {
                const checked = selectedSet.has(location.locationCode);
                const branchLabel = location.mappedBranchCode
                  ? `${location.mappedBranchCode}${
                      location.mappedBranchName
                        ? ` · ${location.mappedBranchName}`
                        : ""
                    }`
                  : "ยังไม่ผูกสาขา";

                const destinationLabel =
                  location.classification === "central"
                    ? "HQ กลาง"
                    : location.classification === "hub"
                      ? `Hub ${location.hubShortName ?? location.hubCode ?? ""}`
                      : "ยังไม่ map";

                return (
                  <label
                    key={location.locationCode}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 px-4 py-4",
                      !location.selectable && "cursor-not-allowed bg-muted/40",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-5 rounded border-border accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                      checked={checked}
                      disabled={!location.selectable || loadingLocations || syncing}
                      onChange={() => toggleLocation(location.locationCode)}
                    />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {location.locationCode}
                          {location.locationName ? ` · ${location.locationName}` : ""}
                        </span>
                        {location.prefix && (
                          <Badge variant="outline">Prefix {location.prefix}</Badge>
                        )}
                        <Badge
                          variant={location.mappedBranchCode ? "secondary" : "outline"}
                        >
                          {branchLabel}
                        </Badge>
                        <Badge
                          variant={
                            location.classification === "central"
                              ? "default"
                              : location.classification === "hub"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {destinationLabel}
                        </Badge>
                      </span>
                      {location.disabledReason && (
                        <span className="block text-sm text-muted-foreground">
                          {location.disabledReason}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {locations.length > 0 && selectableCodes.length === 0 && !loadingLocations && (
          <Alert>
            <AlertDescription>
              มีคลังใน Express แต่ยังเลือก Sync ไม่ได้ — ตรวจการ map สาขา/Hub
              หรือว่าเอกสารถูกนับไปแล้ว
            </AlertDescription>
          </Alert>
        )}

        {locations.length > 0 &&
          selectableCodes.length > 0 &&
          selectedCodes.length === 0 &&
          !loadingLocations && (
            <p className="text-sm text-muted-foreground">
              เลือกอย่างน้อย 1 คลังด้านบน แล้วกด Sync ด้านล่าง
            </p>
          )}

        {locations.length > 0 && (
          <Button
            type="button"
            size="lg"
            className="min-h-11 w-full"
            variant={canSync ? "default" : "outline"}
            onClick={() => void handleSync()}
            disabled={!canSync}
          >
            {syncing
              ? "กำลัง Sync..."
              : selectedCodes.length > 0
                ? `2. Sync ที่เลือก (${selectedCodes.length})`
                : "2. Sync จาก Express"}
          </Button>
        )}

        {syncMessage && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <AlertDescription>{syncMessage}</AlertDescription>
          </Alert>
        )}

        {syncResults && syncResults.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium">ผลลัพธ์ Sync รายเอกสาร</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ปลายทาง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">รายการ</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncResults.map((item) => {
                  const destination =
                    item.documentNo ??
                    (item.locationName
                      ? `${item.locationCode} · ${item.locationName}`
                      : item.locationCode ?? item.branchCode);

                  return (
                  <TableRow key={`${item.locationCode ?? item.branchCode}-${item.status}-${item.reason ?? ""}`}>
                    <TableCell>{destination}</TableCell>
                    <TableCell>
                      {item.status === "created"
                        ? "สร้างใหม่"
                        : item.status === "updated"
                          ? "อัปเดต"
                          : "ข้าม"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.lineCount ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.reason ??
                        (item.documentNo ? `เอกสาร ${item.documentNo}` : "—")}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </section>
  );
}
