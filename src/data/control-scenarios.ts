import type { Decision } from "../shared/contracts";
import { dataset } from "./index";
/** Review inputs only, never stored AI responses. */
export const controlScenarios: Record<string, Decision[]> = {
  example: dataset.example.decisions,
  concentrated: dataset.example.decisions.map(d => ({ ...d, district_id: d.district_id === null ? null : "esil" })),
  tradeoffs: [
    { measure_id: "M1", district_id: "esil" }, { measure_id: "M2", district_id: null },
    { measure_id: "M11", district_id: "nura" }, { measure_id: "M4", district_id: "saryarka" },
    { measure_id: "M12", district_id: null },
  ],
};
