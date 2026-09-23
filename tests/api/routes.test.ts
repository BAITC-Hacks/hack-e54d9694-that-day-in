import { describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/catalog/route";
import { POST as simulate } from "../../src/app/api/simulate/route";
import { POST as analyze } from "../../src/app/api/analyze/route";
import { createAnalyzeHandler } from "../../src/app/api/_lib/analyze-handler";
import { canonicalJson, catalog, prepareScenario } from "../../src/app/api/_lib/scenario";
import { analyzeEvidence, AiFailure } from "../../src/lib/ai/analyze";
import { AnalysisResponseSchema, CatalogSchema, SimulationResponseSchema, type EvidenceFact } from "../../src/shared/contracts";
import { fixtureCompleteAnalysis } from "../../src/shared/fixtures";
import { dataset } from "../../src/data";

const input = () => ({ dataset_version: catalog.dataset_version, decisions: structuredClone(dataset.example.decisions) });
const request = (body: unknown) => new Request("http://localhost/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const fakeAnalysis = (facts: EvidenceFact[]) => {
  const result = structuredClone(fixtureCompleteAnalysis.analysis!);
  for (const item of [...result.strengths, ...result.risks, ...result.consequences]) item.evidence_ids = [facts[0].id];
  return result;
};

describe("API handlers without a network or API key", () => {
  it("returns the unmodified source catalog and a content fingerprint", async () => {
    const response = await GET();
    const body = CatalogSchema.parse(await response.json());
    expect(body.dataset).toEqual(dataset);
    expect(body.dataset_version).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
  });
  it("simulates the canonical example without AI", async () => {
    const response = await simulate(request(input()));
    expect(response.status).toBe(200);
    const body = SimulationResponseSchema.parse(await response.json());
    expect(body.simulation.budget.spent).toBe(95);
    expect(body.simulation.after.score).toBe(56.54307);
    expect(body.simulation.after.critical_count).toBe(0);
    const reversed = input(); reversed.decisions.reverse();
    expect(await (await simulate(request(reversed))).json()).toEqual(body);
    const moved = input(); moved.decisions[0].district_id = "esil";
    const other = prepareScenario(moved);
    expect(other.ok && other.result.scenario_key).not.toBe(body.scenario_key);
  });
  it.each(["extra field", "unknown measure", "duplicate", "missing decision", "city district", "too expensive", "conflict"])("returns 422 and never calls AI: %s", async mutation => {
    const body: Record<string, unknown> = input();
    const decisions = body.decisions as ReturnType<typeof input>["decisions"];
    if (mutation === "extra field") body.score = 100;
    if (mutation === "unknown measure") decisions[0].measure_id = "M99";
    if (mutation === "duplicate") decisions[1] = decisions[0];
    if (mutation === "missing decision") decisions.pop();
    if (mutation === "city district") decisions[3].district_id = "nura";
    if (mutation === "too expensive") decisions[3] = { measure_id: "M13", district_id: "esil" };
    if (mutation === "conflict") decisions[1] = { measure_id: "M4", district_id: "nura" };
    const run = vi.fn();
    expect((await createAnalyzeHandler(run)(request(body))).status).toBe(422);
    expect(run).not.toHaveBeenCalled();
  });
  it("returns 409 on stale versions before any AI invocation", async () => {
    const run = vi.fn();
    const response = await createAnalyzeHandler(run)(request({ ...input(), dataset_version: "old" }));
    expect(response.status).toBe(409);
    expect(run).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON", async () => {
    const run = vi.fn();
    const response = await createAnalyzeHandler(run)(new Request("http://localhost", { method: "POST", body: "{" }));
    expect(response.status).toBe(422);
    expect(run).not.toHaveBeenCalled();
  });
  it("returns only an explanation alongside the unchanged deterministic score", async () => {
    const run = vi.fn(async (facts: EvidenceFact[]) => fakeAnalysis(facts));
    const response = await createAnalyzeHandler(run)(request(input()));
    const body = AnalysisResponseSchema.parse(await response.json());
    expect(response.status).toBe(200);
    expect(body.status).toBe("complete");
    expect(body.simulation.after.score).toBe(56.54307);
    expect(body).not.toHaveProperty("finalScore");
    expect(body).not.toHaveProperty("aiPoints");
    expect(run).toHaveBeenCalledTimes(1);
  });
  it.each(["timeout", "invalid_response", "provider_error"] as const)("preserves full calculation on %s", async code => {
    const run = vi.fn(async () => { throw new AiFailure(code, "Test failure"); });
    const response = await createAnalyzeHandler(run)(request(input()));
    expect(response.status).toBe(503);
    const body = AnalysisResponseSchema.parse(await response.json());
    expect(body.status).toBe("ai_unavailable");
    expect(body.analysis).toBeNull();
    expect(body.simulation.after).toEqual(dataset.example.result);
  });
  it("rejects invalid AI references through the real validator path", async () => {
    const handler = createAnalyzeHandler(facts => analyzeEvidence(facts, { transport: async () => ({
      status: "completed", parsed: fixtureCompleteAnalysis.analysis, refused: false,
    }) }));
    const response = await handler(request(input()));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.ai_error.code).toBe("invalid_response");
    expect(body.simulation.after.score).toBe(56.54307);
  });
  it("real exported handler without key returns 503 without a paid call", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    try {
      const response = await analyze(request(input()));
      expect(response.status).toBe(503);
      expect((await response.json()).ai_error.code).toBe("missing_api_key");
    } finally { vi.unstubAllEnvs(); }
  });
});
