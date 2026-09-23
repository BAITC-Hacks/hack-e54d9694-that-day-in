import { describe, expect, it, vi } from "vitest";
import { createFeedbackHandler } from "../../src/app/api/_lib/feedback-handler";
import { catalog } from "../../src/app/api/_lib/scenario";
import { FeedbackResponseSchema } from "../../src/shared/feedback";
import { fixtureReviews, fixtureReviewExtraction } from "../../src/shared/feedback-fixtures";
import { dataset } from "../../src/data";
import { AiFailure } from "../../src/lib/ai/analyze";

const now = () => new Date("2026-09-23T12:00:00Z");
const body = () => ({ dataset_version: catalog.dataset_version, reviews: structuredClone(fixtureReviews) });
const request = (value: unknown) => new Request("http://localhost/api/feedback/recalculate", { method: "POST", body: JSON.stringify(value) });
describe("feedback recalculation API", () => {
  it("returns an auditable projection without modifying the game catalog", async () => {
    const before = structuredClone(dataset);
    const extract = vi.fn(async () => fixtureReviewExtraction);
    const response = await createFeedbackHandler(extract, now)(request(body()));
    expect(response.status).toBe(200);
    const result = FeedbackResponseSchema.parse(await response.json());
    expect(result.mode).toBe("experimental_feedback_projection");
    expect(result.projection.changes[0].delta).toBe(-1);
    expect(result.projection.after.score).toBe(51.51648);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(dataset).toEqual(before);
    const reversed = body(); reversed.reviews.reverse();
    const again = await (await createFeedbackHandler(extract, now)(request(reversed))).json();
    expect(again.review_batch_key).toBe(result.review_batch_key);
    expect(again.projection).toEqual(result.projection);
  });
  it.each(["unknown district", "future", "duplicate ID", "empty", "client score"])("rejects %s before AI", async mutation => {
    const input = body();
    if (mutation === "unknown district") input.reviews[0].district_id = "made-up";
    if (mutation === "future") input.reviews[0].created_at = "2027-01-01T00:00:00Z";
    if (mutation === "duplicate ID") input.reviews[1].id = input.reviews[0].id;
    if (mutation === "empty") input.reviews = [];
    if (mutation === "client score") Object.assign(input, { score: 99 });
    const extract = vi.fn();
    expect((await createFeedbackHandler(extract, now)(request(input))).status).toBe(422);
    expect(extract).not.toHaveBeenCalled();
  });
  it("returns 409 for stale catalog and 422 for malformed JSON", async () => {
    const extract = vi.fn();
    const handler = createFeedbackHandler(extract, now);
    expect((await handler(request({ ...body(), dataset_version: "stale" }))).status).toBe(409);
    expect((await handler(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(422);
    expect(extract).not.toHaveBeenCalled();
  });
  it("ignores stale reviews without paying for AI", async () => {
    const input = body(); input.reviews.forEach(r => { r.created_at = "2026-01-01T00:00:00Z"; });
    const extract = vi.fn();
    const response = await createFeedbackHandler(extract, now)(request(input));
    const result = FeedbackResponseSchema.parse(await response.json());
    expect(response.status).toBe(200);
    expect(result.reviews.eligible).toBe(0);
    expect(result.projection.after).toEqual(dataset.baseline);
    expect(extract).not.toHaveBeenCalled();
  });
  it("does not treat repeated text as independent support", async () => {
    const input = body(); input.reviews.forEach(r => { r.text = fixtureReviews[0].text; });
    const extract = vi.fn(async () => ({ signals: [fixtureReviewExtraction.signals[0]] }));
    const response = await createFeedbackHandler(extract, now)(request(input));
    const result = await response.json();
    expect(result.reviews.eligible).toBe(1);
    expect(result.projection.after).toEqual(dataset.baseline);
    expect(extract.mock.calls[0]).toBeDefined();
  });
  it.each(["timeout", "missing_api_key", "provider_error"] as const)("leaves the baseline intact on %s", async code => {
    const extract = async () => { throw new AiFailure(code, "Unavailable"); };
    const response = await createFeedbackHandler(extract, now)(request(body()));
    const result = FeedbackResponseSchema.parse(await response.json());
    expect(response.status).toBe(503);
    expect(result.status).toBe("ai_unavailable");
    expect(result.projection.after).toEqual(dataset.baseline);
    expect(result.extraction).toBeNull();
  });
  it("checks even an injected extractor's evidence before modifying the snapshot", async () => {
    const raw = structuredClone(fixtureReviewExtraction); raw.signals[0].evidence_quote = "Invented";
    const response = await createFeedbackHandler(async () => raw, now)(request(body()));
    expect(response.status).toBe(503);
    const result = await response.json();
    expect(result.ai_error.code).toBe("invalid_response");
    expect(result.projection.after).toEqual(dataset.baseline);
  });
});
