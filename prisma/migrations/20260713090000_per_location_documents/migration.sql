-- AlterTable
ALTER TABLE "CountDocument" ADD COLUMN "locationCode" TEXT;

-- Drop old hub/central unique indexes (one doc per hub/day)
DROP INDEX IF EXISTS "CountDocument_branch_date_hub_key";
DROP INDEX IF EXISTS "CountDocument_branch_date_central_key";

-- CreateIndex
CREATE INDEX "CountDocument_branchId_documentDate_locationCode_idx"
ON "CountDocument"("branchId", "documentDate", "locationCode");

-- One document per branch/date/location (new sync model)
CREATE UNIQUE INDEX "CountDocument_branch_date_location_key"
ON "CountDocument"("branchId", "documentDate", "locationCode")
WHERE "locationCode" IS NOT NULL;
