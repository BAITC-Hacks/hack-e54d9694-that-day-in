import type { Dataset, Decision } from "../../shared/contracts";
import type { Recommendation } from "../../shared/features";
import { InvalidScenarioError, simulateScenario, validateSelections } from "./index";

/** Exhaustive one-decision neighbourhood, including relocation. Not a global optimum. */
export function recommendScenarios(data: Dataset, input: Decision[]): Recommendation[] {
  const checked = validateSelections(data, input);
  if (!checked.valid) throw new InvalidScenarioError(checked.error);
  const current = simulateScenario(data, checked.decisions);
  const found: Recommendation[] = [];
  for (let index = 0; index < checked.decisions.length; index++) {
    const removed = checked.decisions[index];
    for (const measure of data.measures) {
      const targets = measure.scope === "city" ? [null] : data.districts.map(d => d.id);
      for (const district_id of targets) {
        const added = { measure_id: measure.id, district_id };
        if (removed.measure_id === added.measure_id && removed.district_id === district_id) continue;
        const proposed = checked.decisions.map((decision, i) => i === index ? added : decision);
        const validation = validateSelections(data, proposed);
        if (!validation.valid) continue;
        const simulation = simulateScenario(data, validation.decisions);
        const score_gain = Math.round((simulation.after.score - current.after.score) * 1e8) / 1e8;
        if (score_gain <= 0) continue;
        found.push({ id: `${removed.measure_id}:${removed.district_id ?? "city"}->${added.measure_id}:${district_id ?? "city"}`,
          removed, added, decisions: validation.decisions, simulation, score_gain,
          cost_delta: simulation.budget.spent - current.budget.spent });
      }
    }
  }
  return found.sort((a, b) => b.score_gain - a.score_gain || a.cost_delta - b.cost_delta || a.id.localeCompare(b.id, "en"))
    .slice(0, 3).map((candidate, index) => ({ ...candidate, id: `alternative-${index + 1}` }));
}
