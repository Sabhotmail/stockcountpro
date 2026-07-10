export interface ExpressLoginResponse {
  success: boolean;
  token?: string;
  expire?: string;
  message?: string;
}

export interface ExpressStockCountLine {
  LocationCode: string;
  ProductCode: string;
  ProductName: string;
  Area: string;
  CountDate: string;
  CaseQty: number;
  CaseUnitCode: string;
  CaseUnitName: string;
  CaseUnitFactor: number;
  PieceQty: number;
  PhysicalBalance: number;
  TransactionValue: number;
  CountFlag: string;
  DifferentQty: number;
  DifferentValue: number;
  DocumentNumber: string;
  SequenceNumber: string;
  UserID: string;
  ChangedDate: string;
}

export interface ExpressCountDateResponse {
  success: boolean;
  message?: string;
  stockCountData?: ExpressStockCountLine[];
}

export interface ExpressLocationItem {
  LocationCode: string;
  LocationName?: string;
  [key: string]: unknown;
}

export interface ExpressLocationsResponse {
  success: boolean;
  message?: string;
  /** Actual Express field for locations-by-countdate */
  locationData?: ExpressLocationItem[];
  locations?: ExpressLocationItem[];
  data?: ExpressLocationItem[];
  stockCountLocations?: ExpressLocationItem[];
}

export interface ExpressCountDateByLocationsResponse {
  success: boolean;
  message?: string;
  stockCountData?: ExpressStockCountLine[];
}
