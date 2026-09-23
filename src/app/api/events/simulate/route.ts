import { dataset } from "../../../../data";
import { cityEvents } from "../../../../data/events";
import { InvalidScenarioError } from "../../../../lib/simulation";
import { simulateEvent } from "../../../../lib/simulation/events";
import { EventRequestSchema, EventResponseSchema, FEATURES_VERSION } from "../../../../shared/features";
import { readFeatureInput } from "../../_lib/feature-input";
import { catalog, jsonResponse } from "../../_lib/scenario";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const input = await readFeatureInput(request, EventRequestSchema);
  if (!input.ok) return input.response;
  if (input.data.dataset_version !== catalog.dataset_version) return jsonResponse({ code: "version_mismatch", message: "Обновите каталог." }, 409);
  const event = cityEvents.find(e => e.id === input.data.event_id);
  if (!event) return jsonResponse({ code: "invalid_request", message: "Неизвестное событие." }, 422);
  try {
    return jsonResponse(EventResponseSchema.parse({ dataset_version: catalog.dataset_version, event_version: FEATURES_VERSION,
      event, mode: "event_practice", eligible_for_leaderboard: false, decisions: input.data.decisions,
      ...simulateEvent(dataset, event, input.data.decisions) }));
  } catch (error) {
    if (error instanceof InvalidScenarioError) return jsonResponse(error.detail, 422);
    throw error;
  }
}
