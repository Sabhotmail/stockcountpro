-- CreateTable
CREATE TABLE "Hub" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "suffixLetter" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Hub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserHub" (
    "userId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,

    CONSTRAINT "UserHub_pkey" PRIMARY KEY ("userId","hubId")
);

-- AlterTable
ALTER TABLE "CountDocument" ADD COLUMN "hubId" TEXT;
ALTER TABLE "CountDocument" ADD COLUMN "isCentral" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Hub_branchId_code_key" ON "Hub"("branchId", "code");

-- CreateIndex
CREATE INDEX "CountDocument_branchId_documentDate_hubId_idx" ON "CountDocument"("branchId", "documentDate", "hubId");

-- Partial unique: one hub document per branch/date/hub
CREATE UNIQUE INDEX "CountDocument_branch_date_hub_key"
ON "CountDocument"("branchId", "documentDate", "hubId")
WHERE "hubId" IS NOT NULL;

-- Partial unique: one central HQ document per branch/date
CREATE UNIQUE INDEX "CountDocument_branch_date_central_key"
ON "CountDocument"("branchId", "documentDate")
WHERE "hubId" IS NULL AND "isCentral" = true;

-- AddForeignKey
ALTER TABLE "Hub" ADD CONSTRAINT "Hub_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHub" ADD CONSTRAINT "UserHub_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHub" ADD CONSTRAINT "UserHub_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountDocument" ADD CONSTRAINT "CountDocument_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE SET NULL ON UPDATE CASCADE;
