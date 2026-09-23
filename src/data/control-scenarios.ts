import { type EvaluateRequest } from "../shared/contracts";
import { catalog } from "./index";

const request = (ids: [string, string, string, string, string]): EvaluateRequest => ({
  datasetVersion: catalog.datasetVersion, rulesVersion: catalog.rulesVersion,
  evaluationVersion: catalog.evaluationVersion,
  selections: { transport: ids[0], greenery: ids[1], social: ids[2], safety: ids[3], services: ids[4] },
});

/** Review inputs only; no stored AI responses and no paid calls during tests. */
export const controlScenarios = {
  balanced: request(["transport-2", "greenery-2", "social-2", "safety-2", "services-2"]),
  uneven: request(["transport-1", "greenery-1", "social-3", "safety-1", "services-3"]),
  tradeoffs: request(["transport-3", "greenery-2", "social-2", "safety-2", "services-1"]),
};
