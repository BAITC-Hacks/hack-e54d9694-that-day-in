import { ArrowUpRight, Building2, Sparkles, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { dataset } from "@/data";
import type { SimulationResponse } from "@/shared/contracts";
import type { Slide } from "@/shared/features";

const number = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
export default function PresentationSlide({ slide, source, title, index, total, children }: {
  slide: Slide; source: SimulationResponse; title: string; index: number; total: number; children: ReactNode;
}) {
  const sim = source.simulation;
  const hero = slide.id === "overview" || slide.id === "result";
  const Icon = slide.id === "budget" ? Wallet : hero ? ArrowUpRight : slide.explanations.length ? Sparkles : Building2;
  return <article className={`presentation-slide deck-${slide.id}`} key={slide.id}>
    <header className="deck-masthead"><span><Building2 size={18}/> АСТАНА · ГОРОД РЕШЕНИЙ</span><span>8 кварталов / горизонт изменений</span></header>
    <div className="deck-heading"><span className="deck-icon"><Icon size={26}/></span><div><p>{title}</p><h3>{slide.title}</h3></div></div>
    <div className={`deck-content ${hero ? "deck-hero" : ""}`}>
      <div className="deck-copy">
        {slide.id === "districts" ? <div className="deck-districts">{dataset.districts.map(d => {
          const before = sim.before.district_scores[d.id], after = sim.after.district_scores[d.id];
          return <div className="deck-district" key={d.id}><strong>{d.name}</strong><span>{number(before)} <ArrowUpRight size={15}/> <b>{number(after)}</b></span><div className="deck-bar"><i style={{ width: `${before}%` }}/><i style={{ width: `${after}%` }}/></div><small>{after >= before ? "+" : ""}{number(after - before)} к исходному состоянию</small></div>;
        })}</div> : slide.id === "budget" ? <>
          <div className="deck-budget-cards"><div><small>Общий бюджет</small><strong>{sim.budget.initial}</strong><span>условных единиц</span></div><div><small>Вложено в город</small><strong>{sim.budget.spent}</strong><span>в выбранные мероприятия</span></div><div><small>Осталось</small><strong>{sim.budget.remaining}</strong><span>условных единиц</span></div></div>
          <div className="deck-budget-bar" aria-label={`Использовано ${sim.budget.spent} из ${sim.budget.initial}`}><i style={{ width: `${sim.budget.spent / sim.budget.initial * 100}%` }}/></div>
          <p className="deck-caption">Каждое вложение связано с конкретным решением. Неиспользованный бюджет сам по себе не добавляет баллы.</p>
        </> : <ul className="deck-points">{slide.bullets.map((bullet, i) => <li key={i}><span>{String(i + 1).padStart(2, "0")}</span><p>{bullet}</p></li>)}</ul>}
        {children}
      </div>
      {hero ? <aside className="deck-score"><span>ASTANA QUALITY OF LIFE</span><strong>{number(sim.after.score)}</strong><p>Расчётный Score</p><div>{sim.score_delta >= 0 ? "+" : ""}{number(sim.score_delta)} <small>к исходному сценарию</small></div><footer><span>{source.decisions.length} решений</span><span>{sim.after.critical_count} критических показателей</span></footer></aside> : null}
    </div>
    <footer className="deck-footer"><span>АКИМ НА 5 ЧАСОВ <i/> Синтетическая модель города</span><span className="deck-page">{String(index + 1).padStart(2, "0")} <small>/ {String(total).padStart(2, "0")}</small></span></footer>
  </article>;
}
