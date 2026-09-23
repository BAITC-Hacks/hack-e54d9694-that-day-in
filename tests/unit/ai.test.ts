import { afterEach, describe, expect, it, vi } from "vitest";
import { AiFailure, analyzeEvidence, validateAnalysis, type AiTransport } from "../../src/lib/ai/analyze";
import { fixtureCompleteAnalysis } from "../../src/shared/fixtures";

const facts = fixtureCompleteAnalysis.evidence;
const analysis = fixtureCompleteAnalysis.analysis!;
afterEach(() => vi.useRealTimers());
describe("explanation-only AI", () => {
  it("accepts only valid explanations with known evidence", async () => {
    const transport = vi.fn<AiTransport>().mockResolvedValue({ status: "completed", parsed: analysis, refused: false });
    expect(await analyzeEvidence(facts, { transport })).toEqual(analysis);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([
    null,
    { ...analysis, score: 100 },
    { ...analysis, strengths: [] },
    { ...analysis, risks: [{ explanation: "Unknown fact", evidence_ids: ["invented"] }, analysis.risks[0]] },
  ])("rejects malformed or invented output", input => {
    expect(() => validateAnalysis(input, facts)).toThrow(AiFailure);
  });
  it("detects a missing key without contacting any provider", async () => {
    await expect(analyzeEvidence(facts)).rejects.toMatchObject({ code: "missing_api_key" });
  });
  it("rejects refusal and incomplete output", async () => {
    const refused: AiTransport = async () => ({ status: "completed", parsed: analysis, refused: true });
    await expect(analyzeEvidence(facts, { transport: refused })).rejects.toMatchObject({ code: "refusal" });
    const incomplete: AiTransport = async () => ({ status: "incomplete", parsed: analysis, refused: false });
    await expect(analyzeEvidence(facts, { transport: incomplete })).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("aborts at 45 seconds with no retry, even if the transport never settles", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const transport = vi.fn<AiTransport>(input => { signal = input.signal; return new Promise(() => {}); });
    const pending = analyzeEvidence(facts, { transport, timeoutMs: 90_000 });
    const rejection = expect(pending).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(45_000);
    await rejection;
    expect(signal!.aborted).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("sanitizes provider errors and removes completed timers", async () => {
    vi.useFakeTimers();
    const transport: AiTransport = async () => { throw new Error("private credential or provider body"); };
    await expect(analyzeEvidence(facts, { transport })).rejects.toMatchObject({ code: "provider_error" });
    await expect(analyzeEvidence(facts, { transport })).rejects.not.toThrow("private credential");
    expect(vi.getTimerCount()).toBe(0);
  });
});
