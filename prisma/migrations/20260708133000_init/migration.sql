-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'HQ', 'SUPERVISOR', 'BRANCH_MANAGER', 'STAFF', 'COUNTER', 'VIEWER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('IMPORTED', 'COUNTING', 'SUBMITTED', 'REVIEWING', 'RECOUNT_REQUESTED', 'APPROVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RECOUNT', 'APPROVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'OPEN_DOCUMENT', 'START_COUNT', 'AUTO_SAVE_COUNT', 'SUBMIT_TO_SUPERVISOR', 'CREATE_VERSION', 'REQUEST_RECOUNT', 'APPROVE_VERSION', 'COMPLETE_DOCUMENT');

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBranch" (
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("userId","branchId")
);

-- CreateTable
CREATE TABLE "CountDocument" (
    "id" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "documentDate" DATE NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL,
    "currentVersionId" TEXT,
    "currentVersionNo" INTEGER NOT NULL DEFAULT 0,
    "totalLines" INTEGER NOT NULL,
    "countedLines" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductLine" (
    "lineId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productImageUrl" TEXT,
    "barcode" TEXT NOT NULL,
    "unitCaseName" TEXT,
    "unitPackName" TEXT,
    "unitPieceName" TEXT NOT NULL,
    "caseRatio" INTEGER NOT NULL,
    "packRatio" INTEGER NOT NULL,
    "allowCase" BOOLEAN NOT NULL,
    "allowPack" BOOLEAN NOT NULL,
    "allowPiece" BOOLEAN NOT NULL,
    "expectedQty" INTEGER,

    CONSTRAINT "ProductLine_pkey" PRIMARY KEY ("lineId")
);

-- CreateTable
CREATE TABLE "CountVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "status" "VersionStatus" NOT NULL,
    "baseVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,

    CONSTRAINT "CountVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountEntry" (
    "lineId" TEXT NOT NULL,
    "qtyCase" INTEGER,
    "qtyPack" INTEGER,
    "qtyPiece" INTEGER,
    "totalBaseQty" INTEGER,
    "note" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "CountEntry_pkey" PRIMARY KEY ("lineId")
);

-- CreateTable
CREATE TABLE "EntrySnapshot" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "qtyCase" INTEGER,
    "qtyPack" INTEGER,
    "qtyPiece" INTEGER,
    "totalBaseQty" INTEGER,
    "note" TEXT,
    "revision" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "EntrySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalCountEntry" (
    "documentId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "qtyCase" INTEGER,
    "qtyPack" INTEGER,
    "qtyPiece" INTEGER,
    "totalBaseQty" INTEGER,
    "note" TEXT,
    "revision" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "FinalCountEntry_pkey" PRIMARY KEY ("documentId","lineId")
);

-- CreateTable
CREATE TABLE "RecountRequest" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "baseVersionId" TEXT NOT NULL,
    "newVersionId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecountRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecountRequestItem" (
    "id" TEXT NOT NULL,
    "recountRequestId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "RecountRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "branchId" TEXT,
    "documentId" TEXT,
    "versionId" TEXT,
    "lineId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "ProductLine_documentId_idx" ON "ProductLine"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "CountVersion_documentId_versionNo_key" ON "CountVersion"("documentId", "versionNo");

-- CreateIndex
CREATE INDEX "EntrySnapshot_versionId_idx" ON "EntrySnapshot"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "EntrySnapshot_versionId_lineId_key" ON "EntrySnapshot"("versionId", "lineId");

-- CreateIndex
CREATE INDEX "AuditLog_documentId_createdAt_idx" ON "AuditLog"("documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountDocument" ADD CONSTRAINT "CountDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLine" ADD CONSTRAINT "ProductLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CountDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountVersion" ADD CONSTRAINT "CountVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CountDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductLine"("lineId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntrySnapshot" ADD CONSTRAINT "EntrySnapshot_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CountVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntrySnapshot" ADD CONSTRAINT "EntrySnapshot_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductLine"("lineId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalCountEntry" ADD CONSTRAINT "FinalCountEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CountDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalCountEntry" ADD CONSTRAINT "FinalCountEntry_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductLine"("lineId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecountRequest" ADD CONSTRAINT "RecountRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CountDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecountRequestItem" ADD CONSTRAINT "RecountRequestItem_recountRequestId_fkey" FOREIGN KEY ("recountRequestId") REFERENCES "RecountRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CountDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
