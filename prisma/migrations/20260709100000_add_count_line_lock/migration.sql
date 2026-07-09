CREATE TABLE "CountLineLock" (
    "documentId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "lockedByUserId" TEXT NOT NULL,
    "lockedByUserName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CountLineLock_pkey" PRIMARY KEY ("documentId","lineId")
);
CREATE INDEX "CountLineLock_documentId_expiresAt_idx" ON "CountLineLock"("documentId", "expiresAt");
ALTER TABLE "CountLineLock" ADD CONSTRAINT "CountLineLock_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CountDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CountLineLock" ADD CONSTRAINT "CountLineLock_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductLine"("lineId") ON DELETE CASCADE ON UPDATE CASCADE;
