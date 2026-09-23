"use client";

import { useEffect, useRef, useState } from "react";
import { dataset } from "@/data";
import {
  AnalysisResponseSchema,
  CatalogSchema,
  SimulationResponseSchema,
  type AnalysisResponse,
  type Decision,
  type SimulationResponse,
} from "@/shared/contracts";

const storageKey = "akim:reports:v1";
type ReportState = {
  status:
    "idle" | "checking" | "analyzing" | "complete" | "unavailable" | "error";
  verified: SimulationResponse | null;
  response: AnalysisResponse | null;
  message: string;
  cached: boolean;
  saved: boolean;
};
const initial: ReportState = {
  status: "idle",
  verified: null,
  response: null,
  message: "",
  cached: false,
  saved: true,
};

function readCached(key: string): AnalysisResponse | null {
  try {
    const reports: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "[]",
    );
    if (!Array.isArray(reports)) return null;
    for (const entry of reports.slice(0, 10)) {
      const parsed = AnalysisResponseSchema.safeParse(entry);
      if (
        parsed.success &&
        parsed.data.scenario_key === key &&
        parsed.data.status === "complete"
      )
        return parsed.data;
    }
  } catch {
    /* Storage is optional; a live request remains available. */
  }
  return null;
}

function saveReport(report: AnalysisResponse): boolean {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    const others = (Array.isArray(raw) ? raw : []).flatMap((entry) => {
      const parsed = AnalysisResponseSchema.safeParse(entry);
      return parsed.success && parsed.data.scenario_key !== report.scenario_key
        ? [parsed.data]
        : [];
    });
    localStorage.setItem(
      storageKey,
      JSON.stringify([report, ...others].slice(0, 10)),
    );
    return true;
  } catch {
    return false;
  }
}

export function useReport() {
  const [report, setReport] = useState<ReportState>(initial);
  const generation = useRef(0);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      active.current?.abort();
    },
    [],
  );

  async function run(decisions: Decision[]) {
    const id = ++generation.current;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 55_000);
    const update = (next: Partial<ReportState>) => {
      if (generation.current === id)
        setReport((previous) => ({ ...previous, ...next }));
    };
    setReport({ ...initial, status: "checking" });
    let verified: SimulationResponse | null = null;
    try {
      const catalogResponse = await fetch("/api/catalog", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!catalogResponse.ok)
        throw new Error(
          "Не удалось загрузить каталог. Проверьте соединение и повторите запрос.",
        );
      const catalog = CatalogSchema.parse(await catalogResponse.json());
      if (JSON.stringify(catalog.dataset) !== JSON.stringify(dataset))
        throw new Error(
          "Данные города обновились. Перезагрузите страницу и проверьте план заново.",
        );
      const request = { dataset_version: catalog.dataset_version, decisions };
      const options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      };
      const simulationResponse = await fetch("/api/simulate", options);
      if (!simulationResponse.ok)
        throw new Error(
          "Сервер не подтвердил сценарий. Обновите страницу и проверьте решения.",
        );
      verified = SimulationResponseSchema.parse(
        await simulationResponse.json(),
      );
      update({ verified, status: "analyzing" });
      const cached = readCached(verified.scenario_key);
      if (cached && cached.dataset_version === verified.dataset_version) {
        update({ response: cached, status: "complete", cached: true });
        return;
      }
      const response = await fetch("/api/analyze", options);
      if (!response.ok && response.status !== 503)
        throw new Error(
          "Не удалось получить AI-анализ. Числовой результат сохранён.",
        );
      const analysis = AnalysisResponseSchema.parse(await response.json());
      if (analysis.scenario_key !== verified.scenario_key)
        throw new Error(
          "Ответ относится к другому сценарию. Повторите проверку.",
        );
      update({
        response: analysis,
        status: analysis.status === "complete" ? "complete" : "unavailable",
        message:
          analysis.status === "ai_unavailable"
            ? analysis.ai_error.code === "missing_api_key"
              ? "AI-анализ пока не настроен. Числовой результат подтверждён сервером."
              : "Сервис AI временно недоступен. Числовой результат подтверждён сервером."
            : "",
        saved: saveReport(analysis),
      });
    } catch (error) {
      const message = controller.signal.aborted
        ? "Время ожидания истекло. Повторите запрос."
        : error instanceof Error && error.name === "Error"
          ? error.message
          : "Не удалось проверить ответ сервера. Повторите запрос.";
      update({ status: verified ? "unavailable" : "error", message });
    } finally {
      clearTimeout(timeout);
    }
  }
  function reset() {
    generation.current++;
    active.current?.abort();
    setReport(initial);
  }
  return { ...report, run, reset };
}
