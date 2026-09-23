// Server module: never import from shared contracts, UI or browser-side simulation.
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AiAnalysisSchema, type AiAnalysis, type AiError, type EvidenceFact } from "../../shared/contracts";
import { ANALYSIS_INSTRUCTIONS, DEFAULT_MODEL } from "./prompt";

export const AI_TIMEOUT_MS = 45_000;
export class AiFailure extends Error {
  constructor(public readonly code: AiError["code"], message: string) { super(message); this.name = "AiFailure"; }
}
export type TransportInput = { model: string; evidence: EvidenceFact[]; signal: AbortSignal };
export type AiTransport = (input: TransportInput) => Promise<{ status: string; parsed: unknown; refused: boolean }>;

export function createOpenAiTransport(apiKey: string): AiTransport {
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: AI_TIMEOUT_MS });
  return async ({ model, evidence, signal }) => {
    const response = await client.responses.parse({
      model, store: false, instructions: ANALYSIS_INSTRUCTIONS,
      input: JSON.stringify({ evidence }), reasoning: { effort: "low" }, max_output_tokens: 3500,
      text: { format: zodTextFormat(AiAnalysisSchema, "scenario_explanation") },
    }, { signal, maxRetries: 0 });
    const refused = response.output.some(item => item.type === "message" && item.content.some(part => part.type === "refusal"));
    return { status: response.status ?? "unknown", parsed: response.output_parsed, refused };
  };
}

export function validateAnalysis(input: unknown, evidence: EvidenceFact[]): AiAnalysis {
  const result = AiAnalysisSchema.safeParse(input);
  if (!result.success) throw new AiFailure("invalid_response", "AI вернул ответ, не соответствующий формату объяснения.");
  const ids = new Set(evidence.map(f => f.id));
  const items = [...result.data.strengths, ...result.data.risks, ...result.data.consequences];
  if (items.some(item => item.evidence_ids.some(id => !ids.has(id)))) throw new AiFailure("invalid_response", "AI сослался на неизвестные факты.");
  return result.data;
}

/** Shared total deadline for explanation and review extraction calls. */
export async function withAiDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs = AI_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = Math.max(1, Math.min(timeoutMs, AI_TIMEOUT_MS));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new AiFailure("timeout", "AI не ответил за отведённые 45 секунд. Расчёт сохранён."));
        controller.abort();
      }, timeout);
    });
    return await Promise.race([deadline, operation(controller.signal)]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** One total deadline, a cancellable HTTP call, zero hidden retries. */
export async function analyzeEvidence(evidence: EvidenceFact[], options: {
  apiKey?: string; model?: string; transport?: AiTransport; timeoutMs?: number;
} = {}): Promise<AiAnalysis> {
  if (!options.transport && !options.apiKey) throw new AiFailure("missing_api_key", "На сервере не задан OPENAI_API_KEY.");
  try {
    const transport = options.transport ?? createOpenAiTransport(options.apiKey!);
    const result = await withAiDeadline(signal => transport({ model: options.model ?? DEFAULT_MODEL, evidence, signal }), options.timeoutMs);
    if (result.refused) throw new AiFailure("refusal", "AI отказался формировать объяснение. Расчёт сохранён.");
    if (result.status !== "completed") throw new AiFailure("invalid_response", "AI не завершил объяснение. Расчёт сохранён.");
    return validateAnalysis(result.parsed, evidence);
  } catch (error) {
    if (error instanceof AiFailure) throw error;
    if (error instanceof OpenAI.APIConnectionTimeoutError) throw new AiFailure("timeout", "Превышено время ожидания AI. Расчёт сохранён.");
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) throw new AiFailure("invalid_response", "Не удалось проверить ответ AI. Расчёт сохранён.");
    // Never expose provider messages, request bodies or credentials in API errors.
    throw new AiFailure("provider_error", "Сервис AI недоступен. Расчёт сохранён; можно повторить запрос позже.");
  }
}
