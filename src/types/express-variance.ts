import type { ReviewLineItem } from "@/types/count";

/** Document context for Express compare pages. */
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

export type PrePushBalancesResult = {
  success: true;
  locationCode: string;
  fetchedAt: string;
  balanceByProductCode: Record<string, number | null>;
};
