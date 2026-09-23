import { z } from "zod";

/** Public, browser-safe contract. No server or OpenAI imports. */
export const DIRECTIONS = ["transport", "greenery", "social", "safety", "services"] as const;
export const DirectionSchema = z.enum(DIRECTIONS);
export type Direction = z.infer<typeof DirectionSchema>;
const finite = () => z.number().finite();
const score = () => finite().min(0).max(100);
const text = () => z.string().min(1);
const id = () => z.string().regex(/^[a-z][a-z0-9-]*$/);

/** Signed deltas use Metrics; bounded indicator values use MetricValuesSchema. */
export const MetricsSchema = z.object({
  transport: finite(), greenery: finite(), social: finite(), safety: finite(), services: finite(),
}).strict();
export type Metrics = z.infer<typeof MetricsSchema>;
export const MetricValuesSchema = z.object({
  transport: score(), greenery: score(), social: score(), safety: score(), services: score(),
}).strict();

export const DistrictSchema = z.object({
  id: id(), name: text(), population: z.number().int().positive(),
  baselineMetrics: MetricValuesSchema,
  // SVG scene coordinates in [0, 100], not geographic coordinates.
  mapPosition: z.object({ x: finite().min(0).max(100), y: finite().min(0).max(100) }).strict(),
  visualVariant: z.enum(["center", "residential", "industrial", "riverside", "park", "mixed"]),
}).strict();
export type District = z.infer<typeof DistrictSchema>;
export const ProgramSchema = z.object({
  id: id(), direction: DirectionSchema, title: text(), description: text(),
  cost: z.number().int().positive(),
  effects: z.array(z.object({ districtId: id(), deltas: MetricsSchema }).strict()).min(1),
  implementationMonths: z.number().int().min(1).max(12),
  tradeoffs: z.array(text()).min(1), risks: z.array(text()).min(1),
}).strict();
export type Program = z.infer<typeof ProgramSchema>;
export const VersionsSchema = z.object({
  datasetVersion: text(), rulesVersion: text(), evaluationVersion: text(),
}).strict();
export const CatalogSchema = VersionsSchema.extend({
  budget: z.object({ initial: z.literal(100), unit: text() }).strict(),
  horizonMonths: z.literal(12), metricWeights: MetricsSchema,
  districts: z.array(DistrictSchema).length(6), programs: z.array(ProgramSchema).length(15),
}).strict().superRefine((catalog, ctx) => {
  const fail = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });
  const districtIds = new Set(catalog.districts.map((d) => d.id));
  if (districtIds.size !== catalog.districts.length) fail("Duplicate district IDs", ["districts"]);
  if (new Set(catalog.programs.map((p) => p.id)).size !== catalog.programs.length) fail("Duplicate program IDs", ["programs"]);
  for (const direction of DIRECTIONS) {
    if (catalog.metricWeights[direction] !== 0.2) fail("Each metric weight must be 0.2", ["metricWeights", direction]);
    const programs = catalog.programs.filter((p) => p.direction === direction);
    if (programs.map((p) => p.cost).sort((a, b) => a - b).join(",") !== "12,20,28") {
      fail("Each direction requires exactly three programs costing 12, 20, 28", ["programs"]);
    }
  }
  catalog.programs.forEach((program, index) => {
    if (new Set(program.effects.map((e) => e.districtId)).size !== program.effects.length) fail("Duplicate effect district", ["programs", index, "effects"]);
    program.effects.forEach((effect, effectIndex) => {
      if (!districtIds.has(effect.districtId)) fail("Unknown effect district", ["programs", index, "effects", effectIndex, "districtId"]);
    });
  });
});
export type Catalog = z.infer<typeof CatalogSchema>;

export const DraftSelectionsSchema = z.object({
  transport: id().nullable(), greenery: id().nullable(), social: id().nullable(),
  safety: id().nullable(), services: id().nullable(),
}).strict();
export type DraftSelections = z.infer<typeof DraftSelectionsSchema>;
export const SelectionsSchema = z.object({
  transport: id(), greenery: id(), social: id(), safety: id(), services: id(),
}).strict();
export type Selections = z.infer<typeof SelectionsSchema>;
export const EvaluateRequestSchema = VersionsSchema.extend({ selections: SelectionsSchema }).strict();
export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

export const BudgetSchema = z.object({ initial: finite().nonnegative(), spent: finite().nonnegative(), remaining: finite() }).strict();
export type Budget = z.infer<typeof BudgetSchema>;
const MetricChangeSchema = z.object({ before: MetricValuesSchema, after: MetricValuesSchema, delta: MetricsSchema }).strict();
export const SimulationResultSchema = z.object({
  budget: BudgetSchema,
  districts: z.array(MetricChangeSchema.extend({ districtId: id(), population: z.number().int().positive() }).strict()).length(6),
  cityMetrics: MetricChangeSchema,
  dataScore: z.object({ before: score(), after: score() }).strict(),
}).strict();
export type SimulationResult = z.infer<typeof SimulationResultSchema>;

export const EvidenceFactSchema = z.object({ id: text(), label: text(), value: text() }).strict();
export type EvidenceFact = z.infer<typeof EvidenceFactSchema>;
export const AssessmentItemSchema = z.object({ explanation: text(), evidenceIds: z.array(text()).min(1) }).strict();
export const CriterionSchema = AssessmentItemSchema.extend({ score: z.number().int().min(0).max(5) }).strict();
export const AiAssessmentSchema = z.object({
  summary: text(),
  criteria: z.object({ needs: CriterionSchema, equity: CriterionSchema, coherence: CriterionSchema, feasibility: CriterionSchema }).strict(),
  strengths: z.array(AssessmentItemSchema).min(2).max(3),
  risks: z.array(AssessmentItemSchema).min(2).max(3),
  consequences: z.array(AssessmentItemSchema).min(2).max(3),
}).strict();
export type AiAssessment = z.infer<typeof AiAssessmentSchema>;
export const AiErrorSchema = z.object({
  code: z.enum(["missing_api_key", "timeout", "refusal", "invalid_response", "provider_error"]), message: text(),
}).strict();
export type AiError = z.infer<typeof AiErrorSchema>;
const EvaluationBaseSchema = VersionsSchema.extend({
  scenarioKey: text(), createdAt: z.string().datetime(), model: text(),
  promptVersion: text(), rubricVersion: text(), selections: SelectionsSchema,
  simulation: SimulationResultSchema, evidence: z.array(EvidenceFactSchema),
});
export const EvaluationSchema = z.discriminatedUnion("status", [
  EvaluationBaseSchema.extend({ status: z.literal("complete"), aiAssessment: AiAssessmentSchema,
    aiPoints: z.number().int().min(0).max(20), finalScore: score(), aiError: z.null() }).strict(),
  EvaluationBaseSchema.extend({ status: z.literal("ai_unavailable"), aiAssessment: z.null(),
    aiPoints: z.null(), finalScore: z.null(), aiError: AiErrorSchema }).strict(),
]);
export type Evaluation = z.infer<typeof EvaluationSchema>;
export const ValidationErrorSchema = z.object({
  code: z.enum(["invalid_request", "version_mismatch", "invalid_selections", "budget_exceeded"]),
  message: text(), fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
}).strict();
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
