/** TEST INPUT ONLY, not real residents' messages. */
import { type Review, type ReviewExtraction } from "./feedback";
export const fixtureReviews: Review[] = [
  { id: "test-review-1", district_id: "nura", created_at: "2026-09-20T10:00:00Z", text: "В Нуре утром долго жду автобус на остановке." },
  { id: "test-review-2", district_id: "nura", created_at: "2026-09-21T10:00:00Z", text: "Автобусы в Нуре ходят редко, трудно добраться до работы." },
  { id: "test-review-3", district_id: "nura", created_at: "2026-09-22T10:00:00Z", text: "На моей остановке в Нуре большие интервалы между автобусами." },
];
/** Handwritten extraction for offline tests and UI previews. Never a fallback AI response. */
export const fixtureReviewExtraction: ReviewExtraction = { signals: fixtureReviews.map(r => ({
  review_id: r.id, district_id: "nura", indicator_code: "T2", sentiment: "negative", confidence: 0.95, evidence_quote: r.text,
})) };
