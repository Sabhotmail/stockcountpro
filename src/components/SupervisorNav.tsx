"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { buildAppNavGroups } from "@/lib/nav-groups";
import { canSupervise } from "@/lib/permissions";
import { UserRole } from "@/types/user";

export function SupervisorNav() {
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
        // keep placeholder until role loads
      }
    }

    void loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  if (role && !canSupervise(role)) return null;

  // Before role loads: ops-only without Express delete (safe for Branch Manager).
  // Admin/HQ expand to full menu once role resolves.
  const groups = buildAppNavGroups(role ?? UserRole.BRANCH_MANAGER);

  return <AppNav groups={groups} />;
}
