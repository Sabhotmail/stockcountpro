import { z } from "zod";
import { UserRole } from "@/types/user";

const optionalNullableNumber = z.number().nullable().optional();

export const loginBodySchema = z.object({
  username: z.string().trim().min(1, "Username and password are required"),
  password: z.string().min(1, "Username and password are required"),
});

const syncLocationObjectSchema = z.object({
  code: z.string().min(1),
  name: z.string().nullable().optional(),
});

export const expressSyncBodySchema = z.object({
  date: z.string().min(1, "date is required"),
  locations: z
    .union([
      z.array(z.string().min(1)).min(1),
      z.array(syncLocationObjectSchema).min(1),
    ])
    .transform((locations): Array<{ code: string; name?: string | null }> => {
      if (typeof locations[0] === "string") {
        return (locations as string[]).map((code) => ({ code }));
      }
      return locations as Array<{ code: string; name?: string | null }>;
    }),
});

export const saveEntryBodySchema = z.object({
  qtyCase: optionalNullableNumber,
  qtyPack: optionalNullableNumber,
  qtyPiece: optionalNullableNumber,
  baseRevision: z.number().optional(),
  clientMutationId: z.string().optional(),
});

export const batchSaveEntriesBodySchema = z.object({
  items: z
    .array(
      saveEntryBodySchema.extend({
        lineId: z.string().min(1),
      }),
    )
    .min(1, "items array is required"),
});

export const saveDocumentNoteBodySchema = z.object({
  note: z.string().nullable(),
});

export const recountRequestBodySchema = z.object({
  baseVersionId: z.string().min(1),
  reason: z.string().min(1),
});

export const approveBodySchema = z.object({
  pushToExpress: z.boolean().optional(),
});

export const pushExpressBulkBodySchema = z.object({
  documentIds: z.array(z.string()).default([]),
});

export const createBranchBodySchema = z.object({
  code: z.string(),
  name: z.string(),
  expressLocationPrefix: z.string().nullable().optional(),
});

export const updateBranchBodySchema = z
  .object({
    code: z.unknown().optional(),
    name: z.string().optional(),
    expressLocationPrefix: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if ("code" in value && value.code !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Branch code cannot be changed",
        path: ["code"],
      });
    }
    if (
      value.name === undefined &&
      value.expressLocationPrefix === undefined &&
      value.isActive === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field is required",
      });
    }
  });

export const appSettingsBodySchema = z.object({
  lineLockTtlSeconds: z.number({
    error: "lineLockTtlSeconds is required",
  }),
});

export const createHubBodySchema = z.object({
  branchId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().nullable().optional(),
  suffixLetter: z.string().nullable().optional(),
});

export const updateHubBodySchema = z.object({
  name: z.string().optional(),
  shortName: z.string().nullable().optional(),
  suffixLetter: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const userRoleSchema = z.nativeEnum(UserRole);

export const createAdminUserBodySchema = z
  .object({
    name: z.string().min(1),
    username: z.string().min(1),
    role: userRoleSchema,
    branchIds: z.array(z.string()),
    hubIds: z.array(z.string()),
    passwordMode: z.enum(["set", "generate"]),
    password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.passwordMode === "set") {
      if (!data.password || data.password.length < 8) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "Password must be at least 8 characters",
        });
      }
    }
  });

export const updateAdminUserBodySchema = z.object({
  name: z.string().optional(),
  role: userRoleSchema.optional(),
  branchIds: z.array(z.string()).optional(),
  hubIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const resetAdminPasswordBodySchema = z
  .object({
    passwordMode: z.enum(["set", "generate"]),
    password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.passwordMode === "set") {
      if (!data.password || data.password.length < 8) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "Password must be at least 8 characters",
        });
      }
    }
  });

const expressDeleteLocationCodeSchema = z
  .string()
  .trim()
  .min(1, "locationCode is required")
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9]+$/.test(value), {
    message: "Invalid location code",
  });

const expressDeleteDateSchema = z
  .string()
  .trim()
  .min(1, "countDate is required")
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "countDate must be yyyy-MM-dd",
  });

export const expressDeletePreviewQuerySchema = z.object({
  countDate: expressDeleteDateSchema,
  locationCode: expressDeleteLocationCodeSchema,
});

export const expressDeleteBodySchema = z.object({
  countDate: expressDeleteDateSchema,
  locationCode: expressDeleteLocationCodeSchema,
  documentId: z.string().min(1, "documentId is required"),
  confirmPhrase: z.string().trim().min(1, "confirmPhrase is required"),
});

export const expressDeleteRetryBodySchema = z.object({
  countDate: expressDeleteDateSchema,
  locationCode: expressDeleteLocationCodeSchema,
});
