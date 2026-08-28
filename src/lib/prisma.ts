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

function hasUserPresence(client: PrismaClient): boolean {
  return typeof client.userPresence?.deleteMany === "function";
}

function resolvePrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  const fingerprintChanged =
    existing != null &&
    globalForPrisma.prismaSchemaFingerprint !== SCHEMA_FINGERPRINT;

  if (existing && fingerprintChanged) {
    void existing.$disconnect();
    globalForPrisma.prisma = undefined;
  } else if (existing && !hasUserPresence(existing)) {
    const replacement = createPrismaClient();
    if (hasUserPresence(replacement)) {
      void existing.$disconnect();
      globalForPrisma.prisma = replacement;
    } else {
      void replacement.$disconnect();
    }
  }

  return globalForPrisma.prisma ?? createPrismaClient();
}

export const prisma = resolvePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaFingerprint = SCHEMA_FINGERPRINT;
}
