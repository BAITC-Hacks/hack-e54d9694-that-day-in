import { createHash } from "node:crypto";
import { dataset } from "../../../data";
import { SimulateRequestSchema, type SimulationResponse, type ValidationError } from "../../../shared/contracts";
import { simulateScenario, validateSelections } from "../../../lib/simulation";

/** Stable key ordering; independent of JSON whitespace and object insertion order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}
const hash = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
export const catalog = { dataset_version: hash(dataset), dataset };

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function prepareScenario(input: unknown):
  | { ok: true; result: SimulationResponse }
  | { ok: false; status: 409 | 422; error: ValidationError } {
  const parsed = SimulateRequestSchema.safeParse(input);
  if (!parsed.success) {
    const field_errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (field_errors[issue.path.join(".") || "request"] ??= []).push(issue.message);
    return { ok: false, status: 422, error: { code: "invalid_request", message: "Передайте версию каталога и пять решений.", field_errors } };
  }
  if (parsed.data.dataset_version !== catalog.dataset_version) return {
    ok: false, status: 409, error: { code: "version_mismatch", message: "Каталог изменился. Загрузите /api/catalog и проверьте решения заново." },
  };
  const validation = validateSelections(dataset, parsed.data.decisions);
  if (!validation.valid) return { ok: false, status: 422, error: validation.error };
  const scenario = { dataset_version: catalog.dataset_version, decisions: validation.decisions };
  return { ok: true, result: { ...scenario, scenario_key: hash(scenario), simulation: simulateScenario(dataset, validation.decisions) } };
}

export async function readScenario(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return { ok: false as const, status: 422 as const, error: { code: "invalid_request" as const, message: "Тело запроса должно быть корректным JSON." } }; }
  return prepareScenario(input);
}
