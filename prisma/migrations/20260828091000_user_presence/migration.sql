-- CreateTable
CREATE TABLE "UserPresence" (
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "path" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPresence_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "UserPresence_expiresAt_idx" ON "UserPresence"("expiresAt");

-- AddForeignKey
ALTER TABLE "UserPresence" ADD CONSTRAINT "UserPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
