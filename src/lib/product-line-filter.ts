import { canViewExpectedQty } from "@/lib/permissions";
import type { ProductLine } from "@/types/count";
import type { UserRole } from "@/types/user";

export function stripExpectedQty(lines: ProductLine[]): ProductLine[] {
  return lines.map(({ expectedQty: _expectedQty, ...rest }) => rest);
}

export function filterLinesForRole(
  lines: ProductLine[],
  role: UserRole,
): ProductLine[] {
  if (canViewExpectedQty(role)) return lines;
  return stripExpectedQty(lines);
}
