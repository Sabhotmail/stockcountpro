/**
 * Create the PostgreSQL database named in DATABASE_URL if it does not exist.
 * Connects to the `postgres` maintenance database on the same server.
 *
 * Usage: npm run db:create:test
 */

import { PrismaClient } from "@prisma/client";
import { databaseNameFromUrl } from "../src/lib/app-env";

function maintenanceUrl(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  parsed.pathname = "/postgres";
  return parsed.toString();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const name = databaseNameFromUrl(databaseUrl);
  if (!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(name)) {
    throw new Error(`Refusing to create database with unsafe name "${name}"`);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: maintenanceUrl(databaseUrl) } },
  });

  try {
    const found = await prisma.$queryRaw<Array<{ datname: string }>>`
      SELECT datname FROM pg_database WHERE datname = ${name}
    `;
    if (found.length > 0) {
      console.log(`Database "${name}" already exists.`);
      return;
    }
    await prisma.$executeRawUnsafe(`CREATE DATABASE ${name}`);
    console.log(`Created database "${name}".`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
