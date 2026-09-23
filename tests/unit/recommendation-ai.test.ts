import { describe, expect, it } from "vitest";
import { explainRecommendations, validateRecommendationNotes } from "../../src/lib/ai/recommendations";

const facts = [{ id: "candidate:A", label: "Вариант", value: "{}" }];
const good = () => ({ summary: "Улучшение", items: [{ candidate_id: "A", explanation: "Обоснование", tradeoff: "Компромисс", evidence_ids: ["candidate:A"] }] });
describe("AI recommendation validation", () => {
  it("accepts supported explanations", () => expect(validateRecommendationNotes(good(), facts, ["A"])).toEqual(good()));
  it("rejects invented evidence and duplicate or omitted candidates", () => {
    const response = good(); response.items[0].evidence_ids = ["invented"];
    expect(() => validateRecommendationNotes(response, facts, ["A"])).toThrow();
    expect(() => validateRecommendationNotes({ ...good(), items: [...good().items, ...good().items] }, facts, ["A", "B"])).toThrow();
    expect(() => validateRecommendationNotes(good(), facts, ["A", "B"])).toThrow();
  });
  it("enforces a shared timeout without retries", async () => {
    await expect(explainRecommendations(facts, ["A"], { timeoutMs: 5, transport: () => new Promise(() => {}) })).rejects.toMatchObject({ code: "timeout" });
  });
  it("handles refusal and incomplete output", async () => {
    await expect(explainRecommendations(facts, ["A"], { transport: async () => ({ status: "completed", parsed: null, refused: true }) })).rejects.toMatchObject({ code: "refusal" });
    await expect(explainRecommendations(facts, ["A"], { transport: async () => ({ status: "incomplete", parsed: good(), refused: false }) })).rejects.toMatchObject({ code: "invalid_response" });
  });
});
