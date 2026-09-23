"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  BusFront,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  Globe2,
  Landmark,
  Leaf,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wallet,
  Waves,
  X,
} from "lucide-react";
import dataset from "../../dataset/dataset.json";
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
  T1: "Разгрузка дорог",
  T2: "Общественный транспорт",
  E1: "Озеленение",
  E2: "Качество воздуха",
  S1: "Школы и детские сады",
  S2: "Первичная медицина",
  B1: "Безопасность улиц",
  B2: "Безопасность движения",
  C1: "Надёжность ЖКХ",
  C2: "Обращения жителей",
};
const districtHints: Record<string, string> = {
  nura: "Район возможностей",
  esil: "Деловое сердце города",
  almaty: "Город с историей",
  saryarka: "Зелёное будущее",
  baikonur: "Баланс городской жизни",
};
type DirectionId = Direction;

export default function CityWorkspace() {
  const [selected, setSelected] = useState("nura");
  const [direction, setDirection] = useState<DirectionId | "all">("all");
  const catalogDialog = useRef<HTMLDialogElement>(null);
  const rulesDialog = useRef<HTMLDialogElement>(null);
  const district = dataset.districts.find((d) => d.id === selected)!;
  const measures = dataset.measures.filter(
    (m) => direction === "all" || m.direction_id === direction,
  );
  const indicators = dataset.indicators.filter(
    (i) => direction === "all" || i.direction_id === direction,
  );
  const openCatalog = () => catalogDialog.current?.showModal();

  return (
    <div className="application">
      <header className="app-header">
        <Link className="brand" href="/" aria-label="Аким на 5 часов — главная">
          <span className="brand-mark">
            <Landmark size={23} strokeWidth={1.6} />
          </span>
          <span>
            аким<span className="brand-sub">на 5 часов</span>
          </span>
        </Link>
        <nav className="header-nav" aria-label="Основная навигация">
          <button className="nav-active">
            <Compass size={16} /> Город и решения
          </button>
          <button onClick={openCatalog}>
            Мероприятия <span>14</span>
          </button>
        </nav>
        <div className="header-actions">
          <span className="simulation-label">
            <i /> Симулятор города
          </span>
          <button
            className="icon-button"
            aria-label="Правила игры"
            onClick={() => rulesDialog.current?.showModal()}
          >
            <CircleHelp size={20} />
          </button>
          <span className="avatar">АК</span>
        </div>
      </header>

      <main className="workspace">
        <section className="page-heading">
          <div>
            <div className="eyebrow">ВАШ ГОРОД. ВАШИ РЕШЕНИЯ.</div>
            <h1>
              Сегодня Астана в ваших руках<span>.</span>
            </h1>
            <p>Пять решений, один бюджет — тысячи возможностей для города.</p>
          </div>
          <button
            className="text-link"
            onClick={() => rulesDialog.current?.showModal()}
          >
            Как это работает <ArrowUpRight size={16} />
          </button>
        </section>

        <div className="workspace-grid">
          <aside className="plan-sidebar" aria-label="План решений">
            <section className="budget-card">
              <div className="budget-label">
                <Wallet size={17} /> Городской бюджет <span>01</span>
              </div>
              <div className="budget-value">
                100<span> / 100</span>
              </div>
              <div className="budget-caption">условных единиц доступно</div>
              <div className="budget-track">
                <span />
              </div>
              <div className="budget-foot">
                <span>
                  Потрачено <strong>0</strong>
                </span>
                <span>
                  Осталось <strong>100</strong>
                </span>
              </div>
            </section>
            <section className="decision-plan">
              <div className="section-title">
                <h2>Ваш план</h2>
                <span className="count-pill">0 / 5</span>
              </div>
              <p className="small-muted">Каждое решение меняет город.</p>
              <ol className="decision-list">
                {Array.from({ length: 5 }, (_, i) => (
                  <li key={i}>
                    <span className="step-number">0{i + 1}</span>
                    <div>
                      <strong>
                        {i === 0 ? "Первое решение — за вами" : "Новое решение"}
                      </strong>
                      <span>
                        {i === 0
                          ? "Изучите районы и мероприятия"
                          : "Место для вашего выбора"}
                      </span>
                    </div>
                    {i === 0 ? (
                      <button
                        aria-label="Изучить мероприятия для первого решения"
                        onClick={openCatalog}
                      >
                        <Plus size={16} />
                      </button>
                    ) : (
                      <span className="step-placeholder">+</span>
                    )}
                  </li>
                ))}
              </ol>
              <div className="plan-note">
                <Leaf size={17} />
                <p>
                  Сильный город начинается
                  <br />с внимания к каждому району.
                </p>
              </div>
              <button className="analysis-button" disabled>
                <Sparkles size={16} /> Оценить сценарий <ArrowRight size={17} />
              </button>
              <p className="stage-note">
                Выбор решений появится после
                <br />
                подключения расчётного модуля.
              </p>
            </section>
            <div className="horizon-card">
              <Clock3 size={20} />
              <div>
                <strong>Думаем на два года вперёд</strong>
                <span>Горизонт моделирования · 8 кварталов</span>
              </div>
            </div>
          </aside>

          <section className="city-panel" aria-label="Исследование города">
            <div className="city-toolbar">
              <div className="city-title">
                <span className="live-dot" />
                <h2>Панорама города</h2>
              </div>
              <span className="state-label">Исходное состояние</span>
            </div>
            <div className="category-filters" aria-label="Направления">
              <button
                className={direction === "all" ? "active" : ""}
                onClick={() => setDirection("all")}
              >
                <Globe2 size={15} /> Всё
              </button>
              {dataset.directions.map((d) => {
                const Icon = categoryIcons[d.id as DirectionId];
                return (
                  <button
                    key={d.id}
                    className={direction === d.id ? "active" : ""}
                    onClick={() => setDirection(d.id as DirectionId)}
                  >
                    <Icon size={15} />
                    {d.name}
                  </button>
                );
              })}
            </div>
            <CityMap selected={selected} onSelect={setSelected} />
            <div className="city-insight">
              <span className="insight-icon">
                <MapPin size={19} />
              </span>
              <div>
                <strong>У каждого района — своя история</strong>
                <p>
                  Нажмите на район, чтобы увидеть его показатели и точки роста.
                </p>
              </div>
              <span className="mini-tag">ИССЛЕДУЙТЕ</span>
            </div>
            <section
              className="city-stats"
              aria-label="Исходные показатели города"
            >
              <div>
                <span>
                  Качество жизни города <CircleHelp size={12} />
                </span>
                <strong>
                  {dataset.baseline.score.toFixed(2).replace(".", ",")}
                  <small>Score</small>
                </strong>
                <p>Исходная оценка</p>
              </div>
              <div>
                <span>Средний индекс районов</span>
                <strong>
                  {dataset.baseline.city_average.toFixed(2).replace(".", ",")}
                  <small>/ 100</small>
                </strong>
                <p>С учётом доли населения</p>
              </div>
              <div>
                <span>Требуют внимания</span>
                <strong className="warm-number">
                  {dataset.baseline.critical_count}
                  <small>показателя</small>
                </strong>
                <p>Значения ниже 40</p>
              </div>
            </section>
          </section>

          <aside
            className="district-sidebar"
            aria-label={`Показатели района ${district.name}`}
          >
            <div className="district-cover">
              <div className="district-cover-grid" />
              <span className="district-type">
                <MapPin size={12} /> ВЫБРАННЫЙ РАЙОН
              </span>
              <Building2 className="cover-building b1" />
              <Building2 className="cover-building b2" />
              <Landmark className="cover-building b3" />
              <div className="district-cover-name">{district.name}</div>
              <span className="cover-caption">
                {districtHints[district.id]}
              </span>
            </div>
            <div className="district-details">
              <div className="district-heading">
                <h2>{district.name}</h2>
                <span className="population-chip">
                  <UsersRound size={13} />{" "}
                  {Math.round(district.population_share * 100)}% жителей
                </span>
              </div>
              <p className="district-profile">{district.profile}</p>
              <div className="district-score">
                <div>
                  <span>Индекс района</span>
                  <strong>
                    {district.computed_district_score
                      .toFixed(2)
                      .replace(".", ",")}
                    <small>/ 100</small>
                  </strong>
                </div>
                <div className="score-status">
                  <span className="status-dot" />
                  {district.computed_district_score < 50
                    ? "Есть потенциал роста"
                    : "Есть точки улучшения"}
                </div>
              </div>
              <div className="metric-heading">
                <h3>Показатели района</h3>
                <span>0 — 100</span>
              </div>
              <div className="metric-list">
                {indicators.map((indicator) => {
                  const value =
                    district.indicators[
                      indicator.code as keyof typeof district.indicators
                    ];
                  const critical = value < dataset.scoring.critical_threshold;
                  return (
                    <div
                      className={`metric-row ${critical ? "critical" : ""}`}
                      key={indicator.code}
                    >
                      <div>
                        <span>{indicatorLabels[indicator.code]}</span>
                        <strong>
                          {value}
                          {critical ? <ArrowDownRight size={12} /> : null}
                        </strong>
                      </div>
                      <div className="metric-track">
                        <span style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="district-action" onClick={openCatalog}>
                Изучить мероприятия <ArrowUpRight size={17} />
              </button>
              <p className="district-footnote">
                Районные меры действуют здесь,
                <br />
                городские — во всех пяти районах.
              </p>
            </div>
          </aside>
        </div>
        <footer className="app-footer">
          <span>
            <Waves size={15} /> ASTANA URBAN LAB{" "}
            <span className="footer-divider">/</span> Пространство городских
            решений
          </span>
          <span>
            Учебная симуляция <i /> Данные синтетические
          </span>
        </footer>
      </main>

      <dialog ref={catalogDialog} className="catalog-dialog">
        <div className="dialog-heading">
          <div>
            <div className="eyebrow">КАТАЛОГ ГОРОДСКИХ ИЗМЕНЕНИЙ</div>
            <h2>Решения для лучшего города</h2>
            <p>{district.name} · изучите эффект, стоимость и охват</p>
          </div>
          <button
            className="icon-button"
            aria-label="Закрыть каталог"
            onClick={() => catalogDialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <div className="catalog-filter">
          <label htmlFor="direction-filter">Направление</label>
          <select
            id="direction-filter"
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as DirectionId | "all")
            }
          >
            <option value="all">Все направления</option>
            {dataset.directions.map((d) => (
              <option value={d.id} key={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </div>
        <div className="catalog-grid">
          {measures.map((measure) => {
            const Icon = categoryIcons[measure.direction_id as DirectionId];
            return (
              <article className="measure-card" key={measure.id}>
                <div className="measure-top">
                  <span className="measure-icon">
                    <Icon size={19} />
                  </span>
                  <span>
                    {measure.scope === "city" ? "Весь город" : district.name}
                  </span>
                  <strong>
                    {measure.cost}
                    <small> ед.</small>
                  </strong>
                </div>
                <h3>{measure.name}</h3>
                <div className="measure-timing">
                  <Clock3 size={13} /> Лаг: {measure.lag_quarters} кв.{" "}
                  <span>·</span> {measure.id}
                </div>
                <div className="effect-tags">
                  {Object.entries(measure.effects).map(([code, value]) =>
                    value === undefined ? null : (
                      <span key={code} className={value < 0 ? "negative" : ""}>
                        {code} {value > 0 ? "+" : ""}
                        {value}
                      </span>
                    ),
                  )}
                </div>
                <p>Полные эффекты до учёта лага</p>
              </article>
            );
          })}
        </div>
        <div className="catalog-stage">
          <Check size={16} />
          <span>
            Каталог из GitHub · 14 мероприятий. На этом этапе доступно изучение;
            выбор и расчёт подключаются следующим шагом.
          </span>
        </div>
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
          Сейчас доступен первый этап: карта и изучение исходных данных. Числа
          на главном экране — исходные значения из датасета, а не результат
          принятых решений.
        </p>
      </dialog>
    </div>
  );
}
