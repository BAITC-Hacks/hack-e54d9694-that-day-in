import { dataset } from "../../../data";
import { AiFailure } from "../../../lib/ai/analyze";
import { buildEvidence } from "../../../lib/ai/evidence";
import { DEFAULT_MODEL } from "../../../lib/ai/prompt";
import { explainRecommendations, RECOMMENDATIONS_PROMPT_VERSION, validateRecommendationNotes } from "../../../lib/ai/recommendations";
import { recommendScenarios } from "../../../lib/simulation/recommendations";
import { SimulateRequestSchema } from "../../../shared/contracts";
import { RecommendationsResponseSchema } from "../../../shared/features";
import { readFeatureInput } from "./feature-input";
import { jsonResponse, prepareScenario } from "./scenario";

export function createRecommendationsHandler(run: typeof explainRecommendations = explainRecommendations) {
  return async (request: Request) => {
    const input = await readFeatureInput(request, SimulateRequestSchema);
    if (!input.ok) return input.response;
    const prepared = prepareScenario(input.data);
    if (!prepared.ok) return jsonResponse(prepared.error, prepared.status);
    const source = prepared.result;
    const candidates = recommendScenarios(dataset, source.decisions);
    const evidence = buildEvidence(dataset, source);
    for (const c of candidates) evidence.push({ id: `candidate:${c.id}`, label: "Проверенная замена и результат",
      value: JSON.stringify({ id: c.id, removed: c.removed, added: c.added,
        measure: dataset.measures.find(m => m.id === c.added.measure_id), score_gain: c.score_gain,
        cost_delta: c.cost_delta, budget: c.simulation.budget, after: c.simulation.after, districts: c.simulation.districts }) });
    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
    const base = { source, search: "single_replacement", candidates, evidence, model, prompt_version: RECOMMENDATIONS_PROMPT_VERSION };
    if (!candidates.length) return jsonResponse(RecommendationsResponseSchema.parse({ ...base, status: "no_improvement", notes: null, ai_error: null }));
    try {
      const candidateIds = candidates.map(c => c.id);
      const notes = validateRecommendationNotes(await run(evidence, candidateIds, { apiKey: process.env.OPENAI_API_KEY, model }), evidence, candidateIds);
      return jsonResponse(RecommendationsResponseSchema.parse({ ...base, status: "complete", notes, ai_error: null }));
    } catch (error) {
      const failure = error instanceof AiFailure ? error : new AiFailure("provider_error", "AI недоступен. Варианты улучшений рассчитаны.");
      return jsonResponse(RecommendationsResponseSchema.parse({ ...base, status: "ai_unavailable", notes: null, ai_error: { code: failure.code, message: failure.message } }), 503);
    }
  };
}
