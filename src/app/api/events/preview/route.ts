import { dataset } from "../../../../data";
import { InvalidScenarioError } from "../../../../lib/simulation";
import { simulateMapEvents } from "../../../../lib/simulation/map-events";
import { MAP_EVENTS_VERSION, MapEventsRequestSchema, MapEventsResponseSchema } from "../../../../shared/features";
import { readFeatureInput } from "../../_lib/feature-input";
import { catalog, jsonResponse } from "../../_lib/scenario";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const input = await readFeatureInput(request, MapEventsRequestSchema);
  if (!input.ok) return input.response;
  if (input.data.dataset_version !== catalog.dataset_version) return jsonResponse({ code: "version_mismatch", message: "Обновите каталог." }, 409);
  try {
    return jsonResponse(MapEventsResponseSchema.parse({ dataset_version: catalog.dataset_version,
      map_events_version: MAP_EVENTS_VERSION, mode: "event_practice", eligible_for_leaderboard: false,
      ...simulateMapEvents(dataset, input.data.decisions, input.data.events) }));
  } catch (error) {
    if (error instanceof InvalidScenarioError) return jsonResponse(error.detail, 422);
    throw error;
  }
}
