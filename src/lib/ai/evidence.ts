import { type Dataset, type EvidenceFact, type SimulationResponse } from "../../shared/contracts";

/** Every numeric fact is computed or read from the server catalog, never supplied by the client. */
export function buildEvidence(data: Dataset, response: SimulationResponse): EvidenceFact[] {
  const facts: EvidenceFact[] = [];
  const add = (id: string, label: string, value: unknown) => facts.push({ id, label, value: JSON.stringify(value) });
  add("rules", "Горизонт, правила, веса показателей и формула Score", {
    horizon_quarters: data.metadata.simulation_horizon_quarters, rules: data.rules, scoring: data.scoring,
    indicators: data.indicators,
  });
  add("budget", "Бюджет", response.simulation.budget);
  add("score:before", "Расчётная оценка до мер", response.simulation.before);
  add("score:after", "Расчётная оценка после мер", response.simulation.after);
  add("score:delta", "Изменение Score", response.simulation.score_delta);
  for (const d of data.districts) {
    const state = response.simulation.districts.find(s => s.district_id === d.id)!;
    add(`district:${d.id}:before`, `Исходные данные: ${d.name}`, { name: d.name, population_share: d.population_share, profile: d.profile, indicators: state.before });
    add(`district:${d.id}:after`, `Результат: ${d.name}`, { indicators: state.after, district_score: response.simulation.after.district_scores[d.id] });
    add(`district:${d.id}:delta`, `Изменения: ${d.name}`, state.delta);
  }
  for (const decision of response.decisions) {
    const measure = data.measures.find(m => m.id === decision.measure_id)!;
    add(`measure:${measure.id}`, `Выбранная мера: ${measure.name}`, { ...measure, district_id: decision.district_id });
    add(`effect:${measure.id}`, "Вклад меры с учётом лага, до ограничения шкалы", response.simulation.contributions.filter(c => c.measure_id === measure.id));
  }
  add("synergies", "Сработавшие фиксированные бонусы, до ограничения шкалы", response.simulation.applied_synergies);
  return facts;
}
