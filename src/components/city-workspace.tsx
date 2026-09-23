"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Building2,
  BusFront,
  Check,
  CircleHelp,
  Clock3,
  Leaf,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wallet,
  X,
  ChartNoAxesCombined,
  FileText,
  CloudSun,
} from "lucide-react";
import { dataset } from "@/data";
import { validateSelections } from "@/lib/simulation";
import { useScenario } from "@/features/simulator/use-scenario";
import { useReport } from "@/features/simulator/use-report";
import { decisionsKey } from "@/features/scenario-tools/client";
import ScenarioTools, { type ToolName } from "./scenario-tools";
import ReportExplanation from "./report-explanation";
import MapStudio from "./map-studio";
import { usePlayground } from "@/features/map/use-playground";
import type { Decision, Direction } from "@/shared/contracts";

const categoryIcons = {
  transport: BusFront,
  ecology: Leaf,
  social: UsersRound,
  safety: ShieldCheck,
  services: Building2,
};
const labels: Record<string, string> = {
  T1: "Разгрузка дорог",
  T2: "Общественный транспорт",
  E1: "Озеленение",
  E2: "Чистота воздуха",
  S1: "Школы и детские сады",
  S2: "Доступная медицина",
  B1: "Безопасность улиц",
  B2: "Безопасность движения",
  C1: "Надёжность ЖКХ",
  C2: "Обращения жителей",
};
const format = (n: number) => n.toFixed(2).replace(".", ",");
const tabs = [
  { id: "result", title: "Результат", icon: ChartNoAxesCombined },
  { id: "recommendations", title: "Рекомендации", icon: Sparkles },
  { id: "events", title: "События", icon: CloudSun },
  { id: "comparison", title: "Сравнение", icon: UsersRound },
  { id: "presentation", title: "Презентация", icon: FileText },
] as const;
export function Shanyrak() {
  return (
    <svg
      width="38"
      height="38"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="11" stroke="currentColor" />
      <path
        d="M3 20h34M20 3v34M8 8l24 24M8 32L32 8M9 11q11 18 22 0M9 29q11-18 22 0"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}
export default function CityWorkspace() {
  const scenario = useScenario();
  const report = useReport();
  const { decisions, simulation } = scenario;
  const [selected, setSelected] = useState("nura");
  const [direction, setDirection] = useState<Direction | "all">("all");
  const [screen, setScreen] = useState<"city" | "analysis">("city");
  const [focused, setFocused] = useState<string | null>(null);
  const playground = usePlayground(decisions);
  const planningDataset = { ...dataset, rules: { ...dataset.rules, budget: dataset.rules.budget - playground.emergency_reserve } };
  function selectDistrict(id: string) { setSelected(id); setFocused(id); }
  const [tab, setTab] = useState<ToolName | "result">("result");
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const catalog = useRef<HTMLDialogElement>(null),
    rules = useRef<HTMLDialogElement>(null),
    about = useRef<HTMLDialogElement>(null);
  const analysis = useRef<HTMLElement>(null);
  const district = dataset.districts.find((d) => d.id === selected)!;
  const measures = dataset.measures.filter(
    (m) => direction === "all" || m.direction_id === direction,
  );
  function replace(next: Decision[]) {
    if (!playground.checkPlan(next)) { setNotice("План не применён: не хватает бюджета с учётом событий карты. Уберите событие и повторите."); return false; }
    scenario.replace(next);
    report.reset();
    setNotice("");
    return true;
  }
  function openCatalog(id?: Direction | "all", measureId?: string) {
    setEditing(measureId ?? null);
    setDirection(id ?? "all");
    catalog.current?.showModal();
  }
  function evaluate() {
    setScreen("analysis");
    setTab("result");
    void report.run(decisions);
    requestAnimationFrame(() => analysis.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    }));
  }
  return (
    <div className="application">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Аким на 5 часов — главная">
          <Shanyrak />
          <span>
            АКИМ<small>НА 5 ЧАСОВ</small>
          </span>
        </Link>
        <nav aria-label="Основная навигация">
          <a href="#city" onClick={() => setScreen("city")}>Город</a>
          <a href="#scenario" onClick={() => setScreen("city")}>
            Мой сценарий{" "}
            <span className="count-pill">{decisions.length}/5</span>
          </a>
          <a href="#analysis" onClick={() => setScreen("analysis")}>Анализ и сравнение</a>
        </nav>
        <div className="header-end">
          <span className="header-budget">
            <Wallet size={16} />
            <span>
              Бюджет <strong>{playground.simulation.budget.remaining}</strong>
              <small> / 100</small>
            </span>
          </span>
          <button
            className="icon-button"
            aria-label="Правила симулятора"
            onClick={() => rules.current?.showModal()}
          >
            <CircleHelp size={21} />
          </button>
        </div>
      </header>
      <main>
        <section className="studio-intro section-width">
          <div><p className="section-kicker">ГОРОД ВАШИХ РЕШЕНИЙ</p><h1>Весь город. <em>В ваших руках.</em></h1><p>Соберите план, исследуйте районы и посмотрите, как город отвечает на ваши решения.</p></div>
          <div className="workspace-switch" role="tablist" aria-label="Рабочий экран">
            <button role="tab" aria-selected={screen === "city"} aria-controls="workspace-city" onClick={() => setScreen("city")}>Карта и решения</button>
            <button role="tab" aria-selected={screen === "analysis"} aria-controls="analysis" onClick={() => setScreen("analysis")}>Аналитика и сравнение <ArrowUpRight size={15}/></button>
          </div>
        </section>
        <div id="workspace-city" hidden={screen !== "city"}>
          <MapStudio selected={selected} onSelect={selectDistrict} focused={focused} onUnfocus={() => setFocused(null)} decisions={decisions} baseline={simulation} playground={playground} onCatalog={() => openCatalog()}>
            <div className="plan-budget"><span>Осталось в бюджете</span><strong className="budget-value">{playground.simulation.budget.remaining}<small> / 100</small></strong><div className="plan-budget-track"><i style={{width:playground.simulation.budget.remaining + "%"}}/></div><small>Мероприятия: {simulation.budget.spent} · Резерв событий: {playground.emergency_reserve}</small></div>
          <div className="direction-strip" aria-label="Пять направлений">
            {dataset.directions.map((d) => {
              const Icon = categoryIcons[d.id];
              const count = decisions.filter(
                (v) =>
                  dataset.measures.find((m) => m.id === v.measure_id)
                    ?.direction_id === d.id,
              ).length;
              return (
                <button
                  key={d.id}
                  disabled={!scenario.loaded}
                  onClick={() => openCatalog(d.id)}
                >
                  <Icon size={20} />
                  <span>{d.name}</span>
                  <small>{count}/2</small>
                </button>
              );
            })}
          </div>

            <ol className="decisions-timeline">
              {Array.from({ length: 5 }, (_, i) => {
                const d = decisions[i];
                const measure = d
                  ? dataset.measures.find((m) => m.id === d.measure_id)!
                  : null;
                const Icon = measure
                  ? categoryIcons[measure.direction_id]
                  : Plus;
                return (
                  <li key={i} className={measure ? "filled" : ""}>
                    <span className="timeline-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="timeline-dot" />
                    <div className="decision-card">
                      {measure ? (
                        <span className="decision-visual" aria-hidden="true">
                          <Icon size={27} />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="decision-visual"
                          aria-label={`Добавить мероприятие в слот ${i + 1}`}
                          disabled={!scenario.loaded}
                          onClick={() => openCatalog()}
                        >
                          <Plus size={27} aria-hidden="true" />
                        </button>
                      )}
                      {measure && d ? (
                        <>
                          <div className="decision-copy">
                            <span>
                              {
                                dataset.directions.find(
                                  (v) => v.id === measure.direction_id,
                                )?.name
                              }{" "}
                              ·{" "}
                              {d.district_id
                                ? dataset.districts.find(
                                    (r) => r.id === d.district_id,
                                  )?.name
                                : "Весь город"}
                            </span>
                            <h3>{measure.name}</h3>
                            <button
                              className="text-button"
                              onClick={() => {
                                if (d.district_id) setSelected(d.district_id);
                                openCatalog(measure.direction_id, d.measure_id);
                              }}
                            >
                              Изменить
                            </button>
                          </div>
                          <strong className="decision-cost">
                            {measure.cost}
                            <small>ед.</small>
                          </strong>
                          <button
                            className="icon-button"
                            aria-label={`Удалить ${d.measure_id}`}
                            onClick={() =>
                              replace(
                                decisions.filter(
                                  (v) => v.measure_id !== d.measure_id,
                                ),
                              )
                            }
                          >
                            <X size={17} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="empty-decision"
                            disabled={!scenario.loaded}
                            onClick={() => openCatalog()}
                          >
                            <strong>Добавить мероприятие</strong>
                            <span>Выберите направление и район</span>
                          </button>
                          <ArrowUpRight size={20} />
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="plan-actions"><button className="primary-button" disabled={!scenario.valid} onClick={evaluate}>Рассчитать сценарий <ArrowRight size={16}/></button><p>Ровно 5 мер · до 2 одного направления</p>{decisions.length ? <button className="text-button" onClick={() => replace([])}>Очистить сценарий</button> : null}</div>
            <p role="status" className="inline-status">{scenario.notice || notice}</p>
          </MapStudio>
        </div>
        <section
          id="analysis"
          hidden={screen !== "analysis"}
          ref={analysis}
          className="analysis-section section-width"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">02 / ПОСЛЕДСТВИЯ И АЛЬТЕРНАТИВЫ</p>
              <h2>От решений к результатам</h2>
              <p>
                Проверьте эффект, сравните варианты и подготовьте обоснование.
              </p>
            </div>
          </div>
          {playground.events.length ? <p className="notice">Ниже — основной план для честного сравнения. Учебные события карты в этот отчёт и рейтинг не входят.</p> : null}
          <div
            className="analysis-tabs"
            role="tablist"
            aria-label="Инструменты анализа"
          >
            {tabs.map((t) => (
              <button
                role="tab"
                id={`tab-${t.id}`}
                aria-controls={`panel-${t.id}`}
                aria-selected={tab === t.id}
                tabIndex={tab === t.id ? 0 : -1}
                key={t.id}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => {
                  const idx = tabs.findIndex((v) => v.id === tab);
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const next =
                      tabs[
                        (idx + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                          tabs.length
                      ];
                    setTab(next.id);
                    document.getElementById(`tab-${next.id}`)?.focus();
                  }
                }}
              >
                <t.icon size={18} />
                {t.title}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            className="analysis-panel"
          >
            {tab === "result" ? (
              scenario.valid ? (
                <>
                  <div className="result-grid">
                    <div className="result-score">
                      <span>Astana Quality of Life Score</span>
                      <strong>{format(simulation.after.score)}</strong>
                      <span>
                        {simulation.score_delta >= 0 ? "+" : ""}
                        {format(simulation.score_delta)} к исходному{" "}
                        {format(simulation.before.score)}
                      </span>
                    </div>
                    <div className="result-context">
                      <h3>Как изменится качество жизни</h3>
                      <p>
                        Расчёт учитывает средний индекс города, слабейший район
                        и критические показатели. AI объясняет результат и не
                        изменяет баллы.
                      </p>
                      <div className="result-breakdown">
                        <div>
                          <span>Средний индекс</span>
                          <strong>
                            {format(simulation.after.city_average)}
                          </strong>
                        </div>
                        <div>
                          <span>Слабейший район</span>
                          <strong>
                            {format(simulation.after.minimum_district_score)}
                          </strong>
                        </div>
                        <div>
                          <span>Критических значений</span>
                          <strong>{simulation.after.critical_count}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="district-comparison">
                    <h3>Изменения по районам</h3>
                    {dataset.districts.map((d) => (
                      <div key={d.id}>
                        <span>{d.name}</span>
                        <div className="comparison-bars">
                          <i
                            style={{
                              width: `${simulation.before.district_scores[d.id]}%`,
                            }}
                          />
                          <b
                            style={{
                              width: `${simulation.after.district_scores[d.id]}%`,
                            }}
                          />
                        </div>
                        <strong>
                          {format(simulation.before.district_scores[d.id])} →{" "}
                          {format(simulation.after.district_scores[d.id])}
                        </strong>
                      </div>
                    ))}
                    <small>Серый — до решений · синий — после решений</small>
                  </div>
                  {report.status === "idle" ? (
                    <button
                      className="primary-button"
                      onClick={() => void report.run(decisions)}
                    >
                      <Sparkles size={17} />
                      Получить AI-анализ
                    </button>
                  ) : null}
                  <ReportExplanation
                    report={report}
                    onRetry={() => void report.run(decisions)}
                  />
                </>
              ) : (
                <div className="empty-analysis">
                  <ChartNoAxesCombined size={32} />
                  <h3>Сценарий ещё не завершён</h3>
                  <p>
                    Выберите пять мероприятий, чтобы рассчитать итоговую оценку
                    и получить AI-анализ.
                  </p>
                  <a href="#scenario" onClick={() => setScreen("city")} className="secondary-button">
                    К выбору мероприятий <ArrowUpRight size={16} />
                  </a>
                </div>
              )
            ) : (
              <ScenarioTools
                key={`${tab}:${decisionsKey(decisions)}`}
                tool={tab}
                decisions={decisions}
                valid={scenario.valid}
                onApply={(next) => {
                  if (!replace(next)) return;
                  setNotice(
                    "Рекомендация применена. Показатели пересчитаны, прежний AI-отчёт сброшен.",
                  );
                  setTab("result");
                }}
              />
            )}
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-ornament" aria-hidden="true">
          <Shanyrak />
        </div>
        <div className="footer-content section-width">
          <div className="footer-title">
            АСТАНА.
            <br />
            <span>ГОРОД РЕШЕНИЙ.</span>
            <p>Аким на 5 часов — симулятор городского управления.</p>
          </div>
          <div className="footer-column">
            <strong>Симулятор</strong>
            <a href="#city" onClick={() => setScreen("city")}>Карта районов</a>
            <a href="#scenario" onClick={() => setScreen("city")}>Мой сценарий</a>
            <a href="#analysis" onClick={() => setScreen("analysis")}>Анализ и сравнение</a>
          </div>
          <div className="footer-column">
            <strong>О проекте</strong>
            <button onClick={() => about.current?.showModal()}>
              Идея и команда
            </button>
            <button onClick={() => rules.current?.showModal()}>
              Правила и методика
            </button>
            <a href="/maps/astana-source.json" download>
              Источник географии
            </a>
          </div>
        </div>
        <div className="footer-bottom section-width">
          <span>
            Учебная модель · данные синтетические · границы районов условные
          </span>
          <span>АСТАНА · 2026</span>
        </div>
      </footer>
      <dialog ref={catalog} className="catalog-dialog">
        <div className="dialog-heading">
          <div>
            <p className="section-kicker">
              {editing ? "ИЗМЕНЕНИЕ МЕРОПРИЯТИЯ" : "КАТАЛОГ РЕШЕНИЙ"}
            </p>
            <h2>{editing ? "Заменить мероприятие" : "Выберите мероприятие"}</h2>
            <p>
              Осталось {playground.simulation.budget.remaining} ед. · {decisions.length} из
              5 выбрано
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Закрыть каталог"
            onClick={() => catalog.current?.close()}
          >
            <X />
          </button>
        </div>
        <div className="catalog-controls">
          <label>
            Район
            <select
              aria-label="Район мероприятия"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {dataset.districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <p>
            Районные меры применяются здесь.
            <br />
            Городские — во всех пяти районах.
          </p>
        </div>
        <div className="category-options">
          {dataset.directions.map((d) => {
            const Icon = categoryIcons[d.id];
            return (
              <button
                key={d.id}
                aria-pressed={direction === d.id}
                onClick={() => setDirection(d.id)}
              >
                <Icon size={18} />
                {d.name}
              </button>
            );
          })}
          <button
            aria-pressed={direction === "all"}
            onClick={() => setDirection("all")}
          >
            Все решения
          </button>
        </div>
        <div className="catalog-grid">
          {measures.map((m) => {
            const Icon = categoryIcons[m.direction_id];
            const added =
              decisions.some((d) => d.measure_id === m.id) && editing !== m.id;
            const next = editing
              ? decisions.map((d) =>
                  d.measure_id === editing
                    ? {
                        measure_id: m.id,
                        district_id: m.scope === "city" ? null : selected,
                      }
                    : d,
                )
              : [
                  ...decisions,
                  {
                    measure_id: m.id,
                    district_id: m.scope === "city" ? null : selected,
                  },
                ];
            const validation = validateSelections(planningDataset, next, {
              draft: true,
            });
            const reason = !validation.valid
              ? (Object.values(validation.error.field_errors ?? {}).flat()[0] ??
                validation.error.message)
              : "";
            return (
              <article className="measure-card" key={m.id}>
                <div className="measure-top">
                  <span className="measure-icon">
                    <Icon size={23} />
                  </span>
                  <strong>
                    {m.cost}
                    <small>ед.</small>
                  </strong>
                </div>
                <h3>{m.name}</h3>
                <p>
                  Улучшит:{" "}
                  {Object.entries(m.effects)
                    .filter(([, v]) => (v ?? 0) > 0)
                    .map(([code]) => labels[code].toLowerCase())
                    .join(", ")}
                  .
                </p>
                {Object.entries(m.effects).some(([, v]) => (v ?? 0) < 0) ? (
                  <p className="measure-tradeoff">
                    Снижение:{" "}
                    {Object.entries(m.effects)
                      .filter(([, v]) => (v ?? 0) < 0)
                      .map(([code]) => labels[code])
                      .join(", ")}
                    .
                  </p>
                ) : null}
                <div className="measure-timing">
                  <MapPin size={12} />
                  {m.scope === "city" ? "Весь город" : district.name}
                  <span>·</span>
                  <Clock3 size={12} />
                  {m.lag_quarters * 3} мес. задержки
                </div>
                <details>
                  <summary>Эффекты в цифрах</summary>
                  {Object.entries(m.effects).map(([code, value]) => (
                    <p key={code}>
                      {labels[code]}: {(value ?? 0) > 0 ? "+" : ""}
                      {value}
                    </p>
                  ))}
                  <small>
                    Полный эффект до учёта задержки. В расчёте применяется
                    горизонт 8 кварталов.
                  </small>
                </details>
                <button
                  className="add-measure"
                  aria-label={`${editing ? "Заменить на" : "Добавить"} ${m.id}`}
                  disabled={!scenario.loaded || !validation.valid}
                  onClick={() => {
                    replace(next);
                    setNotice(
                      `${editing ? "Мероприятие изменено" : "Добавлено"}: ${m.name}.`,
                    );
                    catalog.current?.close();
                  }}
                >
                  {added ? (
                    <>
                      <Check size={15} />
                      Уже выбрано
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      {editing ? "Заменить" : "Выбрать"} за {m.cost} ед.
                    </>
                  )}
                </button>
                {!added && reason ? (
                  <p className="measure-reason">{reason}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      </dialog>
      <dialog ref={rules} className="rules-dialog">
        <div className="dialog-heading">
          <h2>Правила и методика</h2>
          <button
            className="icon-button"
            aria-label="Закрыть правила"
            onClick={() => rules.current?.close()}
          >
            <X />
          </button>
        </div>
        <ol>
          <li>
            Все участники начинают со 100 условных единиц. Бюджеты независимы.
          </li>
          <li>
            Выберите пять разных мероприятий из пяти доступных направлений, не
            более двух из одного направления — по правилам исходного датасета.
          </li>
          <li>
            Учитываются районный и городской охват, задержка эффекта, синергии и
            несовместимости.
          </li>
          <li>
            Горизонт оценки — восемь кварталов. AI объясняет рассчитанные
            значения, не назначает баллы.
          </li>
        </ol>
        <div className="formula-note">
          Score = 0,7 × средний индекс + 0,3 × минимальный индекс − число
          показателей ниже 40
        </div>
        <p>
          Условные зоны на карте соответствуют пяти районам датасета. Это не
          официальный административный план и не оценка фактической ситуации в
          городе.
        </p>
        <button
          className="secondary-button"
          onClick={() => {
            replace(dataset.example.decisions);
            rules.current?.close();
          }}
        >
          Загрузить контрольный пример · 95 ед. <ArrowRight size={16} />
        </button>
      </dialog>
      <dialog ref={about} className="rules-dialog">
        <div className="dialog-heading">
          <h2>Город как система решений</h2>
          <button
            className="icon-button"
            aria-label="Закрыть информацию"
            onClick={() => about.current?.close()}
          >
            <X />
          </button>
        </div>
        <p>
          «Аким на 5 часов» — хакатон-проект команды из двух разработчиков. Он
          помогает исследовать компромиссы между транспортом, экологией,
          социальной инфраструктурой, безопасностью и городскими сервисами.
        </p>
        <p>
          В основе — синтетический датасет и воспроизводимая расчётная модель.
          География реки и главных дорог адаптирована из OpenStreetMap. Здания,
          кварталы и границы стилизованы для восприятия.
        </p>
        <p>
          Никаких игровых заданий или наград: свободный выбор сценария,
          прозрачный бюджет и объяснение последствий.
        </p>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors · ODbL
        </a>
      </dialog>
    </div>
  );
}
