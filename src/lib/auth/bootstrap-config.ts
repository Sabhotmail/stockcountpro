/**
 * Production bootstrap (option 2): create the first ADMIN from secrets once.
 * Password must come from env / secret store — never from the UI or committed defaults.
 */

export type AdminBootstrapConfig = {
  username: string;
  password: string;
  name: string;
  branchCode: string | null;
  force: boolean;
};

const DEV_FALLBACK_PASSWORD = "12345678";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function isProductionNodeEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Resolves admin bootstrap credentials from environment.
 * In production, ADMIN_BOOTSTRAP_PASSWORD is required (no fallback).
 * In development, falls back to a local-only default when unset (for seed convenience).
 */
export function resolveAdminBootstrapConfig(options?: {
  requirePassword?: boolean;
}): AdminBootstrapConfig {
  const requirePassword =
    options?.requirePassword ?? isProductionNodeEnv();

  const username = (
    readEnv("ADMIN_BOOTSTRAP_USERNAME") ?? "admin"
  ).toLowerCase();
  const name = readEnv("ADMIN_BOOTSTRAP_NAME") ?? "Admin";
  const branchCode = readEnv("ADMIN_BOOTSTRAP_BRANCH_CODE") ?? "BKK3";
  const force =
    readEnv("ADMIN_BOOTSTRAP_FORCE") === "1" ||
    readEnv("ADMIN_BOOTSTRAP_FORCE")?.toLowerCase() === "true";

  let password = readEnv("ADMIN_BOOTSTRAP_PASSWORD");
  if (!password) {
    if (requirePassword) {
      throw new Error(
        "ADMIN_BOOTSTRAP_PASSWORD is required. Set it in the environment or secret store.",
      );
    }
    password = DEV_FALLBACK_PASSWORD;
  }

  if (password.length < 8) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 8 characters.");
  }

  return {
    username,
    password,
    name,
    branchCode,
    force,
  };
}

