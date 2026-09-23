import { afterEach, describe, expect, it, vi } from "vitest";
import { dataset } from "../../src/data";
import { fixtureReviews, fixtureReviewExtraction } from "../../src/shared/feedback-fixtures";
import { extractReviewSignals, type ReviewTransport } from "../../src/lib/ai/reviews";

afterEach(() => vi.useRealTimers());
describe("review extraction service", () => {
  it("validates structured signals against source reviews", async () => {
    const transport = vi.fn<ReviewTransport>().mockResolvedValue({ status: "completed", refused: false, parsed: fixtureReviewExtraction });
    expect(await extractReviewSignals(dataset, fixtureReviews, { transport })).toEqual(fixtureReviewExtraction);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("does not require AI for empty eligible batches", async () => {
    expect(await extractReviewSignals(dataset, [])).toEqual({ signals: [] });
    await expect(extractReviewSignals(dataset, fixtureReviews)).rejects.toMatchObject({ code: "missing_api_key" });
  });
  it.each(["refused", "incomplete", "invented"])("rejects %s output", async kind => {
    const transport: ReviewTransport = async () => ({ status: kind === "incomplete" ? "incomplete" : "completed", refused: kind === "refused", parsed: kind === "invented" ? { signals: [{ ...fixtureReviewExtraction.signals[0], review_id: "unknown" }] } : fixtureReviewExtraction });
    await expect(extractReviewSignals(dataset, fixtureReviews, { transport })).rejects.toMatchObject({ code: kind === "refused" ? "refusal" : "invalid_response" });
  });
  it("aborts at the same 45-second deadline without retry", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const transport = vi.fn<ReviewTransport>(input => { signal = input.signal; return new Promise(() => {}); });
    const pending = extractReviewSignals(dataset, fixtureReviews, { transport });
    const rejection = expect(pending).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(45_000);
    await rejection;
    expect(signal!.aborted).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
