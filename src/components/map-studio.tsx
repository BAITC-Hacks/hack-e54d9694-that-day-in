"use client";
import { CloudRain, Sun, Zap, Construction, X, MousePointer2, MapPin, ArrowUpRight, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { dataset } from "@/data";
import { cityEvents } from "@/data/events";
import type { Decision, SimulationResult } from "@/shared/contracts";
import type { usePlayground } from "@/features/map/use-playground";
import CityMap from "./city-map";

const icons = { "heavy-rain": CloudRain, "heat-wave": Sun, "utility-failure": Zap, "road-repair": Construction };
const format = (n: number) => Number(n.toFixed(2)).toLocaleString("ru-RU");
export default function MapStudio({ selected, onSelect, focused, onUnfocus, decisions, baseline, playground, onCatalog, children }: {
  selected: string; onSelect: (id: string) => void; focused: string | null; onUnfocus: () => void;
  decisions: Decision[]; baseline: SimulationResult; playground: ReturnType<typeof usePlayground>;
  onCatalog: () => void; children: ReactNode;
}) {
  const district = dataset.districts.find(d => d.id === selected)!;
  const state = playground.simulation.districts.find(d => d.district_id === selected)!;
  const before = baseline.districts.find(d => d.district_id === selected)!.before;
  const afterScore = playground.simulation.after.district_scores[selected];
  const beforeScore = baseline.before.district_scores[selected];
  return <div className="planning-studio" id="city">
    <aside id="scenario" className="plan-rail" aria-label="Мои мероприятия">
      <div className="rail-heading"><span className="section-kicker">ВАШ ПЛАН</span><h2>Мои мероприятия <small className="decision-count">{decisions.length} / 5</small></h2></div>
      {children}
    </aside>
    <section className="studio-map-panel" aria-label="Карта и события">
      <div className="studio-map-top"><div><span className="section-kicker">ЖИВОЙ ГОРОД</span><h2>{focused ? district.name : "Астана"}<small>{focused ? "Район крупным планом" : "Пять районов. Один город."}</small></h2></div>
        {focused ? <button className="map-back" onClick={onUnfocus}><Undo2 size={16}/>Весь город</button> : <span className="map-live-dot">Сценарий в реальном времени</span>}
      </div>
      <div className={`studio-map-canvas ${playground.armed ? "placing-event" : ""}`}>
        <CityMap selected={selected} focused={focused} onUnfocus={onUnfocus} onSelect={onSelect} decisions={decisions}
          feedback={playground.feedback} armedEvent={playground.armed} onPlaceEvent={playground.place}
          changes={Object.fromEntries(dataset.districts.map(d => [d.id, playground.simulation.after.district_scores[d.id] - baseline.before.district_scores[d.id]]))}/>
        {playground.armed ? <div className="placement-hint" role="status"><MousePointer2 size={15}/>Нажмите на район или выберите весь город
          <button onClick={() => playground.place(playground.armed!, null)}>Весь город</button><button aria-label="Отменить размещение события" onClick={() => playground.setArmed(null)}><X size={14}/></button></div> : null}
      </div>
      <nav className="studio-districts" aria-label="Выбор района">{dataset.districts.map(d => <button key={d.id} aria-pressed={selected === d.id} onClick={() => onSelect(d.id)}><span/>{d.name}</button>)}</nav>
      <div className="event-tray">
        <div className="event-tray-heading"><strong>А что, если…</strong><span>Перетащите событие на район · или выберите кликом</span></div>
        <div className="event-tokens">{cityEvents.map(event => {
          const Icon = icons[event.id as keyof typeof icons] ?? Zap;
          return <button key={event.id} draggable aria-label={`Событие: ${event.title}`} aria-pressed={playground.armed === event.id}
            className={`event-token event-${event.id}`} title={event.description}
            onDragStart={e => { e.dataTransfer.setData("application/x-akim-event", event.id); e.dataTransfer.setData("text/plain", event.id); e.dataTransfer.effectAllowed = "copy"; playground.setArmed(event.id); }}
            onDragEnd={() => playground.setArmed(null)} onClick={() => playground.setArmed(playground.armed === event.id ? null : event.id)}>
            <span><Icon size={24}/></span><strong>{event.title}</strong><small>резерв {event.reserve_cost} ед.</small></button>;
        })}</div>
        <div className="city-drop-target" onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData("application/x-akim-event"); if (id) playground.place(id, null); }}>
          <MapPin size={14}/> Для всего города — перенесите сюда
        </div>
        {playground.events.length ? <ul className="active-events" aria-label="Активные события">{playground.events.map((placement, index) => <li key={`${placement.event_id}:${placement.district_id}`}>
          <span>{cityEvents.find(e => e.id === placement.event_id)?.title}<small>{dataset.districts.find(d => d.id === placement.district_id)?.name ?? "Весь город"}</small></span>
          <button aria-label={`Убрать событие ${index + 1}`} onClick={() => playground.remove(index)}><X size={14}/></button>
        </li>)}</ul> : null}
        <p className="event-experiment-note">Учебный эксперимент · до 3 событий · резерв из личных 100 ед. · в рейтинг идёт основной план</p>
        <p className="studio-status" role="status">{playground.message}</p>
      </div>
    </section>
    <aside className="district-inspector" aria-label={`Район ${district.name}: показатели`}>
      <div className="rail-heading"><span className="section-kicker">ПУЛЬС РАЙОНА</span><h2 key={selected} className="inspector-title">{district.name}<MapPin size={18}/></h2><p>{district.profile}</p></div>
      <div className="inspector-score"><span>Индекс качества жизни</span><div><small>{format(beforeScore)}</small><span>→</span><strong key={`${selected}:${afterScore}`} className={afterScore >= beforeScore ? "metric-positive" : "metric-negative"}>{format(afterScore)}</strong></div><p>{afterScore >= beforeScore ? "+" : ""}{format(afterScore - beforeScore)} к исходному состоянию</p></div>
      <div className="metric-table-heading"><strong>Показатели района</strong><span>До</span><span>После</span></div>
      <div className="metric-list inspector-metrics">{dataset.indicators.map(indicator => {
        const after = state.after[indicator.code], delta = after - before[indicator.code];
        return <div className="metric-row" data-indicator={indicator.code} key={indicator.code}>
          <span>{indicator.name}</span><small>{format(before[indicator.code])}</small>
          <strong key={`${selected}:${after}`} className={delta > 0 ? "metric-positive" : delta < 0 ? "metric-negative" : ""}>{format(after)}<em>{delta ? `${delta > 0 ? "+" : ""}${format(delta)}` : "—"}</em></strong>
          <div className="metric-track"><i className="metric-before" style={{width:`${before[indicator.code]}%`}}/><i className={delta < 0 ? "negative" : ""} style={{width:`${after}%`}}/></div>
        </div>;
      })}</div>
      <button className="primary-button" onClick={onCatalog}>Выбрать мероприятие <ArrowUpRight size={16}/></button>
      <p className="inspector-note">{playground.events.length ? "После: мероприятия + активные события карты. Уберите события, чтобы вернуться к основному плану." : "После: прогноз выбранных мероприятий на 8 кварталов. Все значения — синтетические."}</p>
    </aside>
  </div>;
}
