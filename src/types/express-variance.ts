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
