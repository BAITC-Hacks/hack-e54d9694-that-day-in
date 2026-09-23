"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { dataset } from "@/data";
import {
  CatalogSchema,
  SimulationResponseSchema,
  type Decision,
} from "@/shared/contracts";

export const decisionsKey = (decisions: Decision[]) =>
  JSON.stringify(
    [...decisions].sort((a, b) => a.measure_id.localeCompare(b.measure_id)),
  );
export async function readResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  const body: unknown = await response.json();
  const parsed = schema.safeParse(body);
  // A 503 can carry valid numerical results with an unavailable AI explanation.
  if ((response.ok || response.status === 503) && parsed.success)
    return parsed.data;
  if (response.status === 409)
    throw new Error("Каталог изменился. Обновите страницу перед продолжением.");
  if (response.status === 503)
    throw new Error(
      response.url.includes("leaderboard")
        ? "Общий рейтинг пока недоступен. Повторите загрузку позже."
        : "Сервис временно недоступен. Повторите запрос позже.",
    );
  if (
    response.status === 422 &&
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string"
  )
    throw new Error(body.message);
  throw new Error(
    response.ok
      ? "Ответ сервера не прошёл проверку."
      : "Не удалось выполнить запрос. Проверьте соединение и повторите.",
  );
}
export async function prepareRequest(
  decisions: Decision[],
  signal: AbortSignal,
) {
  const catalog = await readResponse(
    await fetch("/api/catalog", { signal, cache: "no-store" }),
    CatalogSchema,
  );
  if (JSON.stringify(catalog.dataset) !== JSON.stringify(dataset))
    throw new Error("Данные обновились. Перезагрузите страницу.");
  return { dataset_version: catalog.dataset_version, decisions };
}
export async function post<T>(
  url: string,
  body: unknown,
  schema: z.ZodType<T>,
  signal: AbortSignal,
) {
  return readResponse(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }),
    schema,
  );
}
export async function verifyCurrent(
  decisions: Decision[],
  signal: AbortSignal,
) {
  return post(
    "/api/simulate",
    await prepareRequest(decisions, signal),
    SimulationResponseSchema,
    signal,
  );
}
export function useRequest<T>() {
  const [state, setState] = useState<{
    data: T | null;
    busy: boolean;
    error: string;
  }>({ data: null, busy: false, error: "" });
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      active.current?.abort();
    },
    [],
  );
  function reset() {
    generation.current++;
    active.current?.abort();
    setState({ data: null, busy: false, error: "" });
  }
  const run = useCallback(
    async (
      operation: (signal: AbortSignal) => Promise<T>,
    ): Promise<T | null> => {
      const id = ++generation.current;
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      const timer = setTimeout(() => controller.abort(), 55_000);
      setState({ data: null, busy: true, error: "" });
      try {
        const data = await operation(controller.signal);
        if (id !== generation.current) return null;
        setState({ data, busy: false, error: "" });
        return data;
      } catch (error) {
        if (id === generation.current)
          setState({
            data: null,
            busy: false,
            error: controller.signal.aborted
              ? "Время ожидания истекло. Повторите запрос."
              : error instanceof Error
                ? error.message
                : "Не удалось выполнить запрос.",
          });
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
    [],
  );
  return { ...state, run, reset };
}
