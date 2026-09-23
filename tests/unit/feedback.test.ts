import { describe, expect, it } from "vitest";
import { dataset } from "../../src/data";
import { FeedbackRequestSchema, type Review, type ReviewExtraction } from "../../src/shared/feedback";
import { fixtureReviews, fixtureReviewExtraction } from "../../src/shared/feedback-fixtures";
import { normalizeReview, prepareReviews, projectFeedback, validateExtraction } from "../../src/lib/feedback/projection";

const now = new Date("2026-09-23T12:00:00Z");
function batch(positive: number, negative: number) {
  const reviews: Review[] = Array.from({ length: positive + negative }, (_, i) => ({
    id: `r${i}`, district_id: "nura", text: `Наблюдение о маршруте автобуса номер ${i} за сегодня.`, created_at: now.toISOString(),
  }));
  const extraction: ReviewExtraction = { signals: reviews.map((r, i) => ({ review_id: r.id, district_id: r.district_id,
    indicator_code: "T2", sentiment: i < positive ? "positive" : "negative", confidence: 0.9, evidence_quote: r.text })) };
  return { reviews, extraction };
}
describe("feedback preparation", () => {
  it("accepts bounded review inputs and rejects duplicate IDs or client metric changes", () => {
    expect(FeedbackRequestSchema.safeParse({ dataset_version: "v", reviews: fixtureReviews }).success).toBe(true);
    expect(FeedbackRequestSchema.safeParse({ dataset_version: "v", reviews: [fixtureReviews[0], fixtureReviews[0]] }).success).toBe(false);
    expect(FeedbackRequestSchema.safeParse({ dataset_version: "v", reviews: fixtureReviews, delta: -20 }).success).toBe(false);
    expect(FeedbackRequestSchema.safeParse({ dataset_version: "v", reviews: Array.from({ length: 51 }, (_, i) => ({ ...fixtureReviews[0], id: String(i) })) }).success).toBe(false);
  });
  it("deduplicates normalized text despite case, spacing, punctuation and district changes", () => {
    const repeated = { ...fixtureReviews[0], id: "duplicate", district_id: "esil", created_at: "2026-09-23T00:00:00Z", text: fixtureReviews[0].text.toUpperCase().replaceAll(" ", "   ") + "!!!" };
    const prepared = prepareReviews([...fixtureReviews, repeated], now);
    expect(prepared.eligible).toHaveLength(3);
    expect(prepared.duplicate_ids).toEqual(["duplicate"]);
    expect(normalizeReview("  АВТОБУС!!! ")).toBe("автобус");
  });
  it("filters old reviews and rejects future dates", () => {
    const old = { ...fixtureReviews[0], created_at: "2026-08-01T00:00:00Z" };
    expect(prepareReviews([old], now).stale_ids).toEqual([old.id]);
    const boundary = { ...old, created_at: new Date(now.getTime() - 30 * 86400000).toISOString() };
    expect(prepareReviews([boundary], now).eligible).toHaveLength(1);
    expect(() => prepareReviews([{ ...old, created_at: "2026-09-24T00:00:00Z" }], now)).toThrow();
  });
  it("is independent of input order", () => {
    expect(prepareReviews([...fixtureReviews].reverse(), now)).toEqual(prepareReviews(fixtureReviews, now));
  });
});

describe("conservative feedback projection", () => {
  it("changes Nura T2 by -1 with three supported negative reviews and recomputes Score", () => {
    const result = projectFeedback(dataset, fixtureReviews, fixtureReviewExtraction);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({ district_id: "nura", indicator_code: "T2", before: 40, after: 39, delta: -1, outcome: "changed" });
    expect(result.after.critical_count).toBe(3);
    expect(result.after.score).toBe(51.51648);
    expect(result.before).toEqual(dataset.baseline);
  });
  it("does not change the city for one or two negative reviews", () => {
    for (const count of [1, 2]) {
      const { reviews, extraction } = batch(0, count);
      const result = projectFeedback(dataset, reviews, extraction);
      expect(result.before).toEqual(result.after);
      expect(result.changes[0].outcome).toBe("insufficient_support");
    }
  });
  it("allows recovery on positive reports and caps either direction at three", () => {
    for (const positive of [true, false]) {
      const { reviews, extraction } = batch(positive ? 10 : 0, positive ? 0 : 10);
      expect(projectFeedback(dataset, reviews, extraction).changes[0].delta).toBe(positive ? 3 : -3);
    }
  });
  it("does not resolve mixed views by arbitrary AI judgement", () => {
    const { reviews, extraction } = batch(2, 3);
    expect(projectFeedback(dataset, reviews, extraction).changes[0]).toMatchObject({ delta: 0, outcome: "mixed_feedback" });
    const strong = batch(1, 3);
    expect(projectFeedback(dataset, strong.reviews, strong.extraction).changes[0].delta).toBe(-1);
  });
  it("ignores ambiguous, neutral and unassigned signals", () => {
    const { reviews, extraction } = batch(0, 3);
    extraction.signals.forEach(s => { s.confidence = 0.79; });
    const result = projectFeedback(dataset, reviews, extraction);
    expect(result.changes).toEqual([]);
    expect(result.ignored_signal_count).toBe(3);
    reviews.forEach(r => { r.district_id = null; });
    extraction.signals.forEach(s => { s.district_id = null; s.confidence = 0.95; });
    expect(projectFeedback(dataset, reviews, extraction).ignored_signal_count).toBe(3);
    extraction.signals.forEach(s => { s.sentiment = "neutral"; });
    expect(projectFeedback(dataset, reviews, extraction).after).toEqual(dataset.baseline);
  });
  it("clips at scale boundaries", () => {
    const data = structuredClone(dataset);
    const positive = batch(5, 0);
    data.districts.find(d => d.id === "nura")!.indicators.T2 = 99;
    expect(projectFeedback(data, positive.reviews, positive.extraction).changes[0].delta).toBe(1);
    data.districts.find(d => d.id === "nura")!.indicators.T2 = 100;
    expect(projectFeedback(data, positive.reviews, positive.extraction).changes[0].outcome).toBe("at_scale_limit");
    const negative = batch(0, 5);
    data.districts.find(d => d.id === "nura")!.indicators.T2 = 1;
    expect(projectFeedback(data, negative.reviews, negative.extraction).changes[0].after).toBe(0);
  });
  it("never compounds changes or mutates the authoritative baseline", () => {
    const before = structuredClone(dataset);
    const first = projectFeedback(dataset, fixtureReviews, fixtureReviewExtraction);
    expect(projectFeedback(dataset, fixtureReviews, fixtureReviewExtraction)).toEqual(first);
    expect(projectFeedback(dataset, [], { signals: [] }).after).toEqual(dataset.baseline);
    expect(dataset).toEqual(before);
  });
});

describe("extraction evidence", () => {
  it.each(["invented quote", "unknown review", "unknown indicator", "different district", "duplicate signal", "numeric delta"])("rejects %s", mutation => {
    const raw = structuredClone(fixtureReviewExtraction);
    if (mutation === "invented quote") raw.signals[0].evidence_quote = "This quote was never written";
    if (mutation === "unknown review") raw.signals[0].review_id = "missing";
    if (mutation === "unknown indicator") Object.assign(raw.signals[0], { indicator_code: "unknown" });
    if (mutation === "different district") raw.signals[0].district_id = "esil";
    if (mutation === "duplicate signal") raw.signals.push(raw.signals[0]);
    if (mutation === "numeric delta") Object.assign(raw.signals[0], { delta: -50 });
    expect(() => validateExtraction(dataset, fixtureReviews, raw)).toThrow();
  });
  it("requires an explicit unambiguous district when none is selected", () => {
    const reviews = structuredClone(fixtureReviews);
    reviews[0].district_id = null;
    // Common grammatical forms are explicit aliases; unknown locations are never guessed.
    expect(validateExtraction(dataset, reviews, fixtureReviewExtraction)).toEqual(fixtureReviewExtraction);
    const unlocated = structuredClone(reviews);
    unlocated[0].text = "На нашей остановке утром долго приходится ждать автобусы.";
    const unlocatedSignals = structuredClone(fixtureReviewExtraction);
    unlocatedSignals.signals[0].evidence_quote = unlocated[0].text;
    expect(() => validateExtraction(dataset, unlocated, unlocatedSignals)).toThrow();
    reviews[0].text = "Район Нура: автобусы очень долго не приходят.";
    const raw = structuredClone(fixtureReviewExtraction);
    raw.signals[0].evidence_quote = reviews[0].text;
    expect(validateExtraction(dataset, reviews, raw)).toEqual(raw);
    reviews[0].text += " Также упоминается Есиль.";
    expect(() => validateExtraction(dataset, reviews, raw)).toThrow();
  });
});
