"use client";

import { useEffect, useState } from "react";
import { AppNav, type AppNavGroup } from "@/components/AppNav";
import { canAccessAdmin } from "@/lib/permissions";
import { UserRole } from "@/types/user";

export function SupervisorNav() {
  const [showHqArea, setShowHqArea] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = (await res.json()) as { user?: { role?: UserRole } };
        if (!cancelled && data.user?.role) {
          setShowHqArea(canAccessAdmin(data.user.role));
        }
      } catch {
        // nav still works without HQ group
      }
    }

    void loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups: AppNavGroup[] = [
    ...(showHqArea
      ? [
          {
            label: "ประวัติ",
            items: [
              { href: "/admin/documents", label: "เอกสาร / ประวัติ" },
              { href: "/admin/audit-logs", label: "Audit Log" },
            ],
          } satisfies AppNavGroup,
        ]
      : []),
    {
      label: "งานตรวจนับ",
      items: [
        {
          href: "/supervisor/documents",
          label: "รออนุมัติ",
          exact: true,
        },
        { href: "/tablet/documents", label: "นับสต็อก" },
      ],
    },
  ];

  return <AppNav groups={groups} />;
}
