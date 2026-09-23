import { z } from "zod";
import { cityEvents } from "../../data/events";
import { INDICATOR_CODES, type Dataset, type Decision } from "../../shared/contracts";
import { MapEventPlacementSchema, type MapEventPlacement } from "../../shared/features";
import { InvalidScenarioError, simulateScenario, validateSelections } from "./index";

/** Same event rules as simulateEvent; placements can target one district or the city. */
export function simulateMapEvents(data: Dataset, decisions: Decision[], input: unknown) {
  const parsed = z.array(MapEventPlacementSchema).max(3).safeParse(input);
  const invalid = (message: string): never => { throw new InvalidScenarioError({ code: "invalid_decisions", message }); };
  if (!parsed.success) return invalid("Можно применить не больше трёх событий.");
  const events: MapEventPlacement[] = parsed.data;
  const keys = events.map(e => `${e.event_id}:${e.district_id ?? "city"}`);
  if (new Set(keys).size !== keys.length) return invalid("Это событие уже действует на выбранной территории.");
  const resolved = events.map(placement => {
    const event = cityEvents.find(e => e.id === placement.event_id);
    if (!event) return invalid("Неизвестное событие.");
    if (placement.district_id !== null && !data.districts.some(d => d.id === placement.district_id)) return invalid("Неизвестный район.");
    return { ...placement, event };
  });
  const emergency_reserve = resolved.reduce((sum, e) => sum + e.event.reserve_cost, 0);
  const adjusted = structuredClone(data);
  adjusted.rules.budget -= emergency_reserve;
  for (const district of adjusted.districts) {
    for (const code of INDICATOR_CODES) {
      const delta = resolved.reduce((sum, placement) => sum + placement.event.effects.reduce((part, effect) => {
        const target = placement.district_id ?? effect.district_id;
        return part + (target === null || target === district.id ? effect.deltas[code] ?? 0 : 0);
      }, 0), 0);
      district.indicators[code] = Math.max(0, Math.min(100, district.indicators[code] + delta));
    }
  }
  const simulation = simulateScenario(adjusted, decisions, { draft: true });
  return { events, simulation, emergency_reserve,
    final_score: validateSelections(adjusted, decisions).valid ? simulation.after.score : null };
}
