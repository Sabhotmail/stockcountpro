import { NextResponse } from "next/server";
import type { z } from "zod";

export const MAX_JSON_BODY_BYTES = 1_048_576;

export type ParseSuccess<T> = { ok: true; data: T };
export type ParseFailure = { ok: false; error: string; status?: number };
export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request body";
  const path = issue.path.map(String).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

export function parseWithSchema<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
): ParseResult<z.infer<TSchema>> {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: formatZodError(result.error) };
  }
  return { ok: true, data: result.data };
}

async function readLimitedBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array | "too-large"> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return "too-large";
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readJsonBody(
  request: Request,
): Promise<ParseResult<unknown>> {
  const declared = request.headers.get("content-length");
  if (declared !== null && !/^\d+$/.test(declared)) {
    return { ok: false, error: "Invalid JSON body" };
  }
  if (declared !== null && Number(declared) > MAX_JSON_BODY_BYTES) {
    return { ok: false, error: "Request body is too large", status: 413 };
  }

  let bytes: Uint8Array | "too-large";
  try {
    bytes = await readLimitedBody(request, MAX_JSON_BODY_BYTES);
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
  if (bytes === "too-large") {
    return { ok: false, error: "Request body is too large", status: 413 };
  }

  try {
    return { ok: true, data: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}

export function validationErrorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/** Read JSON then parse with schema. Returns typed data or a 400 Response. */
export async function parseRequestBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<
  | { ok: true; data: z.infer<TSchema> }
  | { ok: false; response: NextResponse }
> {
  const raw = await readJsonBody(request);
  if (!raw.ok) {
    return {
      ok: false,
      response: validationErrorResponse(raw.error, raw.status ?? 400),
    };
  }
  const parsed = parseWithSchema(schema, raw.data);
  if (!parsed.ok) {
    return { ok: false, response: validationErrorResponse(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}
