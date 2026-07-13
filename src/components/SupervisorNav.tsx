"use client";

import { useEffect, useState } from "react";
import { AppNav, type AppNavGroup } from "@/components/AppNav";
import { canAccessAdmin } from "@/lib/permissions";
import { UserRole } from "@/types/user";

export function SupervisorNav() {
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = (await res.json()) as { user?: { role?: UserRole } };
        if (!cancelled && data.user?.role) {
          setShowAdmin(canAccessAdmin(data.user.role));
        }
      } catch {
        // nav still works without Admin group
      }
    }

    void loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups: AppNavGroup[] = [
    ...(showAdmin
      ? [
          {
            label: "Admin",
            items: [
              { href: "/admin/documents", label: "เอกสาร / ประวัติ" },
              { href: "/admin/users", label: "หน้า Admin" },
            ],
          } satisfies AppNavGroup,
        ]
      : []),
    {
      label: "งานตรวจนับ",
      items: [
        {
          href: "/supervisor/documents",
          label: "เอกสารรอตรวจ / Approve",
          exact: true,
        },
        { href: "/tablet/documents", label: "นับสต็อก (Tablet)" },
      ],
    },
  ];

  return <AppNav groups={groups} />;
}
