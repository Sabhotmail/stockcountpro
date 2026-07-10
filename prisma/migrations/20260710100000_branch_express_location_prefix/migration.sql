-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "expressLocationPrefix" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Branch_expressLocationPrefix_key" ON "Branch"("expressLocationPrefix");

-- DropTable
DROP TABLE IF EXISTS "BranchExpressLocation";
