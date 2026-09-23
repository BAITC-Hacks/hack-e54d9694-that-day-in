import { describe, expect, it } from "vitest";
import { dataset } from "../../src/data";
import { INDICATOR_CODES, type Decision } from "../../src/shared/contracts";
import { calculateBudget, calculateScore, simulateScenario, validateSelections, zeroMetrics } from "../../src/lib/simulation";

const decision = (measure_id: string, district_id: string | null = "nura"): Decision => ({ measure_id, district_id });
const draft = (decisions: Decision[]) => simulateScenario(dataset, decisions, { draft: true });

describe("selection rules", () => {
  it("requires exactly five, allows shorter drafts", () => {
    expect(validateSelections(dataset, []).valid).toBe(false);
    expect(validateSelections(dataset, [], { draft: true }).valid).toBe(true);
    expect(validateSelections(dataset, [...dataset.example.decisions, decision("M9")]).valid).toBe(false);
  });
  it.each([
    [decision("M99")], [decision("M7"), decision("M7")],
    [decision("M7", null)], [decision("M7", "unknown")], [decision("M12", "nura")],
    [decision("M7"), decision("M8"), decision("M9")],
    [decision("M1", "esil"), decision("M3", "nura")],
    [decision("M4"), decision("M7")], [decision("M5"), decision("M13")],
  ])("rejects invalid decisions %j", (...decisions) => {
    expect(validateSelections(dataset, decisions, { draft: true }).valid).toBe(false);
  });
  it("allows district-specific conflicting measures in different districts", () => {
    expect(validateSelections(dataset, [decision("M4", "esil"), decision("M7")], { draft: true }).valid).toBe(true);
    expect(validateSelections(dataset, [decision("M5", "esil"), decision("M13")], { draft: true }).valid).toBe(true);
  });
  it("rejects overspending without needing all directions", () => {
    const choices = [decision("M3"), decision("M5", "esil"), decision("M7"), decision("M10"), decision("M14", null)];
    expect(calculateBudget(dataset, choices).spent).toBe(107);
    expect(validateSelections(dataset, choices)).toMatchObject({ valid: false, error: { code: "budget_exceeded" } });
    expect(() => simulateScenario(dataset, choices)).toThrow();
  });
  it("rejects extra fields in a decision", () => {
    expect(validateSelections(dataset, [{ ...decision("M7"), cost: 0 }], { draft: true }).valid).toBe(false);
  });
});

describe("lagged effects and Score", () => {
  it("exactly reproduces the authoritative example and baseline", () => {
    const result = simulateScenario(dataset, dataset.example.decisions);
    expect(result.budget).toEqual({ initial: 100, spent: 95, remaining: 5 });
    expect(result.before).toEqual(dataset.baseline);
    expect(result.after).toEqual(dataset.example.result);
    expect(result.score_delta).toBe(3.98539);
  });
  it("scales measures by lag, but never scales synergy bonuses", () => {
    const result = draft([decision("M1"), decision("M2", null)]);
    expect(result.districts.find(d => d.district_id === "nura")!.delta.T1).toBe(4.5 + 3 + 2);
    expect(result.districts.find(d => d.district_id === "esil")!.delta.T1).toBe(3);
    expect(result.applied_synergies[0].deltas.T1).toBe(2);
    expect(draft([decision("M1")]).applied_synergies).toHaveLength(0);
    expect(draft([decision("M5"), decision("M6", null)]).applied_synergies[0].deltas.E2).toBe(2);
  });
  it("keeps negative effects and applies city effects everywhere", () => {
    const result = draft([decision("M11"), decision("M12", null)]);
    expect(result.districts.find(d => d.district_id === "nura")!.delta.T1).toBe(-1.75);
    expect(result.districts.every(d => d.delta.C2 === 4.375)).toBe(true);
  });
  it("clips only after summing positive and negative effects", () => {
    const data = structuredClone(dataset);
    data.districts.find(d => d.id === "nura")!.indicators.T1 = 99;
    data.districts.find(d => d.id === "nura")!.indicators.B2 = 99;
    const result = simulateScenario(data, [decision("M1"), decision("M11")], { draft: true });
    const nura = result.districts.find(d => d.district_id === "nura")!;
    expect(nura.after.T1).toBe(100); // 99 + 4.5 - 1.75; sequential clipping would incorrectly give 98.25.
    expect(nura.after.B2).toBe(100);
    data.districts.find(d => d.id === "nura")!.indicators.T1 = 1;
    expect(simulateScenario(data, [decision("M11")], { draft: true }).districts.find(d => d.district_id === "nura")!.after.T1).toBe(0);
  });
  it("uses weighted population, strict threshold and source penalty coefficients", () => {
    const values = Object.fromEntries(dataset.districts.map(d => [d.id, Object.fromEntries(INDICATOR_CODES.map(k => [k, 40])) as ReturnType<typeof zeroMetrics>]));
    values.esil = Object.fromEntries(INDICATOR_CODES.map(k => [k, 100])) as ReturnType<typeof zeroMetrics>;
    const result = calculateScore(dataset, values);
    expect(result.city_average).toBe(56.2); // 100*.27 + 40*.73, not equal district weights.
    expect(result.critical_count).toBe(0);
    expect(result.score).toBe(51.34);
    const changed = structuredClone(dataset);
    changed.scoring.critical_penalty_per_pair = 3;
    values.nura.S1 = 39;
    expect(calculateScore(changed, values).score).toBeCloseTo(calculateScore(dataset, values).score - 2, 8);
  });
  it("is independent of order and previous scenarios without mutating the dataset", () => {
    const original = structuredClone(dataset);
    const expected = simulateScenario(dataset, dataset.example.decisions);
    expect(simulateScenario(dataset, [...dataset.example.decisions].reverse())).toEqual(expected);
    draft([decision("M1")]);
    const replacement = draft([decision("M3")]);
    expect(replacement.budget.spent).toBe(30);
    expect(replacement.districts.find(d => d.district_id === "nura")!.delta.T1).toBe(8);
    expect(dataset).toEqual(original);
    expect(draft([]).before).toEqual(draft([]).after);
  });
  it("checks all 2002 five-measure combinations at a fixed district assignment", () => {
    let count = 0, valid = 0;
    for (let a=0;a<10;a++) for (let b=a+1;b<11;b++) for (let c=b+1;c<12;c++) for (let d=c+1;d<13;d++) for (let e=d+1;e<14;e++) {
      count++;
      const decisions = [a,b,c,d,e].map(i => decision(dataset.measures[i].id, dataset.measures[i].scope === "city" ? null : "nura"));
      const validation = validateSelections(dataset, decisions);
      if (!validation.valid) continue;
      valid++;
      const result = simulateScenario(dataset, decisions);
      expect(result.budget.spent).toBeLessThanOrEqual(100);
      expect(result).toEqual(simulateScenario(dataset, [...decisions].reverse()));
    }
    expect(count).toBe(2002);
    expect(valid).toBeGreaterThan(0);
  });
});
