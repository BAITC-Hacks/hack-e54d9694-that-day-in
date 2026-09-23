import { INDICATOR_CODES, type Dataset, type Decision } from "../../shared/contracts";
import type { CityEvent } from "../../shared/features";
import { simulateScenario } from "./index";

/** Event happens before implementation. All planned measures can be replaced at full refund. */
export function simulateEvent(data: Dataset, event: CityEvent, decisions: Decision[]) {
  if (event.reserve_cost < 0 || event.reserve_cost > data.rules.budget) throw new Error("Invalid emergency reserve");
  const adjusted = structuredClone(data);
  adjusted.rules.budget -= event.reserve_cost;
  for (const effect of event.effects) {
    if (effect.district_id !== null && !adjusted.districts.some(d => d.id === effect.district_id)) throw new Error("Unknown event district");
  }
  for (const district of adjusted.districts) {
    for (const code of INDICATOR_CODES) {
      const delta = event.effects.filter(e => e.district_id === null || e.district_id === district.id)
        .reduce((sum, effect) => sum + (effect.deltas[code] ?? 0), 0);
      district.indicators[code] = Math.max(0, Math.min(100, district.indicators[code] + delta));
    }
  }
  const simulation = simulateScenario(adjusted, decisions);
  return { simulation, total_budget: { initial: data.rules.budget, emergency_reserve: event.reserve_cost,
    measures_spent: simulation.budget.spent, remaining: simulation.budget.remaining } };
}
