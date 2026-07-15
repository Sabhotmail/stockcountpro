import { NextResponse } from "next/server";
import type { z } from "zod";

export type ParseSuccess<T> = { ok: true; data: T };
export type ParseFailure = { ok: false; error: string };
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

export async function readJsonBody(
  request: Request,
): Promise<ParseResult<unknown>> {
  try {
    return { ok: true, data: await request.json() };
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
    return { ok: false, response: validationErrorResponse(raw.error) };
  }
  const parsed = parseWithSchema(schema, raw.data);
  if (!parsed.ok) {
    return { ok: false, response: validationErrorResponse(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}
