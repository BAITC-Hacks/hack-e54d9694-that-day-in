import { dataset } from "../../../data";
import { analyzeEvidence, AiFailure } from "../../../lib/ai/analyze";
import { buildEvidence } from "../../../lib/ai/evidence";
import { DEFAULT_MODEL, PROMPT_VERSION } from "../../../lib/ai/prompt";
import { AnalysisResponseSchema, type AiAnalysis, type EvidenceFact } from "../../../shared/contracts";
import { jsonResponse, readScenario } from "./scenario";

type Runner = (facts: EvidenceFact[], options: { apiKey?: string; model: string }) => Promise<AiAnalysis>;
/** Dependency injection is confined to server code and offline tests. */
export function createAnalyzeHandler(run: Runner = analyzeEvidence) {
  return async function POST(request: Request): Promise<Response> {
    const prepared = await readScenario(request);
    if (!prepared.ok) return jsonResponse(prepared.error, prepared.status);
    const evidence = buildEvidence(dataset, prepared.result);
    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
    const base = { ...prepared.result, evidence, created_at: new Date().toISOString(), model, prompt_version: PROMPT_VERSION };
    try {
      const analysis = await run(evidence, { apiKey: process.env.OPENAI_API_KEY, model });
      return jsonResponse(AnalysisResponseSchema.parse({ ...base, status: "complete", analysis, ai_error: null }));
    } catch (error) {
      const failure = error instanceof AiFailure ? error : new AiFailure("provider_error", "AI недоступен. Расчёт сохранён.");
      return jsonResponse(AnalysisResponseSchema.parse({ ...base, status: "ai_unavailable", analysis: null,
        ai_error: { code: failure.code, message: failure.message } }), 503);
    }
  };
}
