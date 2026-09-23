import { describe, expect, it } from "vitest";
import { AiAssessmentSchema, DraftSelectionsSchema, EvaluateRequestSchema, EvaluationSchema } from "../../src/shared/contracts";
import { fixtureCatalog, fixtureCompleteEvaluation, fixtureDraftSelections, fixtureEvaluateRequest, fixtureUnavailableEvaluation } from "../../src/shared/fixtures";

describe("public contract fixtures", () => {
  it("distinguishes draft, final request and non-production fixture versions", () => {
    expect(DraftSelectionsSchema.safeParse(fixtureDraftSelections).success).toBe(true);
    expect(EvaluateRequestSchema.safeParse({ ...fixtureEvaluateRequest, selections: fixtureDraftSelections }).success).toBe(false);
    expect(fixtureCatalog.datasetVersion).toContain("fixture");
    expect(fixtureCompleteEvaluation.model).toBe("fixture-no-ai-call");
  });
  it("provides coherent 60-unit fixture and 80/20 score", () => {
    const report = fixtureCompleteEvaluation;
    expect(EvaluationSchema.safeParse(report).success).toBe(true);
    expect(report.simulation.budget).toEqual({ initial: 100, spent: 60, remaining: 40 });
    expect(report.simulation.dataScore).toEqual({ before: 50, after: 52 });
    expect(report.finalScore).toBe(57.6);
    expect(report.aiPoints).toBe(16);
  });
  it("requires absent AI scores on unavailable reports", () => {
    expect(EvaluationSchema.safeParse(fixtureUnavailableEvaluation).success).toBe(true);
    expect(EvaluationSchema.safeParse({ ...fixtureUnavailableEvaluation, finalScore: 0 }).success).toBe(false);
    expect(EvaluationSchema.safeParse({ ...fixtureUnavailableEvaluation, aiAssessment: fixtureCompleteEvaluation.aiAssessment }).success).toBe(false);
  });
  it("rejects client prices and AI scores outside the rubric", () => {
    expect(EvaluateRequestSchema.safeParse({ ...fixtureEvaluateRequest, cost: 1 }).success).toBe(false);
    const assessment = structuredClone(fixtureCompleteEvaluation.aiAssessment!);
    assessment.criteria.needs.score = 5.5;
    expect(AiAssessmentSchema.safeParse(assessment).success).toBe(false);
  });
});
