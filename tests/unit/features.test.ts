import { describe, expect, it } from "vitest";
import { dataset } from "../../src/data";
import { cityEvents } from "../../src/data/events";
import { simulateScenario, validateSelections } from "../../src/lib/simulation";
import { recommendScenarios } from "../../src/lib/simulation/recommendations";
import { simulateEvent } from "../../src/lib/simulation/events";
import { buildSlides, slidesToMarkdown } from "../../src/lib/simulation/presentation";
import { fixtureSimulation } from "../../src/shared/fixtures";
import { fixtureEvent, fixtureLeaderboard, fixturePresentation, fixtureRecommendations } from "../../src/shared/features-fixtures";

describe("optional feature domain rules", () => {
  it("provides consistent frontend fixtures", () => {
    expect(fixtureLeaderboard.entries[0].scenario.simulation.after.score).toBe(56.54307);
    expect(fixtureRecommendations.candidates.length).toBeGreaterThan(0);
    expect(fixtureEvent.total_budget.remaining).toBe(0);
    expect(fixturePresentation.slides.length).toBe(9);
  });
  it("returns only legal, strictly better, reproducible one-decision replacements", () => {
    const candidates = recommendScenarios(dataset, dataset.example.decisions);
    expect(candidates).toHaveLength(3);
    expect(recommendScenarios(dataset, [...dataset.example.decisions].reverse())).toEqual(candidates);
    for (const candidate of candidates) {
      expect(validateSelections(dataset, candidate.decisions).valid).toBe(true);
      expect(candidate.simulation).toEqual(simulateScenario(dataset, candidate.decisions));
      expect(candidate.score_gain).toBeGreaterThan(0);
      expect(candidate.simulation.budget.spent).toBeLessThanOrEqual(100);
      expect(candidate.decisions.filter(d => dataset.example.decisions.some(old => old.measure_id === d.measure_id && old.district_id === d.district_id))).toHaveLength(4);
    }
    expect(candidates.map(c => c.score_gain)).toEqual(candidates.map(c => c.score_gain).sort((a, b) => b - a));
  });
  it("rejects invalid recommendation input", () => expect(() => recommendScenarios(dataset, [])).toThrow());
  it("returns no candidates for an already saturated city", () => {
    const maxed = structuredClone(dataset);
    for (const district of maxed.districts) for (const code of Object.keys(district.indicators) as (keyof typeof district.indicators)[]) district.indicators[code] = 100;
    expect(recommendScenarios(maxed, maxed.example.decisions)).toEqual([]);
  });
  it("reserves emergency spending and requires reallocation", () => {
    expect(() => simulateEvent(dataset, cityEvents[0], dataset.example.decisions)).toThrow();
    const event = simulateEvent(dataset, cityEvents[1], dataset.example.decisions);
    expect(event.total_budget).toEqual({ initial: 100, emergency_reserve: 5, measures_spent: 95, remaining: 0 });
    expect(event.simulation.before.score).toBeLessThan(dataset.baseline.score);
    expect(simulateScenario(dataset, dataset.example.decisions).after.score).toBe(56.54307);
  });
  it("clips event inputs and does not mutate baseline", () => {
    const before = JSON.stringify(dataset);
    const result = simulateEvent(dataset, { ...cityEvents[0], reserve_cost: 0, effects: [{ district_id: "nura", deltas: { E1: -999 } }] }, dataset.example.decisions);
    expect(result.simulation.districts.find(d => d.district_id === "nura")!.before.E1).toBe(0);
    expect(JSON.stringify(dataset)).toBe(before);
  });
  it("allows reallocating the plan for every event", () => {
    const decisions = dataset.example.decisions.map(d => d.measure_id === "M5" ? { ...d, measure_id: "M4" } : d);
    for (const event of cityEvents) {
      const result = simulateEvent(dataset, event, decisions);
      expect(result.total_budget.measures_spent).toBe(85);
      expect(result.total_budget.remaining).toBeGreaterThanOrEqual(0);
    }
  });
  it("builds a useful presentation without AI and escapes markdown", () => {
    const slides = buildSlides(dataset, fixtureSimulation, null);
    expect(slides).toHaveLength(6);
    const markdown = slidesToMarkdown("<script>\n# bad", slides);
    expect(markdown).not.toContain("<script>");
    expect(markdown).toContain("56\\.54307");
    expect(slides.find(s => s.id === "decisions")!.bullets).toHaveLength(5);
  });
});
