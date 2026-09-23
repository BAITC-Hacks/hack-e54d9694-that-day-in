import { createHash } from "node:crypto";
import { dataset } from "../../../data";
import { FeedbackRequestSchema, FeedbackResponseSchema, type Review, type ReviewExtraction } from "../../../shared/feedback";
import { extractReviewSignals, REVIEW_PROMPT_VERSION } from "../../../lib/ai/reviews";
import { AiFailure } from "../../../lib/ai/analyze";
import { DEFAULT_MODEL } from "../../../lib/ai/prompt";
import { FEEDBACK_POLICY, FEEDBACK_POLICY_VERSION, prepareReviews, projectFeedback } from "../../../lib/feedback/projection";
import { canonicalJson, catalog, jsonResponse } from "./scenario";

type Extractor = (data: typeof dataset, reviews: Review[], options: { apiKey?: string; model: string }) => Promise<ReviewExtraction>;
export function createFeedbackHandler(extract: Extractor = extractReviewSignals, now: () => Date = () => new Date()) {
  return async (request: Request): Promise<Response> => {
    let raw: unknown;
    try { raw = await request.json(); }
    catch { return jsonResponse({ code: "invalid_request", message: "Нужен корректный JSON." }, 422); }
    const parsed = FeedbackRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const field_errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) (field_errors[issue.path.join(".") || "request"] ??= []).push(issue.message);
      return jsonResponse({ code: "invalid_request", message: "Проверьте список отзывов.", field_errors }, 422);
    }
    if (parsed.data.dataset_version !== catalog.dataset_version) return jsonResponse({ code: "version_mismatch", message: "Обновите каталог перед обработкой отзывов." }, 409);
    const known = new Set(dataset.districts.map(d => d.id));
    if (parsed.data.reviews.some(r => r.district_id !== null && !known.has(r.district_id))) return jsonResponse({ code: "invalid_request", message: "У отзыва указан неизвестный район." }, 422);
    const evaluated = now();
    let prepared: ReturnType<typeof prepareReviews>;
    try { prepared = prepareReviews(parsed.data.reviews, evaluated); }
    catch { return jsonResponse({ code: "invalid_request", message: "Дата отзыва некорректна или находится в будущем." }, 422); }
    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
    const base = {
      dataset_version: catalog.dataset_version, evaluated_at: evaluated.toISOString(), mode: "experimental_feedback_projection" as const,
      review_batch_key: createHash("sha256").update(canonicalJson({ dataset_version: catalog.dataset_version,
        policy_version: FEEDBACK_POLICY_VERSION, prompt_version: REVIEW_PROMPT_VERSION, model, reviews: prepared.eligible })).digest("hex"),
      policy_version: FEEDBACK_POLICY_VERSION, prompt_version: REVIEW_PROMPT_VERSION, policy: FEEDBACK_POLICY, model,
      reviews: { received: parsed.data.reviews.length, eligible: prepared.eligible.length,
        duplicate_ids: prepared.duplicate_ids, stale_ids: prepared.stale_ids, eligible_ids: prepared.eligible.map(r => r.id) },
      limitations: [
        "Экспериментальная оценка по отзывам, не подтверждённые измерения качества жизни.",
        "Разные тексты не доказывают независимость авторов; защита от организованной накрутки не обеспечивается.",
        "Порог уверенности AI описывает интерпретацию текста, а не достоверность жалобы.",
        "Шаг изменения показателей — демонстрационная эвристика, не откалиброванная на реальных данных.",
        "Снимок рассчитан от исходного датасета. Он не сохраняется на сервере и не меняет игровой каталог.",
      ],
    };
    try {
      const extraction = prepared.eligible.length ? await extract(dataset, prepared.eligible, { apiKey: process.env.OPENAI_API_KEY, model }) : { signals: [] };
      let projection;
      try { projection = projectFeedback(dataset, prepared.eligible, extraction); }
      catch { throw new AiFailure("invalid_response", "Некорректный разбор отзывов. Показатели не изменены."); }
      return jsonResponse(FeedbackResponseSchema.parse({ ...base, status: "complete", extraction, projection, ai_error: null }));
    } catch (error) {
      const failure = error instanceof AiFailure ? error : new AiFailure("provider_error", "Разбор отзывов недоступен. Показатели не изменены.");
      return jsonResponse(FeedbackResponseSchema.parse({ ...base, status: "ai_unavailable", extraction: null,
        projection: projectFeedback(dataset, [], { signals: [] }), ai_error: { code: failure.code, message: failure.message } }), 503);
    }
  };
}
