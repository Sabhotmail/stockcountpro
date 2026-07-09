"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LINE_LOCK_TTL_MAX_SECONDS,
  LINE_LOCK_TTL_MIN_SECONDS,
} from "@/lib/count-collab-constants";
import { formatDateTimeShortTH } from "@/lib/datetime";

type AppSettings = {
  lineLockTtlSeconds: number;
  updatedAt: string;
  updatedBy: string | null;
};

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [lineLockTtlSeconds, setLineLockTtlSeconds] = useState("30");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/settings", { credentials: "same-origin" });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 403) {
          router.push("/tablet/documents");
          return;
        }
        if (!res.ok) throw new Error("โหลดการตั้งค่าไม่สำเร็จ");
        const data = await res.json();
        if (!cancelled) {
          setSettings(data.settings);
          setLineLockTtlSeconds(String(data.settings.lineLockTtlSeconds));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const value = Number(lineLockTtlSeconds);
    if (!Number.isFinite(value)) {
      setError("กรุณากรอกตัวเลข");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineLockTtlSeconds: value }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      }

      setSettings(data.settings);
      setLineLockTtlSeconds(String(data.settings.lineLockTtlSeconds));
      setSuccess("บันทึกการตั้งค่าแล้ว — มีผลกับการนับร่วมกันทันที");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      title="ตั้งค่าระบบ"
      actions={<LogoutButton onClick={handleLogout} />}
      nav={<AdminNav />}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-slate-500">กำลังโหลด...</p>
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>การนับร่วมกัน (Collaborative Counting)</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="line-lock-ttl">
                  ระยะเวลา Lock รายการสินค้า (วินาที)
                </Label>
                <Input
                  id="line-lock-ttl"
                  type="number"
                  min={LINE_LOCK_TTL_MIN_SECONDS}
                  max={LINE_LOCK_TTL_MAX_SECONDS}
                  step={1}
                  value={lineLockTtlSeconds}
                  onChange={(e) => setLineLockTtlSeconds(e.target.value)}
                  disabled={saving}
                />
                <p className="text-sm text-slate-500">
                  เมื่อพนักงานเริ่มแก้จำนวน ระบบจะ lock รายการนั้นให้คนอื่นแก้ไม่ได้
                  จนกว่าจะหยุดแก้หรือครบเวลานี้ (ต่ออายุทุกครั้งที่แก้)
                  ช่วงที่อนุญาต {LINE_LOCK_TTL_MIN_SECONDS}–
                  {LINE_LOCK_TTL_MAX_SECONDS} วินาที
                </p>
              </div>

              {settings?.updatedAt && (
                <p className="text-xs text-slate-400">
                  แก้ไขล่าสุด:{" "}
                  {formatDateTimeShortTH(settings.updatedAt)}
                </p>
              )}

              <Button type="submit" disabled={saving}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
