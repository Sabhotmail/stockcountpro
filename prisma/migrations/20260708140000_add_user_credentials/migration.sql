-- Dev migration: existing mock users are re-seeded with credentials after deploy.
DELETE FROM "UserBranch";
DELETE FROM "User";

ALTER TABLE "User" ADD COLUMN "username" TEXT NOT NULL;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL;
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
