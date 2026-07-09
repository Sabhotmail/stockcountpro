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
import type { Branch } from "@/types/user";

export default function AdminBranchesPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [editExpressCode, setEditExpressCode] = useState("");

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
    setEditExpressCode(branch.expressLocationCode ?? "");
    setEditError(null);
    setEditOpen(true);
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
        body: JSON.stringify({
          expressLocationCode: editExpressCode.trim() || null,
        }),
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
      subtitle="รายการสาขาและรหัส Express Location"
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
                <CardContent className="space-y-1 text-sm">
                  <p>{branch.name}</p>
                  <p className="text-muted-foreground">
                    Express:{" "}
                    <span className="font-mono">
                      {branch.expressLocationCode ?? "—"}
                    </span>
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{branch.id}</p>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openEdit(branch)}
                  >
                    แก้ไข Express Location
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
                    <TableHead>Express Location</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead className="text-right">การทำงาน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-semibold">{branch.code}</TableCell>
                      <TableCell>{branch.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {branch.expressLocationCode ?? "—"}
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
        แก้ไขรหัส Express Location ได้จากปุ่ม Edit — ใช้สำหรับ sync สินค้าจาก Express
      </p>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไข Express Location</DialogTitle>
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

          <div className="grid gap-2">
            <Label htmlFor="express-location-code">Express Location Code</Label>
            <Input
              id="express-location-code"
              value={editExpressCode}
              onChange={(e) => setEditExpressCode(e.target.value.toUpperCase())}
              placeholder="เช่น 32D1"
              className="font-mono"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              ปล่อยว่างเพื่อลบการเชื่อม Express — รองรับ A–Z และ 0–9 สูงสุด 16 ตัว
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
