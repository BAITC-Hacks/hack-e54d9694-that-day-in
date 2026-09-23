import { type Dataset, INDICATOR_CODES } from "../../shared/contracts";
import { type FeedbackProjection, type Review, type ReviewExtraction, ReviewExtractionSchema } from "../../shared/feedback";
import { calculateScore, zeroMetrics } from "../simulation";

export const FEEDBACK_POLICY_VERSION = "1.0.0";
export const FEEDBACK_POLICY = Object.freeze({ window_days: 30, minimum_support: 3, minimum_consensus: 0.75,
  minimum_confidence: 0.8, max_absolute_delta: 3 });
const DAY = 86_400_000;
const DISTRICT_FORMS: Record<string, string[]> = {
  esil: ["есиль", "есиля", "есиле", "есилю", "есилем"],
  almaty: ["алматы"], saryarka: ["сарыарка", "сарыарки", "сарыарке", "сарыарку", "сарыаркой"],
  baikonur: ["байконур", "байконура", "байконуре", "байконуру", "байконуром"],
  nura: ["нура", "нуры", "нуре", "нуру", "нурой"],
};
export const districtMentionNames = (district: Dataset["districts"][number]) => [...new Set([district.name.toLocaleLowerCase("ru"), ...(DISTRICT_FORMS[district.id] ?? [])])];
export const normalizeReview = (text: string) => text.normalize("NFKC").toLocaleLowerCase("ru")
  .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/** Same text counts only once across the whole batch, even if attached to another district. */
export function prepareReviews(reviews: Review[], now: Date) {
  const eligible: Review[] = [], duplicate_ids: string[] = [], stale_ids: string[] = [];
  const seen = new Set<string>();
  for (const review of [...reviews].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id))) {
    const timestamp = Date.parse(review.created_at);
    if (!Number.isFinite(timestamp) || timestamp > now.getTime()) throw new Error(`Invalid or future review date: ${review.id}`);
    if (timestamp < now.getTime() - FEEDBACK_POLICY.window_days * DAY) { stale_ids.push(review.id); continue; }
    const normalized = normalizeReview(review.text);
    if (seen.has(normalized)) { duplicate_ids.push(review.id); continue; }
    seen.add(normalized); eligible.push(review);
  }
  return { eligible, duplicate_ids, stale_ids };
}

/** AI must cite an exact quote and cannot move a review from its selected district. */
export function validateExtraction(data: Dataset, reviews: Review[], raw: unknown): ReviewExtraction {
  const extraction = ReviewExtractionSchema.parse(raw);
  const byId = new Map(reviews.map(r => [r.id, r]));
  const districts = new Map(data.districts.map(d => [d.id, d]));
  const pairs = new Set<string>();
  const perReview = new Map<string, number>();
  for (const signal of extraction.signals) {
    const review = byId.get(signal.review_id);
    if (!review || !review.text.includes(signal.evidence_quote)) throw new Error("Unknown review or invented evidence quote.");
    const pair = `${signal.review_id}:${signal.indicator_code}`;
    if (pairs.has(pair)) throw new Error("Repeated review/indicator signal.");
    pairs.add(pair);
    perReview.set(review.id, (perReview.get(review.id) ?? 0) + 1);
    if (perReview.get(review.id)! > 3) throw new Error("Too many signals for one review.");
    if (signal.district_id !== null && !districts.has(signal.district_id)) throw new Error("Unknown district.");
    if (review.district_id !== null && signal.district_id !== review.district_id) throw new Error("Conflicting district attribution.");
    if (review.district_id === null && signal.district_id !== null) {
      // Unassigned reviews require an explicit, unambiguous district name. No geocoding guesses.
      const words = ` ${normalizeReview(review.text)} `;
      const mentioned = data.districts.filter(d => districtMentionNames(d).some(name => words.includes(` ${normalizeReview(name)} `)));
      if (mentioned.length !== 1 || mentioned[0].id !== signal.district_id) throw new Error("District is not explicitly and unambiguously identified.");
    }
  }
  return extraction;
}

/** Conservative rule-based projection, always rebuilt from the authoritative baseline. */
export function projectFeedback(data: Dataset, reviews: Review[], raw: unknown): FeedbackProjection {
  const extraction = validateExtraction(data, reviews, raw);
  const before = Object.fromEntries(data.districts.map(d => [d.id, { ...d.indicators }]));
  const after = structuredClone(before);
  const changes: FeedbackProjection["changes"] = [];
  let ignored_signal_count = 0;
  const usable = extraction.signals.filter(s => {
    const accepted = s.district_id !== null && s.confidence >= FEEDBACK_POLICY.minimum_confidence && s.sentiment !== "neutral";
    if (!accepted) ignored_signal_count++;
    return accepted;
  });
  for (const district of data.districts) for (const indicator_code of INDICATOR_CODES) {
    const signals = usable.filter(s => s.district_id === district.id && s.indicator_code === indicator_code);
    if (!signals.length) continue;
    const positive_review_ids = signals.filter(s => s.sentiment === "positive").map(s => s.review_id).sort();
    const negative_review_ids = signals.filter(s => s.sentiment === "negative").map(s => s.review_id).sort();
    const support = Math.max(positive_review_ids.length, negative_review_ids.length);
    const consensus = support / signals.length;
    let delta = 0;
    let outcome: FeedbackProjection["changes"][number]["outcome"];
    if (support < FEEDBACK_POLICY.minimum_support) outcome = "insufficient_support";
    else if (consensus < FEEDBACK_POLICY.minimum_consensus) outcome = "mixed_feedback";
    else {
      const sign = positive_review_ids.length > negative_review_ids.length ? 1 : -1;
      delta = sign * Math.min(FEEDBACK_POLICY.max_absolute_delta, support - FEEDBACK_POLICY.minimum_support + 1);
      after[district.id][indicator_code] = Math.max(0, Math.min(100, before[district.id][indicator_code] + delta));
      delta = after[district.id][indicator_code] - before[district.id][indicator_code];
      outcome = delta === 0 ? "at_scale_limit" : "changed";
    }
    changes.push({ district_id: district.id, indicator_code, before: before[district.id][indicator_code],
      after: after[district.id][indicator_code], delta, positive_review_ids, negative_review_ids, outcome });
  }
  const districts = data.districts.map(d => {
    const delta = zeroMetrics();
    for (const k of INDICATOR_CODES) delta[k] = after[d.id][k] - before[d.id][k];
    return { district_id: d.id, before: before[d.id], after: after[d.id], delta };
  });
  return { districts, before: calculateScore(data, before), after: calculateScore(data, after), changes, ignored_signal_count };
}
