import { Prisma, PrismaClient } from "@prisma/client";

const SCHEMA_FINGERPRINT = Object.values(Prisma.ModelName).join(",");

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  prismaSchemaFingerprint?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

if (
  globalForPrisma.prisma &&
  globalForPrisma.prismaSchemaFingerprint !== SCHEMA_FINGERPRINT
) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaFingerprint = SCHEMA_FINGERPRINT;
}
