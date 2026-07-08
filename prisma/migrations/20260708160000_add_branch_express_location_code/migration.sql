-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "expressLocationCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Branch_expressLocationCode_key" ON "Branch"("expressLocationCode");

-- Seed Express location codes for prototype branches
UPDATE "Branch" SET "expressLocationCode" = '32D1' WHERE "id" = 'branch_bkk1';
UPDATE "Branch" SET "expressLocationCode" = '32F1' WHERE "id" = 'branch_bkk2';
UPDATE "Branch" SET "expressLocationCode" = '32G1' WHERE "id" = 'branch_chm';
