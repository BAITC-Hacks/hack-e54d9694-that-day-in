"use client";

import { Check, LoaderCircle, Sparkles } from "lucide-react";
import type { useReport } from "@/features/simulator/use-report";

export default function ReportExplanation({
  report,
  onRetry,
}: {
  report: ReturnType<typeof useReport>;
  onRetry: () => void;
}) {
  const response = report.response;
  const busy = report.status === "checking" || report.status === "analyzing";
  return (
    <section
      className="report-explanation"
      aria-label="AI-анализ"
      aria-live="polite"
    >
      <div className="report-status">
        {busy ? (
          <LoaderCircle className="loading-icon" size={15} />
        ) : report.verified ? (
          <Check size={15} />
        ) : (
          <Sparkles size={15} />
        )}
        <span>
          {report.status === "checking"
            ? "Проверяем сценарий на сервере…"
            : report.status === "analyzing"
              ? "Расчёт подтверждён. AI изучает последствия…"
              : report.verified
                ? "Расчёт подтверждён сервером"
                : "Предварительный расчёт в браузере"}
        </span>
      </div>
      {report.message ? (
        <p className="report-message">{report.message}</p>
      ) : null}
      {response?.status === "complete" ? (
        <>
          <h3>
            <Sparkles size={17} /> Взгляд городского аналитика
          </h3>
          <p className="analysis-summary">{response.analysis.summary}</p>
          {(
            [
              ["strengths", "Сильные стороны"],
              ["risks", "Риски"],
              ["consequences", "Последствия"],
            ] as const
          ).map(([key, title]) => (
            <div className={`explanation-group ${key}`} key={key}>
              <h4>{title}</h4>
              <ul>
                {response.analysis[key].map((item, index) => (
                  <li key={index}>
                    <p>{item.explanation}</p>
                    <details>
                      <summary>На основе каких данных</summary>
                      {item.evidence_ids.map((id) => {
                        const fact = response.evidence.find((f) => f.id === id);
                        return fact ? (
                          <div className="evidence-fact" key={id}>
                            <strong>{fact.label}</strong>
                            <span>{fact.value}</span>
                          </div>
                        ) : null;
                      })}
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="report-provenance">
            {report.cached ? "Сохранённый отчёт" : "AI-отчёт"} ·{" "}
            {new Date(response.created_at).toLocaleString("ru-RU")} ·{" "}
            {response.model}
          </p>
        </>
      ) : null}
      {report.status === "unavailable" || report.status === "error" ? (
        <button className="district-action" onClick={onRetry}>
          Повторить анализ <Sparkles size={15} />
        </button>
      ) : null}
      {!report.saved ? (
        <p className="report-message">
          Браузер не позволил сохранить отчёт. Он доступен в этой вкладке.
        </p>
      ) : null}
    </section>
  );
}
