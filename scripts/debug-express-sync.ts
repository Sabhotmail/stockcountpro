import { fetchExpressCountDate } from "../src/services/express-api.service";
import { prisma } from "../src/lib/prisma";

import { todayDateKeyBangkok } from "../src/lib/datetime";

const date = process.argv[2] ?? todayDateKeyBangkok();

async function main() {
  const result = await fetchExpressCountDate(date);
  if ("error" in result) {
    console.log("ERROR", result.error);
    process.exit(1);
  }

  const lines = result.stockCountData ?? [];
  const byLocation = new Map<string, { area: string; count: number }>();
  for (const line of lines) {
    const key = line.LocationCode;
    const bucket = byLocation.get(key) ?? {
      area: line.Area ?? "",
      count: 0,
    };
    bucket.count += 1;
    byLocation.set(key, bucket);
  }

  console.log("Date:", date);
  console.log("Total lines:", lines.length);
  console.log(
    "Locations:",
    [...byLocation.entries()].map(([code, info]) => ({
      LocationCode: code,
      Area: info.area,
      lineCount: info.count,
    })),
  );

  if (lines[0]) {
    console.log(
      "Sample:",
      JSON.stringify(
        {
          LocationCode: lines[0].LocationCode,
          DocumentNumber: lines[0].DocumentNumber,
          CountDate: lines[0].CountDate,
        },
        null,
        2,
      ),
    );
  }

  const branches = await prisma.branch.findMany();
  console.log(
    "DB branches:",
    branches.map((b) => ({
      code: b.code,
      id: b.id,
      expressLocationPrefix: b.expressLocationPrefix,
    })),
  );

  const docs = await prisma.countDocument.findMany({
    select: {
      id: true,
      documentNo: true,
      branchId: true,
      status: true,
      documentDate: true,
    },
    orderBy: { documentDate: "desc" },
  });
  console.log("DB documents:", docs);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
