import { z } from "zod";
import { AiErrorSchema, IndicatorCodeSchema, IndicatorValuesSchema, MetricsSchema, ScoreSummarySchema } from "./contracts";

/** Experimental feedback projection. The simulation/catalog contract remains unchanged. */
export const ReviewSchema = z.object({
  id: z.string().trim().min(1).max(100),
  district_id: z.string().min(1).max(100).nullable(),
  text: z.string().trim().min(10).max(2000),
  created_at: z.string().datetime({ offset: true }),
}).strict();
export type Review = z.infer<typeof ReviewSchema>;
export const FeedbackRequestSchema = z.object({
  dataset_version: z.string().min(1),
  reviews: z.array(ReviewSchema).min(1).max(50),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.reviews.map(r => r.id)).size !== value.reviews.length) ctx.addIssue({ code: "custom", path: ["reviews"], message: "Review IDs must be unique." });
  if (value.reviews.reduce((n, r) => n + r.text.length, 0) > 50_000) ctx.addIssue({ code: "custom", path: ["reviews"], message: "Combined text exceeds 50000 characters." });
});
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;
export const ReviewSignalSchema = z.object({
  review_id: z.string().min(1), district_id: z.string().min(1).nullable(),
  indicator_code: IndicatorCodeSchema, sentiment: z.enum(["positive", "negative", "neutral"]),
  confidence: z.number().min(0).max(1), evidence_quote: z.string().min(1).max(500),
}).strict();
export type ReviewSignal = z.infer<typeof ReviewSignalSchema>;
export const ReviewExtractionSchema = z.object({ signals: z.array(ReviewSignalSchema).max(150) }).strict();
export type ReviewExtraction = z.infer<typeof ReviewExtractionSchema>;
export const FeedbackChangeSchema = z.object({
  district_id: z.string(), indicator_code: IndicatorCodeSchema,
  before: z.number(), after: z.number(), delta: z.number(),
  positive_review_ids: z.array(z.string()), negative_review_ids: z.array(z.string()),
  outcome: z.enum(["changed", "insufficient_support", "mixed_feedback", "at_scale_limit"]),
}).strict();
export type FeedbackChange = z.infer<typeof FeedbackChangeSchema>;
export const FeedbackProjectionSchema = z.object({
  districts: z.array(z.object({ district_id: z.string(), before: IndicatorValuesSchema, after: IndicatorValuesSchema, delta: MetricsSchema }).strict()).length(5),
  before: ScoreSummarySchema, after: ScoreSummarySchema, changes: z.array(FeedbackChangeSchema),
  ignored_signal_count: z.number().int().nonnegative(),
}).strict();
export type FeedbackProjection = z.infer<typeof FeedbackProjectionSchema>;
const FeedbackBaseSchema = z.object({
  dataset_version: z.string(), review_batch_key: z.string(), evaluated_at: z.string().datetime(),
  mode: z.literal("experimental_feedback_projection"), policy_version: z.string(), prompt_version: z.string(), model: z.string(),
  policy: z.object({ window_days: z.number(), minimum_support: z.number(), minimum_consensus: z.number(),
    minimum_confidence: z.number(), max_absolute_delta: z.number() }).strict(),
  reviews: z.object({ received: z.number().int(), eligible: z.number().int(),
    duplicate_ids: z.array(z.string()), stale_ids: z.array(z.string()), eligible_ids: z.array(z.string()) }).strict(),
  projection: FeedbackProjectionSchema,
  limitations: z.array(z.string()),
});
export const FeedbackResponseSchema = z.discriminatedUnion("status", [
  FeedbackBaseSchema.extend({ status: z.literal("complete"), extraction: ReviewExtractionSchema, ai_error: z.null() }).strict(),
  FeedbackBaseSchema.extend({ status: z.literal("ai_unavailable"), extraction: z.null(), ai_error: AiErrorSchema }).strict(),
]);
export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;
