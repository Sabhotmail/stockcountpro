import {
  listProductCodesWithImagesOnDisk,
  productImageExistsOnDisk,
} from "@/lib/product-image-fs";
import { prisma } from "@/lib/prisma";
import type { DocumentStatus } from "@/types/count";

export type MissingProductImageDocument = {
  documentId: string;
  documentNo: string;
  status: DocumentStatus;
  branchCode: string;
  branchName: string;
};

export type MissingProductImageRow = {
  productCode: string;
  productName: string;
  documents: MissingProductImageDocument[];
};

export type ProductImageReport = {
  summary: {
    totalProductCodes: number;
    withImage: number;
    missingImage: number;
  };
  missing: MissingProductImageRow[];
};

type LineRow = {
  productCode: string;
  productName: string;
  document: {
    id: string;
    documentNo: string;
    status: DocumentStatus;
    branch: { code: string; name: string };
  };
};

/** Pure grouping used by listMissingProductImages (also unit-tested). */
export function buildProductImageReport(
  lines: LineRow[],
  imageCodes: Set<string>,
): ProductImageReport {
  type Acc = {
    productName: string;
    documents: Map<string, MissingProductImageDocument>;
  };
  const byCode = new Map<string, Acc>();

  for (const line of lines) {
    const productCode = line.productCode.trim();
    if (!productCode) continue;

    let acc = byCode.get(productCode);
    if (!acc) {
      acc = {
        productName: line.productName,
        documents: new Map(),
      };
      byCode.set(productCode, acc);
    }
    if (!acc.documents.has(line.document.id)) {
      acc.documents.set(line.document.id, {
        documentId: line.document.id,
        documentNo: line.document.documentNo,
        status: line.document.status,
        branchCode: line.document.branch.code,
        branchName: line.document.branch.name,
      });
    }
  }

  const missing: MissingProductImageRow[] = [];
  let withImage = 0;

  for (const [productCode, acc] of byCode) {
    if (productImageExistsOnDisk(productCode, { imageCodes })) {
      withImage += 1;
      continue;
    }
    const documents = [...acc.documents.values()].sort((a, b) =>
      a.documentNo.localeCompare(b.documentNo, "th"),
    );
    missing.push({
      productCode,
      productName: acc.productName,
      documents,
    });
  }

  missing.sort((a, b) => a.productCode.localeCompare(b.productCode, "th"));

  return {
    summary: {
      totalProductCodes: byCode.size,
      withImage,
      missingImage: missing.length,
    },
    missing,
  };
}

export async function listMissingProductImages(): Promise<ProductImageReport> {
  const lines = await prisma.productLine.findMany({
    select: {
      productCode: true,
      productName: true,
      document: {
        select: {
          id: true,
          documentNo: true,
          status: true,
          branch: { select: { code: true, name: true } },
        },
      },
    },
  });

  const imageCodes = listProductCodesWithImagesOnDisk();
  return buildProductImageReport(lines as LineRow[], imageCodes);
}
