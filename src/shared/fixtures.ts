/** TEST DATA ONLY. Artificial UI fixtures, never an actual model response. */
import {
  CatalogSchema, EvaluateRequestSchema, EvaluationSchema,
  type Direction, type Metrics, type AiAssessment,
} from "./contracts";

const metrics = (value: number): Metrics => ({ transport: value, greenery: value, social: value, safety: value, services: value });
const fixtureDistricts = [
  { id: "center", name: "Центр", visualVariant: "center" as const, x: 50, y: 50 },
  { id: "north", name: "Северный", visualVariant: "residential" as const, x: 50, y: 20 },
  { id: "south", name: "Южный", visualVariant: "mixed" as const, x: 50, y: 80 },
  { id: "east", name: "Восточный", visualVariant: "industrial" as const, x: 80, y: 50 },
  { id: "west", name: "Западный", visualVariant: "park" as const, x: 20, y: 50 },
  { id: "riverside", name: "Прибрежный", visualVariant: "riverside" as const, x: 75, y: 75 },
];
const titles: Record<Direction, string[]> = {
  transport: ["Настройка светофоров", "Автобусные коридоры", "Расширение магистралей"],
  greenery: ["Дворовые скверы", "Зелёные коридоры", "Лесопарковый пояс"],
  social: ["Модернизация объектов", "Модульные школы и поликлиники", "Крупный социальный кластер"],
  safety: ["Освещение улиц", "Безопасные переходы", "Обновление аварийно-спасательной инфраструктуры"],
  services: ["Диспетчеризация заявок", "Обновление вывоза отходов", "Комплексная модернизация коммунального обслуживания"],
};
export const fixtureCatalog = CatalogSchema.parse({
  datasetVersion: "fixture-1.0.0", rulesVersion: "1.0.0", evaluationVersion: "1.0.0",
  budget: { initial: 100, unit: "условная единица" }, horizonMonths: 12, metricWeights: metrics(0.2),
  districts: fixtureDistricts.map(({ x, y, ...d }) => ({ ...d, population: 10000, baselineMetrics: metrics(50), mapPosition: { x, y } })),
  programs: (Object.keys(titles) as Direction[]).flatMap((direction) => titles[direction].map((title, i) => ({
    id: `${direction}-${i + 1}`, direction, title, description: "Тестовая программа для разработки интерфейса.",
    cost: [12, 20, 28][i], implementationMonths: [3, 6, 12][i],
    effects: fixtureDistricts.map((d) => ({ districtId: d.id, deltas: { ...metrics(0), [direction]: i + 2 } })),
    tradeoffs: ["Тестовое описание компромисса."], risks: ["Тестовое описание риска."],
  }))),
});
export const fixtureDraftSelections = { transport: null, greenery: null, social: null, safety: null, services: null };
export const fixtureEvaluateRequest = EvaluateRequestSchema.parse({
  datasetVersion: fixtureCatalog.datasetVersion, rulesVersion: fixtureCatalog.rulesVersion, evaluationVersion: fixtureCatalog.evaluationVersion,
  selections: { transport: "transport-1", greenery: "greenery-1", social: "social-1", safety: "safety-1", services: "services-1" },
});
const item = (explanation: string) => ({ explanation, evidenceIds: ["fixture:all-districts"] });
const criterion = { ...item("Тестовая оценка: равномерный эффект во всех районах."), score: 4 };
const assessment: AiAssessment = {
  summary: "ТЕСТОВЫЙ ОТЧЁТ: создан вручную для интерфейса; OpenAI не вызывался.",
  criteria: { needs: criterion, equity: criterion, coherence: criterion, feasibility: criterion },
  strengths: [item("Все направления охвачены."), item("Все районы получают эффект.")],
  risks: [item("Риски внедрения требуют контроля."), item("Это тестовые, а не реальные эффекты.")],
  consequences: [item("Каждый показатель повышается на 2 пункта."), item("Бюджетный остаток не влияет на оценку.")],
};
export const fixtureCompleteEvaluation = EvaluationSchema.parse({
  ...fixtureEvaluateRequest, scenarioKey: "fixture-only-cheapest", createdAt: "2026-09-23T00:00:00.000Z",
  model: "fixture-no-ai-call", promptVersion: "1.0.0", rubricVersion: "1.0.0",
  simulation: {
    budget: { initial: 100, spent: 60, remaining: 40 },
    districts: fixtureDistricts.map((d) => ({ districtId: d.id, population: 10000, before: metrics(50), after: metrics(52), delta: metrics(2) })),
    cityMetrics: { before: metrics(50), after: metrics(52), delta: metrics(2) }, dataScore: { before: 50, after: 52 },
  },
  evidence: [{ id: "fixture:all-districts", label: "Тестовый эффект", value: "Все 6 районов: показатели 50 → 52; расходы 60." }],
  status: "complete", aiAssessment: assessment, aiPoints: 16, finalScore: 57.6, aiError: null,
});
export const fixtureUnavailableEvaluation = EvaluationSchema.parse({
  ...fixtureCompleteEvaluation, status: "ai_unavailable", aiAssessment: null, aiPoints: null, finalScore: null,
  aiError: { code: "missing_api_key", message: "Тестовый пример недоступности AI." },
});
