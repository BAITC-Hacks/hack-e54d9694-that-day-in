"use client";
import { useMemo, useRef, useState } from "react";
import { dataset } from "@/data";
import { simulateMapEvents } from "@/lib/simulation/map-events";
import { INDICATOR_CODES, type Decision, type SimulationResult } from "@/shared/contracts";
import type { MapEventPlacement } from "@/shared/features";

export type MapFeedback = { key: number; eventId?: string; districts: { id: string; positive: boolean; negative: boolean }[] };
export function usePlayground(decisions: Decision[]) {
  const [events, setEvents] = useState<MapEventPlacement[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<MapFeedback | null>(null);
  const counter = useRef(0);
  const result = useMemo(() => simulateMapEvents(dataset, decisions, events), [decisions, events]);
  const flash = (after: SimulationResult, eventId?: string) => {
    const districts = after.districts.map((d, index) => {
      const delta = INDICATOR_CODES.map(code => d.after[code] - result.simulation.districts[index].after[code]);
      return { id: d.district_id, positive: delta.some(n => n > 0.001), negative: delta.some(n => n < -0.001) };
    }).filter(d => d.positive || d.negative);
    setFeedback({ key: ++counter.current, eventId, districts });
  };
  function place(event_id: string, district_id: string | null) {
    const next = [...events, { event_id, district_id }];
    try {
      const preview = simulateMapEvents(dataset, decisions, next);
      flash(preview.simulation, event_id);
      setEvents(next);
      setMessage(`Событие применено: ${district_id ? dataset.districts.find(d => d.id === district_id)?.name : "весь город"}. Показатели обновлены.`);
    } catch (error) {
      setMessage(`${error instanceof Error ? error.message : "Событие не применено."} Освободите бюджет или уберите другое событие.`);
    }
    setArmed(null);
  }
  function remove(index: number) {
    const next = events.filter((_, i) => i !== index);
    flash(simulateMapEvents(dataset, decisions, next).simulation);
    setEvents(next);
    setMessage("Событие убрано. Его резерв возвращён в бюджет.");
  }
  function checkPlan(next: Decision[]) {
    try {
      flash(simulateMapEvents(dataset, next, events).simulation);
      setMessage("");
      return true;
    } catch {
      setMessage("План не помещается в бюджет с резервом событий. Сначала уберите событие или выберите другие меры.");
      return false;
    }
  }
  return { ...result, events, armed, setArmed, feedback, message, place, remove, checkPlan };
}
