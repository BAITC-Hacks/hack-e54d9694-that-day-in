import { randomInt } from "node:crypto";
import { z } from "zod";
import { cityEvents } from "../../../data/events";
import { FEATURES_VERSION } from "../../../shared/features";
import { readFeatureInput } from "../_lib/feature-input";
import { catalog, jsonResponse } from "../_lib/scenario";
export const runtime = "nodejs";
export async function GET() {
  return jsonResponse({ dataset_version: catalog.dataset_version, event_version: FEATURES_VERSION, events: cityEvents });
}
/** Draw once on user action; rendering and the core simulator are always deterministic. */
export async function POST(request: Request) {
  const input = await readFeatureInput(request, z.object({ dataset_version: z.string() }).strict());
  if (!input.ok) return input.response;
  if (input.data.dataset_version !== catalog.dataset_version) return jsonResponse({ code: "version_mismatch", message: "Обновите каталог." }, 409);
  return jsonResponse({ dataset_version: catalog.dataset_version, event_version: FEATURES_VERSION, event: cityEvents[randomInt(cityEvents.length)] });
}
