"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { buildAppNavGroups } from "@/lib/nav-groups";
import { canAccessAdmin } from "@/lib/permissions";
import { UserRole } from "@/types/user";

export function AdminNav() {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = (await res.json()) as { user?: { role?: UserRole } };
        if (!cancelled && data.user?.role) {
          setRole(data.user.role);
        }
      } catch {
        // keep default HQ-safe nav until role loads
      }
    }

    void loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  // Before role loads, show HQ-safe menus (buildAppNavGroups(null)).
  if (role && !canAccessAdmin(role)) return null;

  return <AppNav groups={buildAppNavGroups(role)} />;
}
