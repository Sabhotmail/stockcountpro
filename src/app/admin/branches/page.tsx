"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatExpressLocationCodes } from "@/lib/express-location";
import type { Branch } from "@/types/user";

function LocationBadges({ codes }: { codes: string[] }) {
  if (codes.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {codes.map((code) => (
        <span
          key={code}
          className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs"
        >
          {code}
        </span>
      ))}
    </div>
  );
}

export default function AdminBranchesPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [editLocationCodes, setEditLocationCodes] = useState<string[]>([]);
  const [newLocationInput, setNewLocationInput] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/branches", { credentials: "same-origin" });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 403) {
          router.push("/tablet/documents");
          return;
        }
        if (!res.ok) throw new Error("Failed to load branches");
        const data = await res.json();
        if (!cancelled) setBranches(data.branches);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
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
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
  }

  function openEdit(branch: Branch) {
    setEditBranch(branch);
    setEditLocationCodes([...branch.expressLocationCodes]);
    setNewLocationInput("");
    setEditError(null);
    setEditOpen(true);
  }

  function addLocationCode() {
    const code = newLocationInput.trim().toUpperCase();
    if (!code) return;
    if (editLocationCodes.includes(code)) {
      setEditError(`รหัส ${code} มีในรายการแล้ว`);
      return;
    }
    setEditError(null);
    setEditLocationCodes((prev) => [...prev, code].sort());
    setNewLocationInput("");
  }

  function removeLocationCode(code: string) {
    setEditLocationCodes((prev) => prev.filter((item) => item !== code));
  }

  async function submitEdit() {
    if (!editBranch) return;

    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/branches/${editBranch.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expressLocationCodes: editLocationCodes }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        router.push("/tablet/documents");
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(typeof data?.error === "string" ? data.error : "Save failed");
        return;
      }

      setBranches((prev) =>
        prev.map((branch) =>
          branch.id === editBranch.id ? data.branch : branch,
        ),
      );
      setEditOpen(false);
      setEditBranch(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <PageShell
      title="จัดการสาขา"
      subtitle="รายการสาขาและรหัส Express Location (หลาย location ต่อสาขาได้)"
      actions={<LogoutButton onClick={handleLogout} />}
      nav={<AdminNav />}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-muted-foreground">กำลังโหลด...</p>
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {branches.map((branch) => (
              <Card key={branch.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{branch.code}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>{branch.name}</p>
                  <div>
                    <p className="mb-1 text-muted-foreground">Express Locations</p>
                    <LocationBadges codes={branch.expressLocationCodes} />
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{branch.id}</p>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openEdit(branch)}
                  >
                    จัดการ Express Locations
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อสาขา</TableHead>
                    <TableHead>Express Locations</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead className="text-right">การทำงาน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-semibold">{branch.code}</TableCell>
                      <TableCell>{branch.name}</TableCell>
                      <TableCell>
                        <LocationBadges codes={branch.expressLocationCodes} />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {branch.id}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => openEdit(branch)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        สาขาหนึ่งสามารถมีหลาย Express Location ได้ — ระบบจะรวมรายการสินค้าจากทุก location
        เป็นเอกสารนับสต็อกเดียวต่อสาขาต่อวัน
      </p>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>จัดการ Express Locations</DialogTitle>
            <DialogDescription>
              {editBranch ? (
                <>
                  สาขา <span className="font-semibold">{editBranch.code}</span> —{" "}
                  {editBranch.name}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {editError && (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>รหัสที่กำหนดแล้ว</Label>
              {editLocationCodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มี location</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {editLocationCodes.map((code) => (
                    <div
                      key={code}
                      className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 font-mono text-sm"
                    >
                      {code}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="h-5 w-5"
                        onClick={() => removeLocationCode(code)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="new-location-code">เพิ่ม Location Code</Label>
                <Input
                  id="new-location-code"
                  value={newLocationInput}
                  onChange={(e) => setNewLocationInput(e.target.value.toUpperCase())}
                  placeholder="เช่น 32D1"
                  className="font-mono"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLocationCode();
                    }
                  }}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={addLocationCode}>
                  เพิ่ม
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              รองรับ A–Z และ 0–9 สูงสุด 16 ตัว — ปัจจุบัน{" "}
              {formatExpressLocationCodes(editLocationCodes) || "ไม่มี"}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={editBusy}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={editBusy} onClick={submitEdit}>
              {editBusy ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
