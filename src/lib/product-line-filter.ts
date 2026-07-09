import { isExpressFieldNotCounted } from "@/lib/express-expected-qty";
import { canViewExpectedQty } from "@/lib/permissions";
import type { ProductLine } from "@/types/count";
import type { UserRole } from "@/types/user";

export function stripExpectedQty(lines: ProductLine[]): ProductLine[] {
  return lines.map(
    ({
      expectedQty: _expectedQty,
      expectedQtyCase: _expectedQtyCase,
      expectedQtyPiece: _expectedQtyPiece,
      ...rest
    }) => ({
      ...rest,
      expressCaseNotCounted: isExpressFieldNotCounted(_expectedQtyCase),
      expressPieceNotCounted: isExpressFieldNotCounted(_expectedQtyPiece),
    }),
  );
}

export function filterLinesForRole(
  lines: ProductLine[],
  role: UserRole,
): ProductLine[] {
  if (canViewExpectedQty(role)) return lines;
  return stripExpectedQty(lines);
}
