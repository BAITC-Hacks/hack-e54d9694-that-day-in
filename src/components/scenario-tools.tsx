"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  ArrowRight,
  Download,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  CloudRain,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { dataset } from "@/data";
import PresentationSlide from "./presentation-slide";
import { validateSelections } from "@/lib/simulation";
import type { Decision, EvidenceFact } from "@/shared/contracts";
import {
  CityEventSchema,
  EventResponseSchema,
  FEATURES_VERSION,
  LeaderboardResponseSchema,
  LeaderboardSubmitResponseSchema,
  ParticipantNameSchema,
  PresentationResponseSchema,
  RecommendationsResponseSchema,
  type CityEvent,
} from "@/shared/features";
import {
  decisionsKey,
  post,
  prepareRequest,
  readResponse,
  useRequest,
  verifyCurrent,
} from "@/features/scenario-tools/client";
const format = (value: number) => value.toFixed(2).replace(".", ",");
const signed = (value: number) => (value > 0 ? "+" : "") + format(value);
const name = (d: Decision) =>
  `${dataset.measures.find((m) => m.id === d.measure_id)?.name} · ${d.district_id ? dataset.districts.find((r) => r.id === d.district_id)?.name : "Весь город"}`;
export type ToolName =
  "recommendations" | "events" | "comparison" | "presentation";
type Props = {
  decisions: Decision[];
  valid: boolean;
  onApply: (d: Decision[]) => void;
};
export function RequestStatus({
  busy,
  error,
}: {
  busy: boolean;
  error: string;
}) {
  return (
    <div aria-live="polite">
      {busy ? (
        <p className="request-loading">
          <LoaderCircle size={17} className="loading-icon" />
          Обрабатываем сценарий…
        </p>
      ) : null}
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
function Evidence({ ids, facts }: { ids: string[]; facts: EvidenceFact[] }) {
  return (
    <details className="evidence">
      <summary>Основания</summary>
      {ids.map((id) => {
        const f = facts.find((f) => f.id === id);
        return f ? (
          <p key={id}>
            <strong>{f.label}</strong>
            <br />
            {f.value}
          </p>
        ) : null;
      })}
    </details>
  );
}
function Requirement() {
  return (
    <p className="notice">
      Для этой функции сначала выберите пять допустимых мероприятий в разделе
      «Сценарий».
    </p>
  );
}
export default function ScenarioTools({
  tool,
  ...props
}: Props & { tool: ToolName }) {
  if (tool === "comparison") return <Comparison {...props} />;
  if (!props.valid) return <Requirement />;
  if (tool === "recommendations") return <Recommendations {...props} />;
  if (tool === "events") return <Events {...props} />;
  return <Presentation {...props} />;
}
function Recommendations({ decisions, onApply }: Props) {
  const request = useRequest<z.infer<typeof RecommendationsResponseSchema>>();
  const apply = useRequest<boolean>();
  const load = () =>
    request.run(async (signal) => {
      const body = await prepareRequest(decisions, signal);
      const response = await post(
        "/api/recommendations",
        body,
        RecommendationsResponseSchema,
        signal,
      );
      if (
        response.source.dataset_version !== body.dataset_version ||
        decisionsKey(response.source.decisions) !== decisionsKey(decisions)
      )
        throw new Error("Рекомендации относятся к другому сценарию.");
      return response;
    });
  return (
    <section className="tool-content">
      <div className="tool-intro">
        <span className="section-kicker">ОБОСНОВАННЫЕ АЛЬТЕРНАТИВЫ</span>
        <h2>Что можно улучшить</h2>
        <p>
          Система проверит допустимые замены одного мероприятия. AI объяснит
          выигрыш и возможные компромиссы.
        </p>
        <button
          className="primary-button"
          disabled={request.busy}
          onClick={() => void load()}
        >
          <Sparkles size={17} />
          {request.data ? "Обновить рекомендации" : "Найти улучшения"}
        </button>
      </div>
      <RequestStatus {...request} />
      <RequestStatus {...apply} />
      {request.data ? (
        <>
          <p className="notice">
            {request.data.status === "ai_unavailable"
              ? "AI-объяснение недоступно. Ниже — проверенные расчётным модулем варианты."
              : request.data.status === "no_improvement"
                ? "Замена одного решения не даёт улучшения. Это не означает, что найден глобальный оптимум."
                : request.data.notes?.summary}
          </p>
          <div className="alternatives">
            {request.data.candidates.map((c) => {
              const note = request.data?.notes?.items.find(
                (n) => n.candidate_id === c.id,
              );
              return (
                <article className="alternative" key={c.id}>
                  <div className="alternative-heading">
                    <span>Вариант {c.id.split("-").at(-1)}</span>
                    <strong>{signed(c.score_gain)} Score</strong>
                  </div>
                  <div className="replacement">
                    <p>
                      <small>Заменить</small>
                      {name(c.removed)}
                    </p>
                    <ArrowRight size={20} />
                    <p>
                      <small>На</small>
                      {name(c.added)}
                    </p>
                  </div>
                  <div className="mini-stats">
                    <span>
                      Бюджет <b>{c.simulation.budget.spent} / 100</b>
                    </span>
                    <span>
                      Изменение расходов <b>{signed(c.cost_delta)}</b>
                    </span>
                    <span>
                      Итоговый Score <b>{format(c.simulation.after.score)}</b>
                    </span>
                  </div>
                  {note ? (
                    <>
                      <p>{note.explanation}</p>
                      <p className="muted">Компромисс: {note.tradeoff}</p>
                      <Evidence
                        ids={note.evidence_ids}
                        facts={request.data!.evidence}
                      />
                    </>
                  ) : null}
                  <button
                    className="secondary-button"
                    disabled={apply.busy}
                    onClick={() =>
                      void apply.run(async (signal) => {
                        const current = await verifyCurrent(decisions, signal);
                        if (
                          current.scenario_key !==
                          request.data?.source.scenario_key
                        )
                          throw new Error(
                            "Сценарий изменился. Запросите рекомендации заново.",
                          );
                        onApply(c.decisions);
                        return true;
                      })
                    }
                  >
                    Применить вариант <ArrowRight size={16} />
                  </button>
                </article>
              );
            })}
          </div>
          <p className="small-muted">
            Поиск ограничен одной заменой. Рост общего Score не гарантирует
            улучшение каждого района.
          </p>
        </>
      ) : null}
    </section>
  );
}
const EventsCatalogSchema = z.object({
  dataset_version: z.string(),
  event_version: z.literal(FEATURES_VERSION),
  events: z.array(CityEventSchema),
});
const DrawSchema = z.object({
  dataset_version: z.string(),
  event_version: z.literal(FEATURES_VERSION),
  event: CityEventSchema,
});
function Events({ decisions }: Props) {
  const catalog = useRequest<z.infer<typeof EventsCatalogSchema>>();
  const draw = useRequest<z.infer<typeof DrawSchema>>();
  const result = useRequest<z.infer<typeof EventResponseSchema>>();
  const [event, setEvent] = useState<CityEvent | null>(null);
  const [draft, setDraft] = useState<Decision[]>(decisions);
  const loadCatalog = catalog.run;
  useEffect(() => {
    void loadCatalog((signal) =>
      fetch("/api/events", { signal }).then((r) =>
        readResponse(r, EventsCatalogSchema),
      ),
    );
  }, [loadCatalog]); // Each mount is keyed to the original scenario.
  const validation = validateSelections(dataset, draft);
  const spent = draft.reduce(
    (sum, d) =>
      sum + (dataset.measures.find((m) => m.id === d.measure_id)?.cost ?? 0),
    0,
  );
  const available = 100 - (event?.reserve_cost ?? 0);
  const valid = validation.valid && spent <= available;
  const change = (d: Decision[]) => {
    result.reset();
    setDraft(d);
  };
  const choose = (e: CityEvent | null) => {
    draw.reset();
    result.reset();
    setEvent(e);
  };
  return (
    <section className="tool-content">
      <div className="tool-intro">
        <span className="section-kicker">ПРОВЕРКА УСТОЙЧИВОСТИ</span>
        <h2>Городские события</h2>
        <p>
          Смоделируйте изменение условий и перераспределите бюджет. Это
          отдельный сценарий: основной план сохранится.
        </p>
      </div>
      <RequestStatus {...catalog} />
      <RequestStatus {...draw} />
      {catalog.error ? (
        <button
          className="secondary-button"
          onClick={() =>
            void catalog.run((signal) =>
              fetch("/api/events", { signal }).then((r) =>
                readResponse(r, EventsCatalogSchema),
              ),
            )
          }
        >
          Повторить загрузку
        </button>
      ) : null}
      {catalog.data ? (
        <>
          <div className="event-picker">
            {catalog.data.events.map((e) => (
              <button
                key={e.id}
                aria-pressed={event?.id === e.id}
                className={event?.id === e.id ? "selected" : ""}
                onClick={() => choose(e)}
              >
                <CloudRain size={20} />
                <strong>{e.title}</strong>
                <span>Резерв {e.reserve_cost} ед.</span>
              </button>
            ))}
            <button
              disabled={draw.busy}
              onClick={() =>
                void draw
                  .run(async (signal) => {
                    const body = await prepareRequest(decisions, signal);
                    return post(
                      "/api/events",
                      { dataset_version: body.dataset_version },
                      DrawSchema,
                      signal,
                    );
                  })
                  .then((value) => {
                    if (value) choose(value.event);
                  })
              }
            >
              <RefreshCw size={20} />
              <strong>Случайное событие</strong>
              <span>Выбор сервером</span>
            </button>
          </div>
          {event ? (
            <>
              <p className="notice">
                {event.description} Событие происходит до внедрения мер, поэтому
                их стоимость возвращается полностью при замене.
              </p>
              <div className="mini-stats event-budget">
                <span>
                  Исходный бюджет <b>100</b>
                </span>
                <span>
                  Экстренный резерв <b>{event.reserve_cost}</b>
                </span>
                <span>
                  На мероприятия <b>{available}</b>
                </span>
                <span>
                  Остаток{" "}
                  <b className={available - spent < 0 ? "negative" : ""}>
                    {available - spent}
                  </b>
                </span>
              </div>
              <h3>Перераспределение мероприятий</h3>
              <div className="event-editor">
                {draft.map((d, i) => {
                  const m = dataset.measures.find(
                    (m) => m.id === d.measure_id,
                  )!;
                  return (
                    <div key={i}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <label className="sr-only" htmlFor={`event-measure-${i}`}>
                        Мероприятие {i + 1}
                      </label>
                      <select
                        id={`event-measure-${i}`}
                        value={d.measure_id}
                        onChange={(e) => {
                          const m = dataset.measures.find(
                            (m) => m.id === e.target.value,
                          )!;
                          change(
                            draft.map((r, j) =>
                              j === i
                                ? {
                                    measure_id: m.id,
                                    district_id:
                                      m.scope === "city"
                                        ? null
                                        : (d.district_id ?? "nura"),
                                  }
                                : r,
                            ),
                          );
                        }}
                      >
                        {dataset.measures.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} · {m.cost} ед.
                          </option>
                        ))}
                      </select>
                      <label
                        className="sr-only"
                        htmlFor={`event-district-${i}`}
                      >
                        Район мероприятия {i + 1}
                      </label>
                      <select
                        id={`event-district-${i}`}
                        value={d.district_id ?? ""}
                        disabled={m.scope === "city"}
                        onChange={(e) =>
                          change(
                            draft.map((r, j) =>
                              j === i
                                ? { ...r, district_id: e.target.value }
                                : r,
                            ),
                          )
                        }
                      >
                        {m.scope === "city" ? (
                          <option value="">Весь город</option>
                        ) : (
                          dataset.districts.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  );
                })}
              </div>
              {!valid ? (
                <p className="notice error" role="alert">
                  {spent > available
                    ? `План превышает доступный бюджет на ${spent - available} ед. Замените мероприятия. Итоговая оценка недоступна.`
                    : !validation.valid
                      ? (Object.values(
                          validation.error.field_errors ?? {},
                        ).flat()[0] ?? validation.error.message)
                      : ""}
                </p>
              ) : null}
              <div className="button-row">
                <button
                  className="primary-button"
                  disabled={!valid || result.busy}
                  onClick={() =>
                    void result.run(async (signal) => {
                      const body = await prepareRequest(draft, signal);
                      const response = await post(
                        "/api/events/simulate",
                        {
                          ...body,
                          event_version: FEATURES_VERSION,
                          event_id: event.id,
                        },
                        EventResponseSchema,
                        signal,
                      );
                      if (
                        response.dataset_version !== body.dataset_version ||
                        response.event.id !== event.id ||
                        decisionsKey(response.decisions) !== decisionsKey(draft)
                      )
                        throw new Error(
                          "Ответ события относится к другому плану.",
                        );
                      return response;
                    })
                  }
                >
                  Рассчитать последствия <ArrowRight size={16} />
                </button>
                <button
                  className="text-button"
                  onClick={() => change(decisions)}
                >
                  Вернуть исходный план
                </button>
              </div>
              <RequestStatus {...result} />
              {result.data ? (
                <div className="event-result">
                  <span>Score сценария с событием</span>
                  <strong>{format(result.data.simulation.after.score)}</strong>
                  <p>
                    {signed(result.data.simulation.score_delta)} относительно
                    состояния сразу после события, до мероприятий.
                  </p>
                  <p>
                    Всего: {result.data.total_budget.measures_spent} на меры +{" "}
                    {result.data.total_budget.emergency_reserve} резерв. Остаток{" "}
                    {result.data.total_budget.remaining}.
                  </p>
                </div>
              ) : null}
              <p className="small-muted">
                Условия события синтетические. Этот результат не публикуется в
                стандартном сравнении команд.
              </p>
            </>
          ) : (
            <p className="empty-state">
              Выберите событие, чтобы проверить устойчивость вашего плана.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
function Presentation({ decisions }: Props) {
  const [title, setTitle] = useState("Аким на 5 часов — решение команды");
  const [slide, setSlide] = useState(0);
  const request = useRequest<z.infer<typeof PresentationResponseSchema>>();
  const data = request.data;
  const current = data?.slides[slide];
  function download() {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob([data.markdown], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "astana-scenario.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="tool-content">
      <div className="tool-intro">
        <span className="section-kicker">ГОТОВО К ОБСУЖДЕНИЮ</span>
        <h2>Презентация сценария</h2>
        <p>
          Расчётные слайды, выводы, сильные стороны и риски в одном документе.
        </p>
      </div>
      <div className="presentation-form">
        <label htmlFor="presentation-title">Заголовок презентации</label>
        <input
          id="presentation-title"
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          className="primary-button"
          disabled={request.busy || !title.trim()}
          onClick={() => {
            setSlide(0);
            void request.run(async (signal) => {
              const body = await prepareRequest(decisions, signal);
              const response = await post(
                "/api/presentation",
                { ...body, title: title.trim() },
                PresentationResponseSchema,
                signal,
              );
              if (
                response.source.dataset_version !== body.dataset_version ||
                decisionsKey(response.source.decisions) !==
                  decisionsKey(decisions)
              )
                throw new Error("Презентация относится к другому сценарию.");
              return response;
            });
          }}
        >
          <Sparkles size={17} />
          {data ? "Сформировать заново" : "Сформировать презентацию"}
        </button>
      </div>
      <RequestStatus {...request} />
      {data && current ? (
        <>
          {data.status === "ai_unavailable" ? (
            <p className="notice">
              AI-текст недоступен. Расчётные слайды сформированы и доступны для
              скачивания.
            </p>
          ) : null}
          <div className="slide-toolbar">
            <span>
              {slide + 1} / {data.slides.length} слайдов
            </span>
            <div>
              <button
                aria-label="Предыдущий слайд"
                disabled={slide === 0}
                onClick={() => setSlide((s) => s - 1)}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                aria-label="Следующий слайд"
                disabled={slide === data.slides.length - 1}
                onClick={() => setSlide((s) => s + 1)}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <button className="secondary-button" onClick={download}>
              <Download size={16} />
              Скачать Markdown
            </button>
          </div>
          <nav className="deck-navigation" aria-label="Слайды презентации">{data.slides.map((item, index) => <button key={item.id} aria-current={index === slide ? "step" : undefined} onClick={() => setSlide(index)}><span>{String(index + 1).padStart(2, "0")}</span>{item.title}</button>)}</nav>
          <PresentationSlide slide={current} source={data.source} title={data.title} index={slide} total={data.slides.length}>
            {current.explanations.map((e, i) => (
              <div className="deck-explanation" key={i}>
                <p>{e.explanation}</p>
                <Evidence ids={e.evidence_ids} facts={data.evidence} />
              </div>
            ))}
          </PresentationSlide>
          <p className="small-muted">
            Просмотр слайдов и экспорт Markdown. Форматы PPTX и PDF пока не
            поддерживаются.
          </p>
        </>
      ) : null}
    </section>
  );
}
function Comparison({ decisions, valid }: Props) {
  const request = useRequest<z.infer<typeof LeaderboardResponseSchema>>();
  const submit = useRequest<z.infer<typeof LeaderboardSubmitResponseSchema>>();
  const [displayName, setDisplayName] = useState("");
  const [offset, setOffset] = useState(0);
  const load = (next: number) => {
    setOffset(next);
    return request.run((signal) =>
      fetch(`/api/leaderboard?offset=${next}&limit=20`, {
        signal,
        cache: "no-store",
      }).then((r) => readResponse(r, LeaderboardResponseSchema)),
    );
  };
  const loadBoard = request.run;
  useEffect(() => {
    void loadBoard((signal) =>
      fetch("/api/leaderboard?offset=0&limit=20", {
        signal,
        cache: "no-store",
      }).then((r) => readResponse(r, LeaderboardResponseSchema)),
    );
  }, [loadBoard]);
  const data = request.data;
  return (
    <section className="tool-content">
      <div className="tool-intro">
        <span className="section-kicker">РАВНЫЕ НАЧАЛЬНЫЕ УСЛОВИЯ</span>
        <h2>Сравнение результатов</h2>
        <p>
          У каждой команды свой бюджет 100. Сравниваются лучшие опубликованные
          результаты на одной версии данных.
        </p>
      </div>
      <div className="publish-form">
        <label htmlFor="team-name">Название команды или участника</label>
        <input
          id="team-name"
          value={displayName}
          maxLength={60}
          placeholder="Например, Urban Lab"
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <button
          className="primary-button"
          disabled={
            !valid ||
            !data ||
            submit.busy ||
            !ParticipantNameSchema.safeParse(displayName).success
          }
          onClick={() =>
            void submit
              .run(async (signal) => {
                const body = await prepareRequest(decisions, signal);
                return post(
                  "/api/leaderboard",
                  { ...body, display_name: displayName.trim() },
                  LeaderboardSubmitResponseSchema,
                  signal,
                );
              })
              .then((saved) => {
                if (saved) void load(0);
              })
          }
        >
          Опубликовать результат <ArrowRight size={16} />
        </button>
        <p className="small-muted">
          Имя и результат будут видны другим участникам. Сохраняется личный
          лучший результат; слабая попытка его не заменяет. Браузер определяется
          cookie, без аккаунта.
        </p>
        {!valid ? <Requirement /> : null}
      </div>
      <RequestStatus {...request} />
      <RequestStatus {...submit} />
      {submit.data ? (
        <p className="notice success">
          <Check size={16} />
          Сохранён лучший результат:{" "}
          {format(submit.data.entry.scenario.simulation.after.score)} ·{" "}
          {submit.data.entry.display_name}
        </p>
      ) : null}
      <button
        className="text-button"
        disabled={request.busy}
        onClick={() => void load(offset)}
      >
        <RefreshCw size={14} />
        Обновить таблицу
      </button>
      {data ? (
        <>
          <div className="table-scroll">
            <table className="leaderboard">
              <thead>
                <tr>
                  <th>Место</th>
                  <th>Команда</th>
                  <th>Score</th>
                  <th>Бюджет</th>
                  <th>Изменение</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr
                    key={e.participant_id}
                    className={
                      e.participant_id === data.current_participant_id
                        ? "own-entry"
                        : ""
                    }
                  >
                    <td>
                      {e.rank}
                      {e.is_winner ? (
                        <span className="leader-dot" title="Лучший результат" />
                      ) : null}
                    </td>
                    <td>
                      {e.display_name}
                      {e.participant_id === data.current_participant_id ? (
                        <small>Ваш результат</small>
                      ) : null}
                    </td>
                    <td>{format(e.scenario.simulation.after.score)}</td>
                    <td>{e.scenario.simulation.budget.spent} / 100</td>
                    <td>{signed(e.scenario.simulation.score_delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.entries.length ? (
            <p className="empty-state">Опубликованных результатов пока нет.</p>
          ) : null}
          <div className="pagination">
            <button
              disabled={offset === 0 || request.busy}
              onClick={() => void load(Math.max(0, offset - 20))}
            >
              Назад
            </button>
            <span>
              Участников: {data.total} · лучших результатов: {data.winner_count}
            </span>
            <button
              disabled={offset + 20 >= data.total || request.busy}
              onClick={() => void load(offset + 20)}
            >
              Далее
            </button>
          </div>
          <p className="small-muted">
            При равенстве точных оценок место разделяется. После округления
            разные результаты могут выглядеть одинаково.
          </p>
        </>
      ) : null}
    </section>
  );
}
