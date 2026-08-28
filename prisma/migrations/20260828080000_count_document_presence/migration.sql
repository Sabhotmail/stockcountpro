-- CreateTable
CREATE TABLE "CountDocumentPresence" (
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountDocumentPresence_pkey" PRIMARY KEY ("documentId","userId")
);

-- CreateIndex
CREATE INDEX "CountDocumentPresence_documentId_expiresAt_idx" ON "CountDocumentPresence"("documentId", "expiresAt");

-- AddForeignKey
ALTER TABLE "CountDocumentPresence" ADD CONSTRAINT "CountDocumentPresence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CountDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
