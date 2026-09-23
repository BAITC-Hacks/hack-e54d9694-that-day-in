import { z } from "zod";

// Browser-safe contracts. JSON field names and source identifiers are preserved.
export const DIRECTIONS = ["transport", "ecology", "social", "safety", "services"] as const;
export const INDICATOR_CODES = ["T1", "T2", "E1", "E2", "S1", "S2", "B1", "B2", "C1", "C2"] as const;
export const DirectionSchema = z.enum(DIRECTIONS);
export type Direction = z.infer<typeof DirectionSchema>;
export const IndicatorCodeSchema = z.enum(INDICATOR_CODES);
export type IndicatorCode = z.infer<typeof IndicatorCodeSchema>;
const text = () => z.string().min(1);
const number = () => z.number().finite();
const indicator = () => number().min(0).max(100);
export const MetricsSchema = z.object({
  T1: number(), T2: number(), E1: number(), E2: number(), S1: number(), S2: number(),
  B1: number(), B2: number(), C1: number(), C2: number(),
}).strict();
export type Metrics = z.infer<typeof MetricsSchema>;
export const IndicatorValuesSchema = z.object({
  T1: indicator(), T2: indicator(), E1: indicator(), E2: indicator(), S1: indicator(), S2: indicator(),
  B1: indicator(), B2: indicator(), C1: indicator(), C2: indicator(),
}).strict();
export const EffectsSchema = MetricsSchema.partial();
export const DistrictSchema = z.object({
  id: text(), name: text(), population_share: number().positive().max(1), indicators: IndicatorValuesSchema,
  source_district_score: indicator(), computed_district_score: indicator(), profile: text(),
}).strict();
export type District = z.infer<typeof DistrictSchema>;
export const MeasureSchema = z.object({
  id: text(), direction_id: DirectionSchema, name: text(), scope: z.enum(["district", "city"]),
  cost: number().nonnegative(), lag_quarters: z.number().int().nonnegative(), effects: EffectsSchema,
}).strict();
export type Measure = z.infer<typeof MeasureSchema>;
export const DecisionSchema = z.object({ measure_id: text(), district_id: text().nullable() }).strict();
export type Decision = z.infer<typeof DecisionSchema>;
// [] is an empty draft. Up to five fully specified decisions; no obsolete direction slots.
export const DraftSelectionsSchema = z.array(DecisionSchema).max(5);
export type DraftSelections = z.infer<typeof DraftSelectionsSchema>;
export const CriticalValueSchema = z.object({ district_id: text(), indicator_code: IndicatorCodeSchema, value: number() }).strict();
export const ScoreSummarySchema = z.object({
  district_scores: z.record(z.string(), number()), city_average: number(), minimum_district_score: number(),
  critical_count: z.number().int().nonnegative(), critical_values: z.array(CriticalValueSchema), score: number(),
}).strict();
export type ScoreSummary = z.infer<typeof ScoreSummarySchema>;
export const DatasetSchema = z.object({
  schema_version: text(),
  metadata: z.object({
    title: text(), language: text(), source: text(), city_name: text().nullable(), cost_unit: text(),
    indicator_scale: z.object({ min: z.literal(0), max: z.literal(100), higher_is_better: z.literal(true) }).strict(),
    simulation_horizon_quarters: z.number().int().positive(),
  }).strict(),
  directions: z.array(z.object({ id: DirectionSchema, name: text() }).strict()).length(5),
  indicators: z.array(z.object({ code: IndicatorCodeSchema, direction_id: DirectionSchema, name: text(),
    weight: number().nonnegative().max(1), meaning_at_100: text(), meaning_at_0: text().nullable() }).strict()).length(10),
  districts: z.array(DistrictSchema).length(5), measures: z.array(MeasureSchema).length(14),
  synergies: z.array(z.object({ measure_ids: z.tuple([text(), text()]), target_district_of: text(),
    effects: EffectsSchema, scale_by_lag: z.literal(false) }).strict()),
  incompatibilities: z.array(z.object({ measure_ids: z.tuple([text(), text()]), scope: z.enum(["anywhere", "same_district"]), reason: text() }).strict()),
  rules: z.object({
    budget: number().nonnegative(), required_decision_count: z.literal(5), allow_repeated_measures: z.literal(false),
    max_measures_per_direction: z.number().int().positive(), district_required_for_scope: z.literal("district"),
    district_for_city_scope: z.null(), decision_order_matters: z.literal(false), unused_budget_bonus: z.literal(0),
    invalid_selection_score: z.null(), invalid_selection_returns_reasons: z.literal(true),
  }).strict(),
  scoring: z.object({
    effect_factor: z.literal("(H - lag_quarters) / H"),
    indicator_formula: z.literal("clip(initial + sum(effects * effect_factor) + synergies, 0, 100)"),
    district_formula: z.literal("sum(indicator_weight * final_indicator)"),
    city_formula: z.literal("sum(population_share * district_score)"), score_formula: text(),
    city_average_weight: number().nonnegative(), minimum_district_weight: number().nonnegative(),
    critical_threshold: number(), critical_comparison: z.literal("strictly_less_than"),
    critical_penalty_per_pair: number().nonnegative(), clip_after_all_effects: z.literal(true),
  }).strict(),
  baseline: ScoreSummarySchema,
  example: z.object({ decisions: z.array(DecisionSchema).length(5), total_cost: number(), result: ScoreSummarySchema }).strict(),
  source_claims: z.object({ baseline_city_average: number(), baseline_score: number(), example_score_approx: number(),
    example_gain_approx: number(), cheapest_measure_set: z.array(text()), cheapest_measure_set_cost: number() }).strict(),
  llm_role: text(),
}).strict().superRefine((data, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  const unique = (ids: string[], label: string) => { if (new Set(ids).size !== ids.length) issue(`Duplicate ${label}`); };
  unique(data.directions.map(d => d.id), "direction"); unique(data.indicators.map(i => i.code), "indicator");
  unique(data.districts.map(d => d.id), "district"); unique(data.measures.map(m => m.id), "measure");
  if (Math.abs(data.districts.reduce((s, d) => s + d.population_share, 0) - 1) > 1e-9) issue("Population shares must sum to 1");
  if (Math.abs(data.indicators.reduce((s, i) => s + i.weight, 0) - 1) > 1e-9) issue("Indicator weights must sum to 1");
  if (Math.abs(data.scoring.city_average_weight + data.scoring.minimum_district_weight - 1) > 1e-9) issue("Score weights must sum to 1");
  for (const m of data.measures) if (m.lag_quarters > data.metadata.simulation_horizon_quarters) issue(`Lag exceeds horizon: ${m.id}`);
  const measures = new Map(data.measures.map(m => [m.id, m]));
  for (const rule of [...data.synergies, ...data.incompatibilities]) {
    if (new Set(rule.measure_ids).size !== 2 || rule.measure_ids.some(id => !measures.has(id))) issue("Invalid measure pair");
  }
  for (const s of data.synergies) if (!s.measure_ids.includes(s.target_district_of) || measures.get(s.target_district_of)?.scope !== "district") issue("Invalid synergy target");
  for (const r of data.incompatibilities) if (r.scope === "same_district" && r.measure_ids.some(id => measures.get(id)?.scope !== "district")) issue("Invalid district incompatibility");
});
export type Dataset = z.infer<typeof DatasetSchema>;
// SHA-256 of the source JSON content (canonical object order); not schema_version alone.
export const CatalogSchema = z.object({ dataset_version: text(), dataset: DatasetSchema }).strict();
export type Catalog = z.infer<typeof CatalogSchema>;
export const SimulateRequestSchema = z.object({ dataset_version: text(), decisions: z.array(DecisionSchema).length(5) }).strict();
export type SimulateRequest = z.infer<typeof SimulateRequestSchema>;
export const AnalyzeRequestSchema = SimulateRequestSchema;
export type AnalyzeRequest = SimulateRequest;
export const BudgetSchema = z.object({ initial: number(), spent: number(), remaining: number() }).strict();
export type Budget = z.infer<typeof BudgetSchema>;
export const SimulationResultSchema = z.object({
  budget: BudgetSchema,
  districts: z.array(z.object({ district_id: text(), before: IndicatorValuesSchema, after: IndicatorValuesSchema, delta: MetricsSchema }).strict()).length(5),
  before: ScoreSummarySchema, after: ScoreSummarySchema, score_delta: number(),
  // Contributions before final clipping; synergy bonuses are separate, not attributed twice.
  contributions: z.array(z.object({ measure_id: text(), district_id: text(), factor: number(), deltas: MetricsSchema }).strict()),
  applied_synergies: z.array(z.object({ measure_ids: z.tuple([text(), text()]), district_id: text(), deltas: MetricsSchema }).strict()),
}).strict();
export type SimulationResult = z.infer<typeof SimulationResultSchema>;
export const SimulationResponseSchema = z.object({
  dataset_version: text(), scenario_key: text(), decisions: z.array(DecisionSchema).length(5), simulation: SimulationResultSchema,
}).strict();
export type SimulationResponse = z.infer<typeof SimulationResponseSchema>;
export const EvidenceFactSchema = z.object({ id: text(), label: text(), value: text() }).strict();
export type EvidenceFact = z.infer<typeof EvidenceFactSchema>;
export const ExplanationItemSchema = z.object({ explanation: text(), evidence_ids: z.array(text()).min(1) }).strict();
// AI only explains. No criterion scores, aiPoints, finalScore or other numerical ratings.
export const AiAnalysisSchema = z.object({
  summary: text(), strengths: z.array(ExplanationItemSchema).min(2).max(3),
  risks: z.array(ExplanationItemSchema).min(2).max(3), consequences: z.array(ExplanationItemSchema).min(2).max(3),
}).strict();
export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;
export const AiErrorSchema = z.object({
  code: z.enum(["missing_api_key", "timeout", "refusal", "invalid_response", "provider_error"]), message: text(),
}).strict();
export type AiError = z.infer<typeof AiErrorSchema>;
const AnalysisBaseSchema = SimulationResponseSchema.extend({
  created_at: z.string().datetime(), model: text(), prompt_version: text(), evidence: z.array(EvidenceFactSchema),
});
export const AnalysisResponseSchema = z.discriminatedUnion("status", [
  AnalysisBaseSchema.extend({ status: z.literal("complete"), analysis: AiAnalysisSchema, ai_error: z.null() }).strict(),
  AnalysisBaseSchema.extend({ status: z.literal("ai_unavailable"), analysis: z.null(), ai_error: AiErrorSchema }).strict(),
]);
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
export const ValidationErrorSchema = z.object({
  code: z.enum(["invalid_request", "version_mismatch", "invalid_decisions", "budget_exceeded"]),
  message: text(), field_errors: z.record(z.string(), z.array(z.string())).optional(),
}).strict();
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
