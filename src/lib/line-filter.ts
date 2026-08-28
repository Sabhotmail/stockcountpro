export type CountStatusFilter = "all" | "uncounted" | "counted";

export function filterCountableLines<
  T extends {
    productCode: string;
    productName: string;
    isCounted: boolean;
  },
>(
  lines: T[],
  filters: {
    codeFilter?: string;
    nameFilter?: string;
    showUncountedOnly?: boolean;
    countStatus?: CountStatusFilter;
    isLockedByOther?: (line: T) => boolean;
  },
): T[] {
  const code = filters.codeFilter?.trim().toLowerCase() ?? "";
  const name = filters.nameFilter?.trim().toLowerCase() ?? "";
  const countStatus: CountStatusFilter =
    filters.countStatus ?? (filters.showUncountedOnly ? "uncounted" : "all");

  return lines.filter((line) => {
    if (countStatus === "counted" && !line.isCounted) return false;
    if (countStatus === "uncounted") {
      if (line.isCounted) return false;
      if (filters.isLockedByOther?.(line)) return false;
    }
    if (code && !line.productCode.toLowerCase().includes(code)) return false;
    if (name && !line.productName.toLowerCase().includes(name)) return false;
    return true;
  });
}
