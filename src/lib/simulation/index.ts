import {
  DecisionSchema, INDICATOR_CODES, type Budget, type Dataset, type Decision,
  type Metrics, type ScoreSummary, type SimulationResult, type ValidationError,
} from "../../shared/contracts";
import { z } from "zod";

export const zeroMetrics = (): Metrics => Object.fromEntries(INDICATOR_CODES.map(k => [k, 0])) as Metrics;
const round = (n: number) => Math.round(n * 1e8) / 1e8;
export type ValidationResult = { valid: true; decisions: Decision[] } | { valid: false; error: ValidationError };

/** Drafts can have fewer than five decisions, but still obey scope, uniqueness and budget. */
export function validateSelections(data: Dataset, input: unknown, options: { draft?: boolean } = {}): ValidationResult {
  const parsed = z.array(DecisionSchema).safeParse(input);
  if (!parsed.success) {
    const field_errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (field_errors[issue.path.join(".") || "decisions"] ??= []).push(issue.message);
    return { valid: false, error: { code: "invalid_decisions", message: "Некорректный формат решений.", field_errors } };
  }
  const decisions = parsed.data;
  const errors: Record<string, string[]> = {};
  const add = (path: string, message: string) => { (errors[path] ??= []).push(message); };
  const required = data.rules.required_decision_count;
  if (options.draft ? decisions.length > required : decisions.length !== required) add("decisions", `Нужно ${options.draft ? "не более" : "ровно"} ${required} решений.`);
  const measures = new Map(data.measures.map(m => [m.id, m]));
  const districtIds = new Set(data.districts.map(d => d.id));
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  let spent = 0;
  decisions.forEach((d, index) => {
    const m = measures.get(d.measure_id);
    if (!m) { add(`decisions.${index}.measure_id`, "Неизвестное мероприятие."); return; }
    if (seen.has(m.id)) add(`decisions.${index}.measure_id`, "Повтор мероприятия запрещён.");
    seen.add(m.id);
    counts.set(m.direction_id, (counts.get(m.direction_id) ?? 0) + 1);
    spent += m.cost;
    if (m.scope === "city" && d.district_id !== null) add(`decisions.${index}.district_id`, "Для городской меры district_id должен быть null.");
    if (m.scope === "district" && (d.district_id === null || !districtIds.has(d.district_id))) add(`decisions.${index}.district_id`, "Выберите существующий район для районной меры.");
  });
  for (const [direction, count] of counts) if (count > data.rules.max_measures_per_direction) add("decisions", `Не более ${data.rules.max_measures_per_direction} мер направления ${direction}.`);
  for (const conflict of data.incompatibilities) {
    const first = decisions.find(d => d.measure_id === conflict.measure_ids[0]);
    const second = decisions.find(d => d.measure_id === conflict.measure_ids[1]);
    if (first && second && (conflict.scope === "anywhere" || (first.district_id !== null && first.district_id === second.district_id))) add("decisions", `${conflict.measure_ids.join(" + ")}: ${conflict.reason}`);
  }
  if (spent > data.rules.budget) add("budget", `Стоимость ${spent} превышает бюджет ${data.rules.budget}.`);
  if (Object.keys(errors).length) return { valid: false, error: {
    code: Object.keys(errors).length === 1 && errors.budget ? "budget_exceeded" : "invalid_decisions",
    message: "Набор решений не соответствует правилам.", field_errors: errors,
  } };
  const order = new Map(data.measures.map((m, i) => [m.id, i]));
  return { valid: true, decisions: [...decisions].sort((a, b) => order.get(a.measure_id)! - order.get(b.measure_id)!) };
}

export class InvalidScenarioError extends Error {
  constructor(public readonly detail: ValidationError) { super(detail.message); this.name = "InvalidScenarioError"; }
}

/** Budget preview: remaining can be negative so the UI can display overspending. */
export function calculateBudget(data: Dataset, decisions: readonly Decision[]): Budget {
  const measures = new Map(data.measures.map(m => [m.id, m]));
  const spent = decisions.reduce((sum, d) => {
    const m = measures.get(d.measure_id);
    if (!m) throw new Error(`Unknown measure: ${d.measure_id}`);
    return sum + m.cost;
  }, 0);
  return { initial: data.rules.budget, spent, remaining: data.rules.budget - spent };
}

/** Coefficients come from dataset.scoring. Formula strings are never executed. */
export function calculateScore(data: Dataset, values: Record<string, Metrics>): ScoreSummary {
  const district_scores: Record<string, number> = {};
  const critical_values: ScoreSummary["critical_values"] = [];
  let city_average = 0;
  for (const d of data.districts) {
    const metrics = values[d.id];
    if (!metrics) throw new Error(`Missing district values: ${d.id}`);
    const districtScore = data.indicators.reduce((sum, i) => {
      const value = metrics[i.code];
      if (!Number.isFinite(value)) throw new Error(`Invalid indicator: ${d.id}.${i.code}`);
      if (value < data.scoring.critical_threshold) critical_values.push({ district_id: d.id, indicator_code: i.code, value });
      return sum + i.weight * value;
    }, 0);
    district_scores[d.id] = districtScore;
    city_average += districtScore * d.population_share;
  }
  const minimum_district_score = Math.min(...Object.values(district_scores));
  const score = data.scoring.city_average_weight * city_average
    + data.scoring.minimum_district_weight * minimum_district_score
    - data.scoring.critical_penalty_per_pair * critical_values.length;
  // Round only returned summaries to the source's precision; not intermediate arithmetic.
  return { district_scores: Object.fromEntries(Object.entries(district_scores).map(([id, n]) => [id, round(n)])),
    city_average: round(city_average), minimum_district_score: round(minimum_district_score),
    critical_count: critical_values.length, critical_values, score: round(score) };
}

export function simulateScenario(data: Dataset, input: unknown, options: { draft?: boolean } = {}): SimulationResult {
  const validation = validateSelections(data, input, options);
  if (!validation.valid) throw new InvalidScenarioError(validation.error);
  const decisions = validation.decisions;
  const before = Object.fromEntries(data.districts.map(d => [d.id, { ...d.indicators }]));
  const after = structuredClone(before);
  const contributions: SimulationResult["contributions"] = [];
  const applied_synergies: SimulationResult["applied_synergies"] = [];
  const add = (district: string, deltas: Metrics) => { for (const k of INDICATOR_CODES) after[district][k] += deltas[k]; };
  for (const decision of decisions) {
    const measure = data.measures.find(m => m.id === decision.measure_id)!;
    const factor = (data.metadata.simulation_horizon_quarters - measure.lag_quarters) / data.metadata.simulation_horizon_quarters;
    const deltas = zeroMetrics();
    for (const k of INDICATOR_CODES) deltas[k] = (measure.effects[k] ?? 0) * factor;
    const targets = measure.scope === "city" ? data.districts.map(d => d.id) : [decision.district_id!];
    for (const district_id of targets) {
      add(district_id, deltas);
      contributions.push({ measure_id: measure.id, district_id, factor, deltas: { ...deltas } });
    }
  }
  for (const synergy of data.synergies) {
    if (!synergy.measure_ids.every(id => decisions.some(d => d.measure_id === id))) continue;
    const district_id = decisions.find(d => d.measure_id === synergy.target_district_of)!.district_id!;
    const deltas = { ...zeroMetrics(), ...synergy.effects };
    add(district_id, deltas);
    applied_synergies.push({ measure_ids: synergy.measure_ids, district_id, deltas });
  }
  const districts = data.districts.map(d => {
    const delta = zeroMetrics();
    for (const k of INDICATOR_CODES) {
      after[d.id][k] = Math.min(data.metadata.indicator_scale.max, Math.max(data.metadata.indicator_scale.min, after[d.id][k]));
      delta[k] = after[d.id][k] - before[d.id][k];
    }
    return { district_id: d.id, before: before[d.id], after: after[d.id], delta };
  });
  const beforeScore = calculateScore(data, before);
  const afterScore = calculateScore(data, after);
  return { budget: calculateBudget(data, decisions), districts, before: beforeScore, after: afterScore,
    score_delta: round(afterScore.score - beforeScore.score), contributions, applied_synergies };
}
