import type { AiAnalysis, Dataset, SimulationResponse } from "../../shared/contracts";
import type { Slide } from "../../shared/features";

/** Plain data for any future slide design. Numbers always come from server computation. */
export function buildSlides(data: Dataset, source: SimulationResponse, analysis: AiAnalysis | null): Slide[] {
  const sim = source.simulation;
  const slides: Slide[] = [
    { id: "overview", title: "Решение команды", bullets: ["Учебная модель города, синтетические данные.",
      `Горизонт: ${data.metadata.simulation_horizon_quarters} кварталов.`,
      `Score: ${sim.before.score} → ${sim.after.score}; изменение ${sim.score_delta}.`], explanations: [] },
    { id: "decisions", title: "Пять мероприятий", bullets: source.decisions.map(d => {
      const measure = data.measures.find(m => m.id === d.measure_id)!;
      const target = d.district_id === null ? "Весь город" : data.districts.find(district => district.id === d.district_id)!.name;
      return `${measure.name} — ${target}; стоимость ${measure.cost}; лаг ${measure.lag_quarters} кварталов.`;
    }), explanations: [] },
    { id: "budget", title: "Бюджет", bullets: [`Начальный: ${sim.budget.initial}.`, `Расходы: ${sim.budget.spent}.`,
      `Остаток: ${sim.budget.remaining}. Неиспользованный бюджет не добавляет баллы.`], explanations: [] },
    { id: "districts", title: "Изменения районов", bullets: data.districts.map(d =>
      `${d.name}: ${sim.before.district_scores[d.id]} → ${sim.after.district_scores[d.id]}.`), explanations: [] },
    { id: "result", title: "Итоговая оценка", bullets: [`Среднее по населению: ${sim.after.city_average}.`,
      `Минимальная районная оценка: ${sim.after.minimum_district_score}.`, `Критических показателей: ${sim.after.critical_count}.`,
      `Astana Quality of Life Score: ${sim.after.score}.`, "AI не выставляет баллы."], explanations: [] },
  ];
  if (analysis) {
    slides.push({ id: "summary", title: "Заключение AI", bullets: [analysis.summary], explanations: [] },
      { id: "strengths", title: "Сильные стороны", bullets: [], explanations: analysis.strengths },
      { id: "risks", title: "Риски", bullets: [], explanations: analysis.risks },
      { id: "consequences", title: "Возможные последствия", bullets: [], explanations: analysis.consequences });
  } else slides.push({ id: "ai-unavailable", title: "AI-анализ недоступен", bullets: ["Представлены только проверенные расчёты. Объяснения AI можно запросить повторно."], explanations: [] });
  return slides;
}

const escapeMarkdown = (text: string) => text.replace(/[\r\n]+/g, " ").replace(/[\\`*_{}\[\]()#+.!|<>~-]/g, "\\$&");
export function slidesToMarkdown(title: string, slides: Slide[]): string {
  return `# ${escapeMarkdown(title)}\n\n` + slides.map(slide => `## ${escapeMarkdown(slide.title)}\n\n` +
    [...slide.bullets, ...slide.explanations.map(e => `${e.explanation} [Факты: ${e.evidence_ids.join(", ")}]`)]
      .map(line => `- ${escapeMarkdown(line)}`).join("\n")).join("\n\n---\n\n") + "\n";
}
