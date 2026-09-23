import { z } from "zod";
import { jsonResponse } from "./scenario";

/** Bounded JSON reader shared by the new endpoints; no body or credentials in errors. */
export async function readFeatureInput<T>(request: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const invalid = (status: number) => ({ ok: false as const, response: jsonResponse({ code: "invalid_request", message: "Некорректный запрос или превышен размер 32 КБ." }, status) });
  if (!request.body) return invalid(422);
  const reader = request.body.getReader();
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 32768) { await reader.cancel(); return invalid(413); }
      chunks.push(next.value);
    }
    const parsed = schema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    return parsed.success ? { ok: true, data: parsed.data } : invalid(422);
  } catch { return invalid(422); }
  finally { reader.releaseLock(); }
}
