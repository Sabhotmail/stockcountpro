"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        router.push("/tablet/documents");
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
    loadBranches();
  }, [loadBranches]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
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
                  {branch.expressLocationCode && (
                    <p className="text-muted-foreground">
                      Express:{" "}
                      <span className="font-mono">{branch.expressLocationCode}</span>
                    </p>
                  )}
                  <p className="font-mono text-xs text-muted-foreground">{branch.id}</p>
                </CardContent>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        ยังไม่รองรับการแก้ไขสาขาในระบบ — ดูรหัส Express ได้จากตารางด้านบน
      </p>
    </PageShell>
  );
}
