"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { FormCardsSkeleton } from "@/components/loading/PageSkeletons";
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
import type { Branch } from "@/types/user";

function PrefixDisplay({ prefix }: { prefix: string | null }) {
  if (!prefix) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
      {prefix}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? "rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
          : "rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
      }
    >
      {isActive ? "Active" : "Disabled"}
    </span>
  );
}

export default function AdminBranchesPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPrefix, setCreatePrefix] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrefix, setEditPrefix] = useState("");

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusBranch, setStatusBranch] = useState<Branch | null>(null);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/branches", { credentials: "same-origin" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        router.push("/admin/documents");
        return;
      }
      if (!res.ok) throw new Error("Failed to load branches");
      const data = await res.json();
      setBranches(data.branches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
  }

  function openCreate() {
    setCreateCode("");
    setCreateName("");
    setCreatePrefix("");
    setCreateError(null);
    setCreateOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditBranch(branch);
    setEditName(branch.name);
    setEditPrefix(branch.expressLocationPrefix ?? "");
    setEditError(null);
    setEditOpen(true);
  }

  function openStatus(branch: Branch) {
    setStatusBranch(branch);
    setStatusError(null);
    setStatusOpen(true);
  }

  async function submitCreate() {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const trimmedPrefix = createPrefix.trim();
      const res = await fetch("/api/admin/branches", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: createCode,
          name: createName,
          expressLocationPrefix: trimmedPrefix.length > 0 ? trimmedPrefix : null,
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        router.push("/admin/documents");
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(typeof data?.error === "string" ? data.error : "Create failed");
        return;
      }

      setBranches((prev) =>
        [...prev, data.branch as Branch].sort((a, b) => a.code.localeCompare(b.code)),
      );
      setCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
  }

  async function submitEdit() {
    if (!editBranch) return;

    setEditBusy(true);
    setEditError(null);
    try {
      const trimmedPrefix = editPrefix.trim();
      const res = await fetch(`/api/admin/branches/${editBranch.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          expressLocationPrefix: trimmedPrefix.length > 0 ? trimmedPrefix : null,
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        router.push("/admin/documents");
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(typeof data?.error === "string" ? data.error : "Save failed");
        return;
      }

      setBranches((prev) =>
        prev.map((branch) =>
          branch.id === editBranch.id ? (data.branch as Branch) : branch,
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

  async function submitStatus() {
    if (!statusBranch) return;

    setStatusBusy(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/admin/branches/${statusBranch.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !statusBranch.isActive }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        router.push("/admin/documents");
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusError(typeof data?.error === "string" ? data.error : "Save failed");
        return;
      }

      setBranches((prev) =>
        prev.map((branch) =>
          branch.id === statusBranch.id ? (data.branch as Branch) : branch,
        ),
      );
      setStatusOpen(false);
      setStatusBranch(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <PageShell
      title="จัดการสาขา"
      subtitle="สร้าง แก้ไข และปิด/เปิดใช้งานสาขา — Express Prefix ใช้จับคู่ warehouse"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={openCreate}>
            เพิ่มสาขา
          </Button>
          <LogoutButton onClick={handleLogout} />
        </div>
      }
      nav={<AdminNav />}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <FormCardsSkeleton cards={2} />
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {branches.map((branch) => (
              <Card key={branch.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{branch.code}</CardTitle>
                    <StatusBadge isActive={branch.isActive} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>{branch.name}</p>
                  <div>
                    <p className="mb-1 text-muted-foreground">Express Prefix</p>
                    <PrefixDisplay prefix={branch.expressLocationPrefix} />
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEdit(branch)}
                  >
                    แก้ไข
                  </Button>
                  <Button
                    variant={branch.isActive ? "destructive" : "secondary"}
                    size="sm"
                    className="flex-1"
                    onClick={() => openStatus(branch)}
                  >
                    {branch.isActive ? "Disable" : "Enable"}
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
                    <TableHead>Express Prefix</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">การทำงาน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-semibold">{branch.code}</TableCell>
                      <TableCell>{branch.name}</TableCell>
                      <TableCell>
                        <PrefixDisplay prefix={branch.expressLocationPrefix} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge isActive={branch.isActive} />
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => openEdit(branch)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant={branch.isActive ? "destructive" : "secondary"}
                          size="xs"
                          onClick={() => openStatus(branch)}
                        >
                          {branch.isActive ? "Disable" : "Enable"}
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
        สาขาที่ปิดใช้งานยังเห็นในหน้านี้ แต่จะไม่โผล่ตอนผูกผู้ใช้ และไม่ใช้ตอน sync Express
      </p>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มสาขา</DialogTitle>
            <DialogDescription>
              รหัสสาขาจะแก้ไม่ได้หลังสร้าง — ตั้ง Express Prefix ได้เลยหรือทีหลัง
            </DialogDescription>
          </DialogHeader>

          {createError && (
            <Alert variant="destructive">
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-branch-code">รหัสสาขา</Label>
              <Input
                id="create-branch-code"
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                placeholder="เช่น PNL"
                className="font-mono"
                maxLength={16}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-branch-name">ชื่อสาขา</Label>
              <Input
                id="create-branch-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="เช่น พัทยา"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-branch-prefix">Express Location Prefix</Label>
              <Input
                id="create-branch-prefix"
                value={createPrefix}
                onChange={(e) => setCreatePrefix(e.target.value.toUpperCase())}
                placeholder="เช่น 32"
                className="font-mono"
                maxLength={2}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                ไม่บังคับ — ตัวอักษรหรือตัวเลข 2 ตัว
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={createBusy}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={createBusy} onClick={submitCreate}>
              {createBusy ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขสาขา</DialogTitle>
            <DialogDescription>
              รหัสสาขาแก้ไม่ได้ — แก้ได้เฉพาะชื่อและ Express Prefix
            </DialogDescription>
          </DialogHeader>

          {editError && (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-branch-code">รหัสสาขา</Label>
              <Input
                id="edit-branch-code"
                value={editBranch?.code ?? ""}
                disabled
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-name">ชื่อสาขา</Label>
              <Input
                id="edit-branch-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-prefix">Express Location Prefix</Label>
              <Input
                id="edit-branch-prefix"
                value={editPrefix}
                onChange={(e) => setEditPrefix(e.target.value.toUpperCase())}
                placeholder="เช่น 32"
                className="font-mono"
                maxLength={2}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                ปล่อยว่างเพื่อลบ prefix
              </p>
            </div>
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

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {statusBranch?.isActive ? "ปิดใช้งานสาขา" : "เปิดใช้งานสาขา"}
            </DialogTitle>
            <DialogDescription>
              {statusBranch?.isActive ? (
                <>
                  ปิดใช้งาน{" "}
                  <span className="font-semibold">{statusBranch.code}</span> —{" "}
                  {statusBranch.name}? สาขานี้จะไม่โผล่ตอนผูกผู้ใช้และไม่ใช้ตอน sync
                  แต่เอกสารเดิมยังอยู่ ผู้ใช้อาจยังผูกสาขานี้ — ควรย้ายสิทธิ์ถ้าจำเป็น
                </>
              ) : (
                <>
                  เปิดใช้งาน{" "}
                  <span className="font-semibold">{statusBranch?.code}</span> อีกครั้ง?
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {statusError && (
            <Alert variant="destructive">
              <AlertDescription>{statusError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={statusBusy}
              onClick={() => setStatusOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={statusBranch?.isActive ? "destructive" : "default"}
              disabled={statusBusy}
              onClick={submitStatus}
            >
              {statusBusy
                ? "Saving..."
                : statusBranch?.isActive
                  ? "Disable"
                  : "Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
