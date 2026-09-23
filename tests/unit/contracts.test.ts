import { describe, expect, it } from "vitest";
import { AiAnalysisSchema, AnalysisResponseSchema, DraftSelectionsSchema, SimulateRequestSchema } from "../../src/shared/contracts";
import { fixtureCompleteAnalysis, fixtureDraftSelections, fixtureSimulateRequest, fixtureSimulation, fixtureUnavailableAnalysis } from "../../src/shared/fixtures";
import { dataset } from "../../src/data";
import { simulateScenario } from "../../src/lib/simulation";

describe("current fixtures and contracts", () => {
  it("supports empty drafts but requires five complete decisions for final requests", () => {
    expect(DraftSelectionsSchema.safeParse(fixtureDraftSelections).success).toBe(true);
    expect(SimulateRequestSchema.safeParse({ ...fixtureSimulateRequest, decisions: [] }).success).toBe(false);
  });
  it("matches the calculated source example including all contributions", () => {
    expect(fixtureSimulation.simulation).toEqual(simulateScenario(dataset, fixtureSimulateRequest.decisions));
    expect(fixtureSimulation.simulation.after.score).toBe(56.54307);
  });
  it("retains the calculated score when AI is unavailable", () => {
    expect(AnalysisResponseSchema.safeParse(fixtureUnavailableAnalysis).success).toBe(true);
    expect(fixtureUnavailableAnalysis.simulation.after.score).toBe(56.54307);
    expect(fixtureUnavailableAnalysis.analysis).toBeNull();
  });
  it("does not accept old score fields or client-supplied effects", () => {
    expect(AiAnalysisSchema.safeParse({ ...fixtureCompleteAnalysis.analysis, aiPoints: 20 }).success).toBe(false);
    expect(AnalysisResponseSchema.safeParse({ ...fixtureCompleteAnalysis, finalScore: 99 }).success).toBe(false);
    expect(SimulateRequestSchema.safeParse({ ...fixtureSimulateRequest, effects: {} }).success).toBe(false);
    expect(fixtureCompleteAnalysis.model).toBe("fixture-no-ai-call");
  });
});
