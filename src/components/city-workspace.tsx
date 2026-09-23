"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  BusFront,
  Check,
  CircleHelp,
  Clock3,
  Landmark,
  Leaf,
  ListChecks,
  MapPin,
  Plus,
  ShieldCheck,
  UsersRound,
  Wallet,
  X,
  Undo2,
} from "lucide-react";
import { dataset } from "@/data";
import { validateSelections } from "@/lib/simulation";
import { useScenario } from "@/features/simulator/use-scenario";
import { useReport } from "@/features/simulator/use-report";
import ReportExplanation from "./report-explanation";
import CityMap from "./city-map";
import type { Direction } from "@/shared/contracts";

const categoryIcons = {
  transport: BusFront,
  ecology: Leaf,
  social: UsersRound,
  safety: ShieldCheck,
  services: Building2,
};
const indicatorLabels: Record<string, string> = {
  T1: "Дороги без пробок",
  T2: "Общественный транспорт",
  E1: "Парки и зелень",
  E2: "Чистый воздух",
  S1: "Школы и детские сады",
  S2: "Доступная медицина",
  B1: "Безопасность улиц",
  B2: "Безопасность движения",
  C1: "Надёжность ЖКХ",
  C2: "Обратная связь с жителями",
};
const needs: Record<string, string> = {
  T1: "Поможем жителям тратить меньше времени в пробках?",
  T2: "Сделаем общественный транспорт доступнее?",
  E1: "Добавим больше зелени и мест для прогулок?",
  E2: "Пора позаботиться о чистом воздухе.",
  S1: "Здесь особенно нужны школы и детские сады.",
  S2: "Жителям нужна более доступная медицина.",
  B1: "Сделаем улицы безопаснее для жителей?",
  B2: "Поможем сделать движение безопаснее?",
  C1: "Жителям нужны более надёжные городские сети.",
  C2: "Поможем городу быстрее отвечать жителям?",
};
const format = (n: number) => n.toFixed(2).replace(".", ",");

export default function CityWorkspace() {
  const [selected, setSelected] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction | "all">("social");
  const [forecast, setForecast] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const scenario = useScenario();
  const report = useReport();
  const { simulation, decisions } = scenario;
  const journeyCard = useRef<HTMLElement>(null);
  const catalogDialog = useRef<HTMLDialogElement>(null);
  const rulesDialog = useRef<HTMLDialogElement>(null);
  const resultDialog = useRef<HTMLDialogElement>(null);
  const planDialog = useRef<HTMLDialogElement>(null);
  const aboutDialog = useRef<HTMLDialogElement>(null);
  const district =
    dataset.districts.find((d) => d.id === selected) ??
    dataset.districts.find((d) => d.id === "nura")!;
  const currentDistrict = simulation.districts.find(
    (d) => d.district_id === district.id,
  )!;
  const values = forecast ? currentDistrict.after : currentDistrict.before;
  const weakest = dataset.indicators.reduce((a, b) =>
    values[a.code] <= values[b.code] ? a : b,
  );
  const measures = dataset.measures.filter(
    (m) => direction === "all" || m.direction_id === direction,
  );
  function chooseDistrict(id: string) {
    setSelected(id);
    setLastAdded(null);
    if (window.matchMedia("(max-width: 700px)").matches) {
      requestAnimationFrame(() =>
        journeyCard.current?.scrollIntoView({
          block: "nearest",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        }),
      );
    }
  }
  function openCatalog() {
    setDirection(weakest.direction_id);
    catalogDialog.current?.showModal();
  }
  function evaluate() {
    planDialog.current?.close();
    resultDialog.current?.showModal();
    void report.run(decisions);
  }
  return (
    <div className="game-app">
      <header className="game-header">
        <Link href="/" className="brand" aria-label="Аким на 5 часов — главная">
          <span className="brand-mark">
            <Landmark size={25} />
          </span>
          <span>
            аким<small>НА 5 ЧАСОВ</small>
          </span>
        </Link>
        <span className="header-tagline">
          Маленькие решения. Большой город.
        </span>
        <div className="game-hud">
          <div className="budget-chip">
            <Wallet size={18} />
            <span>
              <small>Ваш бюджет</small>
              <strong className="budget-value">
                {simulation.budget.remaining} <span>/ 100</span>
              </strong>
            </span>
          </div>
          <button
            aria-label={`Мой план: ${decisions.length} из 5 решений`}
            className="plan-button"
            onClick={() => planDialog.current?.showModal()}
          >
            <ListChecks size={18} />
            <span>Мой план</span>
            <strong className="count-pill">{decisions.length} / 5</strong>
          </button>
          <button
            className="icon-button"
            aria-label="Правила игры"
            onClick={() => rulesDialog.current?.showModal()}
          >
            <CircleHelp size={21} />
          </button>
        </div>
      </header>
      <main className="game-world" aria-label="Игра: пять решений для Астаны">
        <CityMap
          selected={selected}
          onSelect={chooseDistrict}
          decisions={decisions}
          changes={
            forecast
              ? Object.fromEntries(
                  dataset.districts.map((d) => [
                    d.id,
                    simulation.after.district_scores[d.id] -
                      simulation.before.district_scores[d.id],
                  ]),
                )
              : undefined
          }
        />
        <div className="world-heading">
          <span className="location-label">
            <MapPin size={13} /> АСТАНА, КАЗАХСТАН
          </span>
          <span className="world-caption">Ваш город. Ваша история.</span>
        </div>
        {decisions.length > 0 ? (
          <div className="view-toggle" aria-label="Состояние города">
            <button
              aria-pressed={!forecast}
              className={!forecast ? "active" : ""}
              onClick={() => setForecast(false)}
            >
              До решений
            </button>
            <button
              aria-pressed={forecast}
              className={forecast ? "active" : ""}
              onClick={() => setForecast(true)}
            >
              Прогноз
            </button>
          </div>
        ) : null}
        <section
          className={`journey-card ${selected ? "district-card" : "welcome-card"}`}
          ref={journeyCard}
          aria-label="Следующий шаг"
        >
          <div className="step-label">
            <span>
              {scenario.valid
                ? "ПЛАН ГОТОВ"
                : `РЕШЕНИЕ ${Math.min(decisions.length + 1, 5)} ИЗ 5`}
            </span>
            <div className="step-dots" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <i key={i} className={i < decisions.length ? "done" : ""} />
              ))}
            </div>
          </div>
          {selected ? (
            <>
              <div className="district-title">
                <h1>{district.name}</h1>
                <button
                  className="icon-button"
                  aria-label="Закрыть район"
                  onClick={() => setSelected(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <p className="journey-description">{needs[weakest.code]}</p>
              <div className="district-need">
                <span>{indicatorLabels[weakest.code]}</span>
                <strong>
                  {Number(values[weakest.code].toFixed(1))}
                  <small> / 100</small>
                </strong>
                <div className="need-track">
                  <i style={{ width: `${values[weakest.code]}%` }} />
                </div>
                <small>
                  {forecast
                    ? "Прогноз по вашему плану"
                    : "Показатель учебной модели"}
                </small>
              </div>
              {scenario.valid ? (
                <button className="primary-button" onClick={evaluate}>
                  Посмотреть результат <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  className="primary-button"
                  onClick={openCatalog}
                  disabled={!scenario.loaded}
                >
                  Выбрать решение <ArrowRight size={18} />
                </button>
              )}
              <details className="district-more">
                <summary>Подробнее о районе</summary>
                <p>{district.profile}</p>
                <div className="metric-list">
                  {dataset.indicators.map((i) => (
                    <div className="metric-row" key={i.code}>
                      <span>{indicatorLabels[i.code]}</span>
                      <strong>{Number(values[i.code].toFixed(2))}</strong>
                    </div>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <>
              <span className="welcome-illustration">
                <Landmark size={31} />
                <Leaf size={18} />
              </span>
              <h1>
                {scenario.valid
                  ? "Пять решений. Один новый город."
                  : decisions.length
                    ? "Продолжим менять город?"
                    : "Астана начинается с вас."}
              </h1>
              <p className="journey-description">
                {scenario.valid
                  ? "Ваш план готов. Узнайте, как изменится жизнь в городе."
                  : "У вас 100 единиц бюджета и пять решений. Каким станет город — решаете вы."}
              </p>
              {scenario.valid ? (
                <button className="primary-button" onClick={evaluate}>
                  Посмотреть результат <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  className="primary-button"
                  onClick={() => chooseDistrict("nura")}
                  disabled={!scenario.loaded}
                >
                  {decisions.length
                    ? "Выбрать следующее решение"
                    : "Начать с района Нура"}{" "}
                  <ArrowRight size={18} />
                </button>
              )}
              <p className="gentle-hint">
                {scenario.valid
                  ? "AI объяснит сильные стороны и риски."
                  : "Или нажмите на любой район на карте."}
              </p>
            </>
          )}
        </section>
        <nav className="mobile-districts" aria-label="Выбор района">
          {dataset.districts.map((d) => (
            <button
              key={d.id}
              aria-pressed={selected === d.id}
              onClick={() => chooseDistrict(d.id)}
            >
              {d.name}
            </button>
          ))}
        </nav>
        <div className="game-feedback" role="status">
          {scenario.notice ? (
            <span>{scenario.notice}</span>
          ) : lastAdded ? (
            <>
              <Check size={17} />
              <span>Решение добавлено. Осталось: {5 - decisions.length}.</span>
              <button
                onClick={() => {
                  scenario.remove(lastAdded);
                  setLastAdded(null);
                }}
              >
                Отменить <Undo2 size={13} />
              </button>
            </>
          ) : decisions.some((d) => d.district_id === null) ? (
            <span>Городские решения действуют во всех пяти районах.</span>
          ) : null}
        </div>
      </main>
      <footer className="game-footer">
        <div>
          <strong>
            аким <span>на 5 часов</span>
          </strong>
          <p>Попробуйте изменить город к лучшему.</p>
        </div>
        <nav aria-label="Информация об игре">
          <button onClick={() => aboutDialog.current?.showModal()}>
            Об игре и команде
          </button>
          <button onClick={() => rulesDialog.current?.showModal()}>
            Как играть
          </button>
          <a href="/maps/astana-source.json" download>
            Данные карты
          </a>
        </nav>
        <p className="footer-note">
          Учебная игра · 5 районов датасета
          <br />
          Показатели синтетические, границы игровые
        </p>
      </footer>

      <dialog ref={planDialog} className="rules-dialog plan-dialog">
        <div className="dialog-heading">
          <div>
            <div className="eyebrow">ВАШИ ГОРОДСКИЕ ИЗМЕНЕНИЯ</div>
            <h2>Мой план · {decisions.length} из 5</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Закрыть план"
            onClick={() => planDialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <p className="small-muted">
          Осталось {simulation.budget.remaining} из 100 единиц бюджета.
        </p>
        {decisions.length ? (
          <ol className="decision-list">
            {decisions.map((d) => {
              const m = dataset.measures.find((m) => m.id === d.measure_id)!;
              const Icon = categoryIcons[m.direction_id];
              return (
                <li key={d.measure_id}>
                  <span className="decision-icon">
                    <Icon size={20} />
                  </span>
                  <div>
                    <strong>{m.name}</strong>
                    <small>
                      {d.district_id
                        ? dataset.districts.find((r) => r.id === d.district_id)
                            ?.name
                        : "Весь город"}{" "}
                      · {m.cost} ед.
                    </small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Удалить ${d.measure_id}`}
                    onClick={() => {
                      scenario.remove(d.measure_id);
                      setLastAdded(null);
                    }}
                  >
                    <X size={17} />
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="empty-plan">
            Пока здесь пусто. Выберите район на карте и добавьте первое решение.
          </p>
        )}
        <button
          className="primary-button"
          disabled={!scenario.valid}
          onClick={evaluate}
        >
          Посмотреть результат <ArrowRight size={17} />
        </button>
        {decisions.length ? (
          <button
            className="text-button"
            onClick={() => {
              scenario.replace([]);
              setLastAdded(null);
              setForecast(false);
            }}
          >
            Очистить план
          </button>
        ) : null}
      </dialog>
      <dialog ref={aboutDialog} className="rules-dialog">
        <div className="dialog-heading">
          <h2>Город, в котором важны вы</h2>
          <button
            className="icon-button"
            aria-label="Закрыть информацию"
            onClick={() => aboutDialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <p>
          «Аким на 5 часов» — хакатон-проект команды из двух разработчиков.
          Попробуйте роль городского управленца: распределите ограниченный
          бюджет и посмотрите на последствия через два года.
        </p>
        <p>
          Реальная география дорог, водоёмов, парков и зданий взята из
          OpenStreetMap. Объём и достопримечательности стилизованы. Игровые зоны
          условны: в датасете пять районов, а в современной Астане шесть
          административных районов.
        </p>
        <p>
          Баллы рассчитываются по правилам датасета. AI получает готовый расчёт
          и объясняет его, не меняя числа. Эта игра не оценивает реальное
          состояние Астаны.
        </p>
        <a
          className="text-link"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors · ODbL 1.0
        </a>
      </dialog>

      <dialog ref={catalogDialog} className="catalog-dialog">
        <div className="dialog-heading">
          <div>
            <div className="eyebrow">ОДНО РЕШЕНИЕ — ОДНО ИЗМЕНЕНИЕ</div>
            <h2>Что улучшим в районе {district.name}?</h2>
            <p>
              Осталось {simulation.budget.remaining} ед. · выбрано{" "}
              {decisions.length} из 5 решений
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Закрыть каталог"
            onClick={() => catalogDialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <div className="category-options" aria-label="Направления">
          {dataset.directions.map((d) => {
            const Icon = categoryIcons[d.id];
            return (
              <button
                key={d.id}
                className={direction === d.id ? "active" : ""}
                aria-pressed={direction === d.id}
                onClick={() => setDirection(d.id)}
              >
                <Icon size={19} />
                {d.name}
              </button>
            );
          })}
          <button
            className={direction === "all" ? "active" : ""}
            aria-pressed={direction === "all"}
            onClick={() => setDirection("all")}
          >
            Все решения
          </button>
        </div>
        <div className="catalog-grid">
          {measures.map((measure) => {
            const Icon = categoryIcons[measure.direction_id];
            const added = decisions.some((d) => d.measure_id === measure.id);
            const next = [
              ...decisions,
              {
                measure_id: measure.id,
                district_id: measure.scope === "city" ? null : district.id,
              },
            ];
            const validation = validateSelections(dataset, next, {
              draft: true,
            });
            const reason = !validation.valid
              ? (Object.values(validation.error.field_errors ?? {}).flat()[0] ??
                validation.error.message)
              : "";
            const positive = Object.entries(measure.effects).filter(
              ([, v]) => (v ?? 0) > 0,
            );
            const negative = Object.entries(measure.effects).filter(
              ([, v]) => (v ?? 0) < 0,
            );
            return (
              <article
                className={`measure-card ${added ? "measure-added" : ""}`}
                key={measure.id}
              >
                <div className="measure-top">
                  <span className="measure-icon">
                    <Icon size={24} />
                  </span>
                  <strong>
                    {measure.cost}
                    <small> ед.</small>
                  </strong>
                </div>
                <h3>{measure.name}</h3>
                <p className="measure-benefit">
                  Улучшит:{" "}
                  {positive
                    .map(([code]) => indicatorLabels[code].toLowerCase())
                    .join(", ")}
                  .
                </p>
                {negative.length ? (
                  <p className="measure-tradeoff">
                    Компромисс: снизится показатель «
                    {negative.map(([code]) => indicatorLabels[code]).join(", ")}
                    ».
                  </p>
                ) : null}
                <div className="measure-timing">
                  <MapPin size={13} />
                  {measure.scope === "city"
                    ? "Во всех пяти районах"
                    : district.name}
                </div>
                <div className="measure-timing">
                  <Clock3 size={13} />
                  Задержка эффекта: {measure.lag_quarters * 3} мес.
                </div>
                <details className="measure-details">
                  <summary>Эффекты в цифрах</summary>
                  {Object.entries(measure.effects).map(([code, value]) => (
                    <p key={code}>
                      {indicatorLabels[code]}: {(value ?? 0) > 0 ? "+" : ""}
                      {value}
                    </p>
                  ))}
                  <small>
                    Полные эффекты до учёта задержки. Прогноз рассчитан на 8
                    кварталов.
                  </small>
                </details>
                <button
                  className="add-measure"
                  aria-label={`Добавить ${measure.id}`}
                  disabled={!scenario.loaded || !validation.valid}
                  onClick={() => {
                    scenario.replace(next);
                    setForecast(true);
                    setLastAdded(measure.id);
                    catalogDialog.current?.close();
                  }}
                >
                  {added ? (
                    <>
                      <Check size={16} />В вашем плане
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Выбрать за {measure.cost} ед.
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
        <p className="catalog-footnote">
          Можно выбрать не более двух решений одного направления. Недоступные
          варианты объясняют причину.
        </p>
      </dialog>
      <dialog ref={rulesDialog} className="rules-dialog">
        <div className="dialog-heading">
          <div>
            <div className="eyebrow">ПЯТЬ РЕШЕНИЙ ДЛЯ ГОРОДА</div>
            <h2>Как стать акимом</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Закрыть правила"
            onClick={() => rulesDialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <ol>
          <li>
            <strong>Изучите город.</strong> Пять районов и десять показателей
            помогут найти приоритеты.
          </li>
          <li>
            <strong>Распределите 100 единиц.</strong> Выберите пять разных
            мероприятий, не более двух из одного направления.
          </li>
          <li>
            <strong>Учитывайте последствия.</strong> Районные меры требуют
            выбора района, городские действуют повсюду. Есть лаги, синергии и
            несовместимости.
          </li>
          <li>
            <strong>Оцените результат.</strong> Score учитывает средний и
            слабейший район, а также показатели ниже 40. AI объясняет результат.
          </li>
        </ol>
        <div className="formula-note">
          Score = 0,7 × средний индекс + 0,3 × минимальный индекс − число
          критических показателей
        </div>
        <p className="small-muted">
          Показатели синтетические. Прогноз — результат учебной модели, а не
          оценка реальных городских проектов.
        </p>
        <button
          className="district-action"
          onClick={() => {
            scenario.replace(dataset.example.decisions);
            setForecast(true);
            rulesDialog.current?.close();
          }}
        >
          Загрузить контрольный пример · 95 ед. <ArrowRight size={16} />
        </button>
      </dialog>

      <dialog ref={resultDialog} className="rules-dialog result-dialog">
        <div className="dialog-heading">
          <div>
            <div className="eyebrow">РЕЗУЛЬТАТ ВАШИХ РЕШЕНИЙ</div>
            <h2>
              {simulation.score_delta > 0
                ? "Ваш город стал лучше."
                : "У каждого решения есть последствия."}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Закрыть результат"
            onClick={() => resultDialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <div className="result-score">
          <span>Astana Quality of Life Score</span>
          <strong>
            {scenario.valid ? format(simulation.after.score) : "—"}
          </strong>
          <span>
            {simulation.score_delta >= 0 ? "+" : ""}
            {format(simulation.score_delta)} к исходному состоянию
          </span>
        </div>
        <div className="result-breakdown">
          <div>
            <span>Средний индекс</span>
            <strong>{format(simulation.after.city_average)}</strong>
          </div>
          <div>
            <span>Слабейший район</span>
            <strong>{format(simulation.after.minimum_district_score)}</strong>
          </div>
          <div>
            <span>Критических значений</span>
            <strong>{simulation.after.critical_count}</strong>
          </div>
          <div>
            <span>Потрачено бюджета</span>
            <strong>{simulation.budget.spent} / 100</strong>
          </div>
        </div>
        <div className="formula-note">
          {simulation.applied_synergies.length
            ? `Сработало синергий: ${simulation.applied_synergies.length}. `
            : ""}
          Числа рассчитаны общим модулем по правилам GitHub-датасета.
        </div>
        <p className="small-muted">
          AI объясняет сценарий и не изменяет Score.
        </p>
        <ReportExplanation
          report={report}
          onRetry={() => {
            void report.run(decisions);
          }}
        />
      </dialog>
    </div>
  );
}
