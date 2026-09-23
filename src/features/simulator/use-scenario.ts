"use client";

import { useEffect, useReducer } from "react";
import { dataset } from "@/data";
import { simulateScenario, validateSelections } from "@/lib/simulation";
import type { Decision } from "@/shared/contracts";

const storageKey = "akim:scenario:v1";
// Store the exact input identity so even an unversioned dataset edit invalidates a draft.
const datasetIdentity = JSON.stringify(dataset);
type State = { decisions: Decision[]; loaded: boolean; notice: string };
type Action = {
  type: "load" | "replace";
  decisions: Decision[];
  notice?: string;
};
function reducer(state: State, action: Action): State {
  return {
    decisions: action.decisions,
    loaded: true,
    notice: action.notice ?? (action.type === "replace" ? "" : state.notice),
  };
}

export function useScenario() {
  const [state, dispatch] = useReducer(reducer, {
    decisions: [],
    loaded: false,
    notice: "",
  });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        const result = validateSelections(dataset, saved.decisions, {
          draft: true,
        });
        if (saved.dataset === datasetIdentity && result.valid) {
          dispatch({ type: "load", decisions: result.decisions });
          return;
        }
        dispatch({
          type: "load",
          decisions: [],
          notice:
            "Сохранённый план устарел или не соответствует правилам. Начните новый сценарий.",
        });
        return;
      }
    } catch {
      dispatch({
        type: "load",
        decisions: [],
        notice:
          "Сохранение в браузере недоступно. Текущий план останется только в этой вкладке.",
      });
      return;
    }
    dispatch({ type: "load", decisions: [] });
  }, []);

  function replace(decisions: Decision[]) {
    const result = validateSelections(dataset, decisions, { draft: true });
    if (!result.valid) return;
    let notice = "";
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ dataset: datasetIdentity, decisions }),
      );
    } catch {
      notice = "Не удалось сохранить план. Не закрывайте эту вкладку.";
    }
    dispatch({ type: "replace", decisions, notice });
  }

  const simulation = simulateScenario(dataset, state.decisions, {
    draft: true,
  });
  const valid =
    state.loaded && validateSelections(dataset, state.decisions).valid;
  return {
    ...state,
    simulation,
    valid,
    replace,
    remove: (id: string) =>
      replace(state.decisions.filter((d) => d.measure_id !== id)),
  };
}
