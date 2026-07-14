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
  },
): T[] {
  const code = filters.codeFilter?.trim().toLowerCase() ?? "";
  const name = filters.nameFilter?.trim().toLowerCase() ?? "";

  return lines.filter((line) => {
    if (filters.showUncountedOnly && line.isCounted) return false;
    if (code && !line.productCode.toLowerCase().includes(code)) return false;
    if (name && !line.productName.toLowerCase().includes(name)) return false;
    return true;
  });
}
