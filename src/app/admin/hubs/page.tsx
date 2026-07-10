"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import type { Branch, Hub } from "@/types/user";

export default function AdminHubsPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [createShortName, setCreateShortName] = useState("");
  const [createSuffixLetter, setCreateSuffixLetter] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editHub, setEditHub] = useState<Hub | null>(null);
  const [editName, setEditName] = useState("");
  const [editShortName, setEditShortName] = useState("");
  const [editSuffixLetter, setEditSuffixLetter] = useState("");

  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.isActive),
    [branches],
  );

  const branchById = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch])),
    [branches],
  );

  const filteredHubs = useMemo(
    () =>
      selectedBranchId
        ? hubs.filter((hub) => hub.branchId === selectedBranchId)
        : hubs,
    [hubs, selectedBranchId],
  );

  const handleAuthRedirect = useCallback(
    (status: number) => {
      if (status === 401) {
        router.push("/login");
        return true;
      }
      if (status === 403) {
        router.push("/tablet/documents");
        return true;
      }
      return false;
    },
    [router],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [branchRes, hubRes] = await Promise.all([
        fetch("/api/admin/branches", { credentials: "same-origin" }),
        fetch("/api/admin/hubs", { credentials: "same-origin" }),
      ]);

      if (handleAuthRedirect(branchRes.status) || handleAuthRedirect(hubRes.status)) {
        return;
      }
      if (!branchRes.ok || !hubRes.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");

      const branchData = await branchRes.json();
      const hubData = await hubRes.json();
      setBranches(branchData.branches);
      setHubs(hubData.hubs);

      if (!selectedBranchId && branchData.branches.length > 0) {
        const defaultBranch =
          branchData.branches.find((b: Branch) => b.isActive) ??
          branchData.branches[0];
        setSelectedBranchId(defaultBranch.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [handleAuthRedirect, selectedBranchId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreate() {
    setCreateError(null);
    setCreateCode("");
    setCreateName("");
    setCreateShortName("");
    setCreateSuffixLetter("");
    setCreateOpen(true);
  }

  function openEdit(hub: Hub) {
    setEditError(null);
    setEditHub(hub);
    setEditName(hub.name);
    setEditShortName(hub.shortName ?? "");
    setEditSuffixLetter(hub.suffixLetter ?? "");
    setEditOpen(true);
  }

  async function submitCreate() {
    if (!selectedBranchId) {
      setCreateError("กรุณาเลือกสาขา");
      return;
    }

    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/hubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          branchId: selectedBranchId,
          code: createCode.trim(),
          name: createName.trim(),
          shortName: createShortName.trim() || null,
          suffixLetter: createSuffixLetter.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "สร้าง Hub ไม่สำเร็จ");
      setCreateOpen(false);
      await loadData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "สร้าง Hub ไม่สำเร็จ");
    } finally {
      setCreateBusy(false);
    }
  }

  async function submitEdit() {
    if (!editHub) return;

    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/hubs/${editHub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: editName.trim(),
          shortName: editShortName.trim() || null,
          suffixLetter: editSuffixLetter.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      setEditOpen(false);
      await loadData();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setEditBusy(false);
    }
  }
  async function toggleHubActive(hub: Hub) {
    try {
      const res = await fetch(`/api/admin/hubs/${hub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ isActive: !hub.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "อัปเดตสถานะไม่สำเร็จ");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปเดตสถานะไม่สำเร็จ");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
  }

  return (
    <PageShell
      title="จัดการ Hub"
      subtitle="Hub ภายใต้สาขา BKK3 — ใช้ map คลัง Van (241x) และ G/D/F/Z (24GA, 24DB)"
      actions={<LogoutButton onClick={() => void handleLogout()} />}
      nav={<AdminNav />}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Hub ทั้งหมด</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
            >
              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} · {branch.name}
                </option>
              ))}
            </select>
            <Button type="button" onClick={openCreate} disabled={!selectedBranchId}>
              เพิ่ม Hub
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>สาขา</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>Short</TableHead>
                  <TableHead>Suffix</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHubs.map((hub) => {
                  const branch = branchById.get(hub.branchId);
                  return (
                    <TableRow key={hub.id}>
                      <TableCell>{branch?.code ?? hub.branchId}</TableCell>
                      <TableCell className="font-mono">{hub.code}</TableCell>
                      <TableCell>{hub.name}</TableCell>
                      <TableCell>{hub.shortName ?? "—"}</TableCell>
                      <TableCell className="font-mono">{hub.suffixLetter ?? "—"}</TableCell>
                      <TableCell>{hub.isActive ? "Active" : "Disabled"}</TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(hub)}
                        >
                          แก้ไข
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void toggleHubActive(hub)}
                        >
                          {hub.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredHubs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      ยังไม่มี Hub สำหรับสาขานี้
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่ม Hub</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="create_hub_code">Hub code (1-9)</Label>
              <Input
                id="create_hub_code"
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_hub_name">ชื่อ Hub</Label>
              <Input
                id="create_hub_name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_hub_short">Short name</Label>
              <Input
                id="create_hub_short"
                value={createShortName}
                onChange={(e) => setCreateShortName(e.target.value)}
                placeholder="CHM"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_hub_suffix">Suffix letter (G/D/F/Z)</Label>
              <Input
                id="create_hub_suffix"
                value={createSuffixLetter}
                onChange={(e) => setCreateSuffixLetter(e.target.value)}
                placeholder="A"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createBusy} onClick={() => void submitCreate()}>
              สร้าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไข Hub {editHub?.code}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {editError && (
              <Alert variant="destructive">
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="edit_hub_name">ชื่อ Hub</Label>
              <Input
                id="edit_hub_name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_hub_short">Short name</Label>
              <Input
                id="edit_hub_short"
                value={editShortName}
                onChange={(e) => setEditShortName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_hub_suffix">Suffix letter</Label>
              <Input
                id="edit_hub_suffix"
                value={editSuffixLetter}
                onChange={(e) => setEditSuffixLetter(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button disabled={editBusy} onClick={() => void submitEdit()}>
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
