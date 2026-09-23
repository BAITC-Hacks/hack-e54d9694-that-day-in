import { dataset } from "../../../data";
import { analyzeEvidence, AiFailure, validateAnalysis } from "../../../lib/ai/analyze";
import { buildEvidence } from "../../../lib/ai/evidence";
import { DEFAULT_MODEL, PROMPT_VERSION } from "../../../lib/ai/prompt";
import { buildSlides, slidesToMarkdown } from "../../../lib/simulation/presentation";
import { PresentationRequestSchema, PresentationResponseSchema } from "../../../shared/features";
import { readFeatureInput } from "./feature-input";
import { jsonResponse, prepareScenario } from "./scenario";

export function createPresentationHandler(run: typeof analyzeEvidence = analyzeEvidence) {
  return async (request: Request) => {
    const input = await readFeatureInput(request, PresentationRequestSchema);
    if (!input.ok) return input.response;
    const prepared = prepareScenario({ dataset_version: input.data.dataset_version, decisions: input.data.decisions });
    if (!prepared.ok) return jsonResponse(prepared.error, prepared.status);
    const source = prepared.result;
    const title = input.data.title ?? "Аким на 5 часов — решение команды";
    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
    const evidence = buildEvidence(dataset, source);
    let analysis = null;
    let ai_error = null;
    try { analysis = validateAnalysis(await run(evidence, { apiKey: process.env.OPENAI_API_KEY, model }), evidence); }
    catch (error) {
      const failure = error instanceof AiFailure ? error : new AiFailure("provider_error", "AI недоступен. Расчётные слайды сохранены.");
      ai_error = { code: failure.code, message: failure.message };
    }
    const slides = buildSlides(dataset, source, analysis);
    return jsonResponse(PresentationResponseSchema.parse({ source, title, slides, markdown: slidesToMarkdown(title, slides),
      status: ai_error ? "ai_unavailable" : "complete", ai_error, evidence, model, prompt_version: PROMPT_VERSION }), ai_error ? 503 : 200);
  };
}
