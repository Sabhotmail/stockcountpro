"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  async function handleSync() {
    if (!selectedLocationsAreSelectable) return;

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
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          เลือกคลัง Express ที่ต้องการดึงใบตรวจนับ — เอกสารที่เริ่มนับแล้วจะไม่ถูกทับ
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid w-full max-w-xs gap-2">
            <Label htmlFor="express-sync-date">วันที่ตรวจนับ</Label>
            <Input
              id="express-sync-date"
              type="date"
              value={countDate}
              onChange={(event) => setCountDate(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadLocations()}
              disabled={loadingLocations || syncing}
            >
              {loadingLocations ? "กำลังโหลดคลัง..." : "โหลดคลัง"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={toggleAllSelectable}
              disabled={loadingLocations || syncing || selectableCodes.length === 0}
            >
              {allSelectableSelected ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมดที่เลือกได้"}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSync()}
              disabled={
                syncing ||
                loadingLocations ||
                selectedCodes.length === 0 ||
                !selectedLocationsAreSelectable
              }
              size="lg"
            >
              {syncing ? "กำลัง Sync..." : "Sync จาก Express"}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {syncMessage && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <AlertDescription>{syncMessage}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border">
          {locations.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {loadingLocations
                ? "กำลังโหลดคลัง..."
                : "ไม่พบคลังที่คุณมีสิทธิ์สำหรับวันที่นี้"}
            </p>
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
                      "flex cursor-pointer items-start gap-3 px-4 py-3",
                      !location.selectable && "cursor-not-allowed bg-muted/40",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border-border accent-primary disabled:cursor-not-allowed disabled:opacity-50"
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
      </CardContent>
    </Card>
  );
}
