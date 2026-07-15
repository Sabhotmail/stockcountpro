-- CreateTable
CREATE TABLE "ProcessedMutation" (
    "id" TEXT NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "lineId" TEXT,
    "responseJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedMutation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessedMutation_documentId_createdAt_idx" ON "ProcessedMutation"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedMutation_userId_clientMutationId_key" ON "ProcessedMutation"("userId", "clientMutationId");
