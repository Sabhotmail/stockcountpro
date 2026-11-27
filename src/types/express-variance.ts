import type { ReviewLineItem } from "@/types/count";

export type ExpressVarianceLine = {
  PhysicalBalance: number | null;
  LocationBalance: number | null;
  DifferentQty: number | null;
  CountFlag: string;
};

export type ExpressVarianceFetchResult = {
  success: true;
  countDate: string;
  locationCode: string;
  fetchedAt: string;
  varianceByProductCode: Record<string, ExpressVarianceLine>;
};

/** Standalone report page context — not tied to recount/review UI. */
export type ExpressVarianceReportContext = {
  success: true;
  document: {
    id: string;
    documentNo: string;
    documentDate: string;
    status: string;
    locationCode: string | null;
    locationName: string | null;
    branchCode: string;
    branchName: string;
  };
  lines: ReviewLineItem[];
};
