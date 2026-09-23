/** TEST DATA ONLY. Uses the authoritative JSON; explanations are handwritten UI placeholders. */
import rawDataset from "../../dataset/dataset.json";
import { CatalogSchema, SimulateRequestSchema, SimulationResponseSchema, AnalysisResponseSchema,
  INDICATOR_CODES, type Metrics } from "./contracts";

export const fixtureCatalog = CatalogSchema.parse({ dataset_version: "fixture-only", dataset: rawDataset });
export const fixtureDraftSelections = [];
export const fixtureSimulateRequest = SimulateRequestSchema.parse({
  dataset_version: fixtureCatalog.dataset_version, decisions: rawDataset.example.decisions,
});
export const fixtureAnalyzeRequest = fixtureSimulateRequest;
const zeros = (): Metrics => Object.fromEntries(INDICATOR_CODES.map(k => [k, 0])) as Metrics;
const effect = (values: Partial<Metrics>): Metrics => ({ ...zeros(), ...values });
const districts = fixtureCatalog.dataset.districts.map(d => {
  const delta = effect({ C2: 4.375 });
  if (d.id === "nura") Object.assign(delta, { S1: 10, S2: 8.75, B1: 12.5, B2: 1.75 });
  if (d.id === "saryarka") Object.assign(delta, { E2: 8.75, C1: 2.5 });
  const after = Object.fromEntries(INDICATOR_CODES.map(k => [k, d.indicators[k] + delta[k]]));
  return { district_id: d.id, before: d.indicators, after, delta };
});
export const fixtureSimulation = SimulationResponseSchema.parse({
  ...fixtureSimulateRequest, scenario_key: "fixture-only-example-95",
  simulation: {
    budget: { initial: 100, spent: 95, remaining: 5 }, districts,
    before: rawDataset.baseline, after: rawDataset.example.result, score_delta: 3.98539,
    contributions: [
      { measure_id: "M5", district_id: "saryarka", factor: 0.625, deltas: effect({ E2: 8.75, C1: 2.5 }) },
      { measure_id: "M7", district_id: "nura", factor: 0.625, deltas: effect({ S1: 10 }) },
      { measure_id: "M8", district_id: "nura", factor: 0.625, deltas: effect({ S2: 8.75 }) },
      { measure_id: "M10", district_id: "nura", factor: 0.875, deltas: effect({ B1: 10.5, B2: 1.75 }) },
      ...fixtureCatalog.dataset.districts.map(d => ({ measure_id: "M12", district_id: d.id, factor: 0.875, deltas: effect({ C2: 4.375 }) })),
    ],
    applied_synergies: [{ measure_ids: ["M10", "M12"], district_id: "nura", deltas: effect({ B1: 2 }) }],
  },
});
const item = (explanation: string) => ({ explanation, evidence_ids: ["fixture:example"] });
export const fixtureCompleteAnalysis = AnalysisResponseSchema.parse({
  ...fixtureSimulation, created_at: "2026-09-23T00:00:00.000Z", model: "fixture-no-ai-call", prompt_version: "2.0.0",
  evidence: [{ id: "fixture:example", label: "Контрольный пример JSON", value: "Стоимость 95; Score 56.54307; критических значений 0." }],
  status: "complete", ai_error: null,
  analysis: {
    summary: "ТЕСТОВЫЙ ТЕКСТ для интерфейса. AI не вызывался. Score рассчитан по JSON, AI баллов не добавляет.",
    strengths: [item("Устранены критические значения соцсферы в Нуре."), item("Синергия освещения и цифровой платформы улучшает безопасность Нуры.")],
    risks: [item("Остаются сравнительно слабые показатели в других районах."), item("Реальный результат вне синтетической модели не гарантируется.")],
    consequences: [item("Score повышается на 3.98539."), item("Остаётся 5 единиц бюджета; сам остаток не даёт бонуса.")],
  },
});
export const fixtureUnavailableAnalysis = AnalysisResponseSchema.parse({
  ...fixtureCompleteAnalysis, status: "ai_unavailable", analysis: null,
  ai_error: { code: "missing_api_key", message: "Тестовая ошибка AI; расчёт и Score остаются доступны." },
});
