import { z } from "zod";
import { AiErrorSchema, DecisionSchema, EffectsSchema, EvidenceFactSchema, ExplanationItemSchema, SimulateRequestSchema, SimulationResponseSchema, SimulationResultSchema } from "./contracts";

/** Additive, browser-safe contracts. Existing simulator contracts remain unchanged. */
export const FEATURES_VERSION = "1.0.0";
export const ParticipantNameSchema = z.string().trim().min(1).max(60).regex(/^[\p{L}\p{N} ._()-]+$/u);
export const LeaderboardSubmitSchema = SimulateRequestSchema.extend({ display_name: ParticipantNameSchema }).strict();
export const LeaderboardEntrySchema = z.object({
  participant_id: z.string().uuid(), display_name: ParticipantNameSchema,
  scenario: SimulationResponseSchema, submitted_at: z.string().datetime(),
}).strict();
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;
export const LeaderboardSubmitResponseSchema = z.object({ policy: z.literal("personal_best"), entry: LeaderboardEntrySchema }).strict();
export const LeaderboardResponseSchema = z.object({
  dataset_version: z.string(), mode: z.literal("standard"), policy: z.literal("personal_best"),
  total: z.number().int().nonnegative(), offset: z.number().int().nonnegative(), limit: z.number().int().positive(),
  entries: z.array(LeaderboardEntrySchema.extend({ rank: z.number().int().positive(), is_winner: z.boolean() })),
  best_score: z.number().nullable(), winner_count: z.number().int().nonnegative(),
  current_participant_id: z.string().uuid().nullable(),
}).strict();
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

export const RecommendationSchema = z.object({
  id: z.string(), removed: DecisionSchema, added: DecisionSchema,
  decisions: z.array(DecisionSchema).length(5), simulation: SimulationResultSchema,
  score_gain: z.number().positive(), cost_delta: z.number(),
}).strict();
export type Recommendation = z.infer<typeof RecommendationSchema>;
export const RecommendationNotesSchema = z.object({
  summary: z.string().min(1), items: z.array(z.object({
    candidate_id: z.string().min(1), explanation: z.string().min(1),
    tradeoff: z.string().min(1), evidence_ids: z.array(z.string()).min(1),
  }).strict()).min(1).max(3),
}).strict();
export type RecommendationNotes = z.infer<typeof RecommendationNotesSchema>;
export const RecommendationsResponseSchema = z.object({
  source: SimulationResponseSchema, search: z.literal("single_replacement"),
  candidates: z.array(RecommendationSchema).max(3),
  status: z.enum(["complete", "ai_unavailable", "no_improvement"]),
  model: z.string(), prompt_version: z.string(),
  notes: RecommendationNotesSchema.nullable(), ai_error: AiErrorSchema.nullable(),
  evidence: z.array(EvidenceFactSchema),
}).strict();

export const CityEventSchema = z.object({
  id: z.string(), title: z.string(), description: z.string(), reserve_cost: z.number().nonnegative(),
  effects: z.array(z.object({ district_id: z.string().nullable(), deltas: EffectsSchema }).strict()),
}).strict();
export type CityEvent = z.infer<typeof CityEventSchema>;
export const EventRequestSchema = SimulateRequestSchema.extend({
  event_version: z.literal(FEATURES_VERSION), event_id: z.string().min(1),
}).strict();
export const EventResponseSchema = z.object({
  dataset_version: z.string(), event_version: z.literal(FEATURES_VERSION), event: CityEventSchema,
  mode: z.literal("event_practice"), eligible_for_leaderboard: z.literal(false),
  decisions: z.array(DecisionSchema).length(5), simulation: SimulationResultSchema,
  total_budget: z.object({ initial: z.number(), emergency_reserve: z.number(), measures_spent: z.number(), remaining: z.number() }).strict(),
}).strict();

export const PresentationRequestSchema = SimulateRequestSchema.extend({
  title: z.string().trim().min(1).max(100).optional(),
}).strict();
export const SlideSchema = z.object({
  id: z.string(), title: z.string(), bullets: z.array(z.string()),
  explanations: z.array(ExplanationItemSchema),
}).strict();
export const PresentationResponseSchema = z.object({
  source: SimulationResponseSchema, title: z.string(), slides: z.array(SlideSchema).min(5), markdown: z.string(),
  status: z.enum(["complete", "ai_unavailable"]), model: z.string(), prompt_version: z.string(),
  ai_error: AiErrorSchema.nullable(),
  evidence: z.array(EvidenceFactSchema),
}).strict();
export type Slide = z.infer<typeof SlideSchema>;
