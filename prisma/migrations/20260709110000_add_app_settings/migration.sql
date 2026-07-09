CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "lineLockTtlSeconds" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AppSetting" ("id", "lineLockTtlSeconds", "updatedAt")
VALUES ('default', 30, CURRENT_TIMESTAMP);
