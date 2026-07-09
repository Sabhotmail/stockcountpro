-- CreateTable
CREATE TABLE "BranchExpressLocation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "locationCode" TEXT NOT NULL,

    CONSTRAINT "BranchExpressLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BranchExpressLocation_locationCode_key" ON "BranchExpressLocation"("locationCode");

-- CreateIndex
CREATE INDEX "BranchExpressLocation_branchId_idx" ON "BranchExpressLocation"("branchId");

-- AddForeignKey
ALTER TABLE "BranchExpressLocation" ADD CONSTRAINT "BranchExpressLocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single location codes
INSERT INTO "BranchExpressLocation" ("id", "branchId", "locationCode")
SELECT
    'loc_' || "id" || '_' || UPPER(TRIM("expressLocationCode")),
    "id",
    UPPER(TRIM("expressLocationCode"))
FROM "Branch"
WHERE "expressLocationCode" IS NOT NULL
  AND TRIM("expressLocationCode") <> '';

-- DropColumn
DROP INDEX IF EXISTS "Branch_expressLocationCode_key";

ALTER TABLE "Branch" DROP COLUMN "expressLocationCode";
