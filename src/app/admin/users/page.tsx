"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { LogoutButton, PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserRole, type Branch, type Hub, type User } from "@/types/user";

const roleLabels: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Admin",
  [UserRole.HQ]: "HQ",
  [UserRole.SUPERVISOR]: "Supervisor",
  [UserRole.BRANCH_MANAGER]: "ผู้จัดการสาขา",
  [UserRole.STAFF]: "พนักงาน",
  [UserRole.COUNTER]: "ผู้นับ",
  [UserRole.VIEWER]: "ดูอย่างเดียว",
};

type PasswordMode = "set" | "generate";

const roleOptions: UserRole[] = [
  UserRole.ADMIN,
  UserRole.HQ,
  UserRole.SUPERVISOR,
  UserRole.BRANCH_MANAGER,
  UserRole.STAFF,
  UserRole.COUNTER,
  UserRole.VIEWER,
];

function isAdminOrHq(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.HQ;
}

type StatusFilter = "all" | "active" | "disabled";

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const handleAuthRedirect = useCallback(
    (status: number) => {
      if (status === 401) {
        router.push("/login");
        return true;
      }
      if (status === 403) {
        router.push("/admin/documents");
        return true;
      }
      return false;
    },
    [router],
  );

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { credentials: "same-origin" });
      if (handleAuthRedirect(res.status)) return;
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  }, [handleAuthRedirect]);

  const loadBranches = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/branches", { credentials: "same-origin" });
      if (handleAuthRedirect(res.status)) return;
      if (!res.ok) throw new Error("Failed to load branches");
      const data = await res.json();
      setBranches(data.branches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  }, [handleAuthRedirect]);

  const loadHubs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/hubs", { credentials: "same-origin" });
      if (handleAuthRedirect(res.status)) return;
      if (!res.ok) throw new Error("Failed to load hubs");
      const data = await res.json();
      setHubs(data.hubs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  }, [handleAuthRedirect]);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      setError(null);
      await Promise.all([loadUsers(), loadBranches(), loadHubs()]);
      if (!cancelled) setLoading(false);
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, [loadBranches, loadHubs, loadUsers]);

  const branchById = useMemo(() => {
    const map = new Map<string, Branch>();
    for (const branch of branches) {
      map.set(branch.id, branch);
    }
    return map;
  }, [branches]);

  const hubById = useMemo(() => {
    const map = new Map<string, Hub>();
    for (const hub of hubs) {
      map.set(hub.id, hub);
    }
    return map;
  }, [hubs]);

  const activeHubs = useMemo(
    () => hubs.filter((hub) => hub.isActive),
    [hubs],
  );

  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.isActive),
    [branches],
  );

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (statusFilter === "active" && !user.isActive) return false;
      if (statusFilter === "disabled" && user.isActive) return false;
      if (branchFilter !== "all" && !user.branchIds.includes(branchFilter)) {
        return false;
      }

      if (!query) return true;

      const branchText = user.branchIds
        .map((id) => branchById.get(id)?.code ?? id)
        .join(" ")
        .toLowerCase();

      return (
        user.name.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        roleLabels[user.role].toLowerCase().includes(query) ||
        branchText.includes(query)
      );
    });
  }, [branchById, branchFilter, roleFilter, searchQuery, statusFilter, users]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
  }

  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>(UserRole.STAFF);
  const [createBranchIds, setCreateBranchIds] = useState<string[]>([]);
  const [createHubIds, setCreateHubIds] = useState<string[]>([]);
  const [createPasswordMode, setCreatePasswordMode] = useState<PasswordMode>("generate");
  const [createPassword, setCreatePassword] = useState("");
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>(UserRole.STAFF);
  const [editBranchIds, setEditBranchIds] = useState<string[]>([]);
  const [editHubIds, setEditHubIds] = useState<string[]>([]);

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusUser, setStatusUser] = useState<User | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPasswordMode, setResetPasswordMode] = useState<PasswordMode>("generate");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");

  const [generatedOpen, setGeneratedOpen] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState("Password generated");
  const [generatedDescription, setGeneratedDescription] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  function toggleId(list: string[], id: string) {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  }

  function toggleBranch(list: string[], branchId: string) {
    return toggleId(list, branchId);
  }

  function toggleHub(list: string[], hubId: string) {
    return toggleId(list, hubId);
  }

  function openCreate() {
    setCreateError(null);
    setCreateName("");
    setCreateUsername("");
    setCreateRole(UserRole.STAFF);
    setCreateBranchIds([]);
    setCreateHubIds([]);
    setCreatePasswordMode("generate");
    setCreatePassword("");
    setCreatePasswordConfirm("");
    setCreateOpen(true);
  }

  function openEdit(user: User) {
    setEditError(null);
    setEditUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditBranchIds(user.branchIds);
    setEditHubIds(user.hubIds);
    setEditOpen(true);
  }

  function openStatusConfirm(user: User) {
    setStatusError(null);
    setStatusUser(user);
    setStatusOpen(true);
  }

  function openReset(user: User) {
    setResetError(null);
    setResetUser(user);
    setResetPasswordMode("generate");
    setResetPassword("");
    setResetPasswordConfirm("");
    setResetOpen(true);
  }

  async function copyGenerated() {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 1500);
    } catch {
      // ignore
    }
  }

  async function submitCreate() {
    setCreateError(null);
    const name = createName.trim();
    const username = createUsername.trim().toLowerCase();

    if (!name) return setCreateError("กรุณากรอกชื่อ");
    if (!username) return setCreateError("กรุณากรอก username");
    if (!isAdminOrHq(createRole) && createBranchIds.length === 0) {
      return setCreateError("กรุณาเลือกสาขาอย่างน้อย 1 สาขา");
    }
    if (!isAdminOrHq(createRole) && createHubIds.length === 0) {
      return setCreateError("กรุณาเลือก Hub อย่างน้อย 1 Hub");
    }

    if (createPasswordMode === "set") {
      if (!createPassword) return setCreateError("กรุณากรอกรหัสผ่าน");
      if (createPassword !== createPasswordConfirm) {
        return setCreateError("รหัสผ่านไม่ตรงกัน");
      }
    }

    setCreateBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username,
          role: createRole,
          branchIds: isAdminOrHq(createRole) ? [] : createBranchIds,
          hubIds: isAdminOrHq(createRole) ? [] : createHubIds,
          passwordMode: createPasswordMode,
          password: createPasswordMode === "set" ? createPassword : undefined,
        }),
      });
      if (handleAuthRedirect(res.status)) return;

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(typeof data?.error === "string" ? data.error : "Create failed");
        return;
      }

      setCreateOpen(false);
      await loadUsers();

      if (typeof data?.generatedPassword === "string") {
        setGeneratedTitle("สร้างผู้ใช้สำเร็จ");
        setGeneratedDescription("รหัสผ่านนี้จะแสดงเพียงครั้งเดียว กรุณาคัดลอกเก็บไว้");
        setGeneratedPassword(data.generatedPassword);
        setGeneratedOpen(true);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
  }

  async function submitEdit() {
    if (!editUser) return;
    setEditError(null);
    const name = editName.trim();
    if (!name) return setEditError("กรุณากรอกชื่อ");
    if (!isAdminOrHq(editRole) && editBranchIds.length === 0) {
      return setEditError("กรุณาเลือกสาขาอย่างน้อย 1 สาขา");
    }
    if (!isAdminOrHq(editRole) && editHubIds.length === 0) {
      return setEditError("กรุณาเลือก Hub อย่างน้อย 1 Hub");
    }

    setEditBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role: editRole,
          branchIds: isAdminOrHq(editRole) ? [] : editBranchIds,
          hubIds: isAdminOrHq(editRole) ? [] : editHubIds,
        }),
      });
      if (handleAuthRedirect(res.status)) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(typeof data?.error === "string" ? data.error : "Update failed");
        return;
      }
      setEditOpen(false);
      setEditUser(null);
      await loadUsers();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditBusy(false);
    }
  }

  async function submitToggleActive() {
    if (!statusUser) return;
    setStatusError(null);
    setStatusBusy(true);
    try {
      const nextActive = !statusUser.isActive;
      const res = await fetch(`/api/admin/users/${statusUser.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (handleAuthRedirect(res.status)) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusError(typeof data?.error === "string" ? data.error : "Update failed");
        return;
      }
      setStatusOpen(false);
      setStatusUser(null);
      await loadUsers();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setStatusBusy(false);
    }
  }

  async function submitResetPassword() {
    if (!resetUser) return;
    setResetError(null);
    if (resetPasswordMode === "set") {
      if (!resetPassword) return setResetError("กรุณากรอกรหัสผ่าน");
      if (resetPassword !== resetPasswordConfirm) {
        return setResetError("รหัสผ่านไม่ตรงกัน");
      }
    }

    setResetBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${resetUser.id}/reset-password`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passwordMode: resetPasswordMode,
          password: resetPasswordMode === "set" ? resetPassword : undefined,
        }),
      });
      if (handleAuthRedirect(res.status)) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResetError(typeof data?.error === "string" ? data.error : "Reset failed");
        return;
      }

      setResetOpen(false);
      setResetUser(null);

      if (typeof data?.generatedPassword === "string") {
        setGeneratedTitle("รีเซ็ตรหัสผ่านสำเร็จ");
        setGeneratedDescription("รหัสผ่านนี้จะแสดงเพียงครั้งเดียว กรุณาคัดลอกเก็บไว้");
        setGeneratedPassword(data.generatedPassword);
        setGeneratedOpen(true);
      }
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <PageShell
      title="จัดการผู้ใช้"
      nav={<AdminNav />}
      actions={
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} size="sm">
            Add user
          </Button>
          <LogoutButton onClick={handleLogout} />
        </div>
      }
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
          <Card className="mb-4">
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2 md:col-span-2 xl:col-span-2">
                <Label htmlFor="user-search">ค้นหา</Label>
                <Input
                  id="user-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ชื่อ, username, บทบาท, รหัสสาขา"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="role-filter">บทบาท</Label>
                <select
                  id="role-filter"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={roleFilter}
                  onChange={(e) =>
                    setRoleFilter(e.target.value as UserRole | "all")
                  }
                >
                  <option value="all">ทั้งหมด</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="branch-filter">สาขา</Label>
                <select
                  id="branch-filter"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                >
                  <option value="all">ทั้งหมด</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} — {branch.name}
                      {!branch.isActive ? " (Disabled)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2 md:col-span-2 xl:col-span-4">
                <Label>สถานะ</Label>
                <Tabs
                  value={statusFilter}
                  onValueChange={(value: string | number | null) =>
                    setStatusFilter((value ?? "all") as StatusFilter)
                  }
                >
                  <TabsList>
                    <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="disabled">Disabled</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardContent>
          </Card>

          <p className="mb-3 text-sm text-muted-foreground">
            แสดง {filteredUsers.length} จาก {users.length} ผู้ใช้
          </p>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>บทบาท</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">การทำงาน</TableHead>
                    <TableHead>ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-muted-foreground"
                      >
                        ไม่พบผู้ใช้ที่ตรงกับตัวกรอง
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="font-mono">{user.username}</TableCell>
                        <TableCell>{roleLabels[user.role]}</TableCell>
                        <TableCell>
                          {user.branchIds.length === 0
                            ? "—"
                            : user.branchIds
                                .map((id) => branchById.get(id)?.code ?? id)
                                .join(", ")}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              user.isActive
                                ? "text-emerald-700"
                                : "text-muted-foreground"
                            }
                          >
                            {user.isActive ? "Active" : "Disabled"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => openEdit(user)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => openReset(user)}
                            >
                              Reset password
                            </Button>
                            <Button
                              variant={user.isActive ? "destructive" : "secondary"}
                              size="xs"
                              onClick={() => openStatusConfirm(user)}
                            >
                              {user.isActive ? "Disable" : "Enable"}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {user.id}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        ใช้ตัวกรด้านบนเพื่อค้นหาผู้ใช้ตามชื่อ, username, บทบาท หรือสาขา
      </p>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>เพิ่มผู้ใช้</DialogTitle>
            <DialogDescription>สร้างผู้ใช้ใหม่และกำหนดสิทธิ์การเข้าถึงสาขา</DialogDescription>
          </DialogHeader>

          {createError && (
            <Alert variant="destructive">
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="create_name">Name</Label>
              <Input
                id="create_name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create_username">Username</Label>
              <Input
                id="create_username"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                ระบบจะบันทึกเป็นตัวพิมพ์เล็กอัตโนมัติ
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create_role">Role</Label>
              <select
                id="create_role"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as UserRole)}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
            </div>

            {!isAdminOrHq(createRole) && (
              <div className="grid gap-2">
                <Label>Branches</Label>
                <div className="max-h-40 overflow-auto rounded-md border border-input p-2">
                  <div className="grid gap-2">
                    {activeBranches.map((b) => {
                      const checked = createBranchIds.includes(b.id);
                      return (
                        <label key={b.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setCreateBranchIds((prev) => toggleBranch(prev, b.id))
                            }
                          />
                          <span className="font-medium">{b.code}</span>
                          <span className="text-muted-foreground">{b.name}</span>
                        </label>
                      );
                    })}
                    {activeBranches.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        ไม่มีสาขาที่เปิดใช้งาน
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!isAdminOrHq(createRole) && (
              <div className="grid gap-2">
                <Label>Hubs</Label>
                <div className="max-h-40 overflow-auto rounded-md border border-input p-2">
                  <div className="grid gap-2">
                    {activeHubs.map((hub) => {
                      const checked = createHubIds.includes(hub.id);
                      const branch = branchById.get(hub.branchId);
                      return (
                        <label key={hub.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setCreateHubIds((prev) => toggleHub(prev, hub.id))
                            }
                          />
                          <span className="font-medium">
                            {branch?.code ?? hub.branchId} · Hub {hub.shortName ?? hub.code}
                          </span>
                          <span className="text-muted-foreground">{hub.name}</span>
                        </label>
                      );
                    })}
                    {activeHubs.length === 0 && (
                      <p className="text-sm text-muted-foreground">ยังไม่มี Hub ที่เปิดใช้งาน</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Password mode</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={createPasswordMode === "generate" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCreatePasswordMode("generate")}
                >
                  Generate
                </Button>
                <Button
                  type="button"
                  variant={createPasswordMode === "set" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCreatePasswordMode("set")}
                >
                  Set manually
                </Button>
              </div>
            </div>

            {createPasswordMode === "set" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="create_password">Password</Label>
                  <Input
                    id="create_password"
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create_password_confirm">Confirm</Label>
                  <Input
                    id="create_password_confirm"
                    type="password"
                    value={createPasswordConfirm}
                    onChange={(e) => setCreatePasswordConfirm(e.target.value)}
                  />
                </div>
              </div>
            )}
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
              {createBusy ? "Saving..." : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>แก้ไขผู้ใช้</DialogTitle>
            <DialogDescription>แก้ไขชื่อ/บทบาท/สาขาที่เข้าถึงได้</DialogDescription>
          </DialogHeader>

          {editError && (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit_username">Username</Label>
              <Input id="edit_username" value={editUser?.username ?? ""} readOnly />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit_name">Name</Label>
              <Input
                id="edit_name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit_role">Role</Label>
              <select
                id="edit_role"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
            </div>

            {!isAdminOrHq(editRole) && (
              <div className="grid gap-2">
                <Label>Branches</Label>
                <div className="max-h-40 overflow-auto rounded-md border border-input p-2">
                  <div className="grid gap-2">
                    {activeBranches.map((b) => {
                      const checked = editBranchIds.includes(b.id);
                      return (
                        <label key={b.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setEditBranchIds((prev) => toggleBranch(prev, b.id))
                            }
                          />
                          <span className="font-medium">{b.code}</span>
                          <span className="text-muted-foreground">{b.name}</span>
                        </label>
                      );
                    })}
                    {activeBranches.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        ไม่มีสาขาที่เปิดใช้งาน
                      </p>
                    )}
                    {editBranchIds.some(
                      (id) => !activeBranches.some((b) => b.id === id),
                    ) && (
                      <p className="text-xs text-amber-700">
                        ผู้ใช้นี้ยังผูกกับสาขาที่ถูกปิดใช้งานอยู่ (ยังคงสิทธิ์เดิมจนกว่าจะบันทึกใหม่โดยเอาออก)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!isAdminOrHq(editRole) && (
              <div className="grid gap-2">
                <Label>Hubs</Label>
                <div className="max-h-40 overflow-auto rounded-md border border-input p-2">
                  <div className="grid gap-2">
                    {activeHubs.map((hub) => {
                      const checked = editHubIds.includes(hub.id);
                      const branch = branchById.get(hub.branchId);
                      return (
                        <label key={hub.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setEditHubIds((prev) => toggleHub(prev, hub.id))
                            }
                          />
                          <span className="font-medium">
                            {branch?.code ?? hub.branchId} · Hub {hub.shortName ?? hub.code}
                          </span>
                          <span className="text-muted-foreground">{hub.name}</span>
                        </label>
                      );
                    })}
                    {activeHubs.length === 0 && (
                      <p className="text-sm text-muted-foreground">ยังไม่มี Hub ที่เปิดใช้งาน</p>
                    )}
                  </div>
                </div>
              </div>
            )}
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
              {editBusy ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm enable/disable */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusUser?.isActive ? "Disable user" : "Enable user"}
            </DialogTitle>
            <DialogDescription>
              {statusUser?.isActive
                ? "ผู้ใช้นี้จะไม่สามารถเข้าสู่ระบบได้จนกว่าจะเปิดใช้งานอีกครั้ง"
                : "ผู้ใช้นี้จะกลับมาเข้าสู่ระบบได้ตามปกติ"}
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
              variant={statusUser?.isActive ? "destructive" : "default"}
              disabled={statusBusy}
              onClick={submitToggleActive}
            >
              {statusBusy ? "Saving..." : statusUser?.isActive ? "Disable" : "Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {resetUser ? (
                <>
                  สำหรับ <span className="font-mono">{resetUser.username}</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {resetError && (
            <Alert variant="destructive">
              <AlertDescription>{resetError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Password mode</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={resetPasswordMode === "generate" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setResetPasswordMode("generate")}
                >
                  Generate
                </Button>
                <Button
                  type="button"
                  variant={resetPasswordMode === "set" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setResetPasswordMode("set")}
                >
                  Set manually
                </Button>
              </div>
            </div>

            {resetPasswordMode === "set" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="reset_password">Password</Label>
                  <Input
                    id="reset_password"
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reset_password_confirm">Confirm</Label>
                  <Input
                    id="reset_password_confirm"
                    type="password"
                    value={resetPasswordConfirm}
                    onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={resetBusy}
              onClick={() => setResetOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={resetBusy} onClick={submitResetPassword}>
              {resetBusy ? "Saving..." : "Reset password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated password */}
      <Dialog open={generatedOpen} onOpenChange={setGeneratedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{generatedTitle}</DialogTitle>
            {generatedDescription && (
              <DialogDescription>{generatedDescription}</DialogDescription>
            )}
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="generated_password">Generated password</Label>
            <Input
              id="generated_password"
              value={generatedPassword ?? ""}
              readOnly
              className="font-mono"
            />
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={copyGenerated}>
                {copyOk ? "Copied" : "Copy"}
              </Button>
              <p className="text-xs text-muted-foreground">แสดงครั้งเดียว</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setGeneratedOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
