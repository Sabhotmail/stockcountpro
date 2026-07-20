import type { AppNavGroup } from "@/components/AppNav";
import {
  canAccessAdmin,
  canDeleteExpressStockCount,
  canManageSystem,
  canSupervise,
} from "@/lib/permissions";
import { UserRole } from "@/types/user";

function workMainGroup(dashboardHref: string): AppNavGroup {
  return {
    label: "งานหลัก",
    items: [
      { href: dashboardHref, label: "ภาพรวม", exact: true },
      { href: "/admin/documents", label: "เอกสาร" },
      { href: "/admin/audit-logs", label: "บันทึกการใช้งาน" },
    ],
  };
}

const systemGroup: AppNavGroup = {
  label: "ตั้งค่าระบบ",
  items: [
    { href: "/admin/users", label: "ผู้ใช้" },
    { href: "/admin/branches", label: "สาขา" },
    { href: "/admin/hubs", label: "ศูนย์กระจาย" },
    { href: "/admin/settings", label: "ตั้งค่า" },
  ],
};

function opsItems(options: {
  includeDashboard?: boolean;
  dashboardHref?: string;
  includeExpressDelete: boolean;
  expressDeleteHref: string;
}): AppNavGroup["items"] {
  const items: AppNavGroup["items"] = [];
  if (options.includeDashboard && options.dashboardHref) {
    items.push({
      href: options.dashboardHref,
      label: "ภาพรวม",
      exact: true,
    });
  }
  items.push(
    { href: "/supervisor/documents", label: "รออนุมัติ", exact: true },
    { href: "/tablet/documents", label: "นับสต็อก" },
  );
  if (options.includeExpressDelete) {
    items.push({
      href: options.expressDeleteHref,
      label: "ลบรายการนับ Express",
    });
  }
  return items;
}

/**
 * Shared nav groups for AdminNav / SupervisorNav.
 * Admin sees every item; other roles are gated by permissions.
 */
export function buildAppNavGroups(role: UserRole | null): AppNavGroup[] {
  // Until role loads: HQ-safe admin shell (no system settings).
  if (role === null) {
    return [
      workMainGroup("/admin/dashboard"),
      {
        label: "ปฏิบัติงาน",
        items: opsItems({
          includeExpressDelete: true,
          expressDeleteHref: "/admin/express-delete",
        }),
      },
    ];
  }

  if (canAccessAdmin(role)) {
    const groups: AppNavGroup[] = [
      workMainGroup("/admin/dashboard"),
    ];
    if (canManageSystem(role)) {
      groups.push(systemGroup);
    }
    groups.push({
      label: "ปฏิบัติงาน",
      items: opsItems({
        includeExpressDelete: canDeleteExpressStockCount(role),
        expressDeleteHref: "/admin/express-delete",
      }),
    });
    return groups;
  }

  if (canSupervise(role)) {
    return [
      {
        label: "ปฏิบัติงาน",
        items: opsItems({
          includeDashboard: true,
          dashboardHref: "/supervisor/dashboard",
          includeExpressDelete: canDeleteExpressStockCount(role),
          expressDeleteHref: "/supervisor/express-delete",
        }),
      },
    ];
  }

  return [];
}
