import { expect, it } from "vitest";
import { POST } from "../../src/app/api/events/preview/route";
import { catalog } from "../../src/app/api/_lib/scenario";
import { MAP_EVENTS_VERSION, MapEventsResponseSchema } from "../../src/shared/features";
import { dataset } from "../../src/data";
const body = { dataset_version: catalog.dataset_version, map_events_version: MAP_EVENTS_VERSION, decisions: [], events: [{ event_id: "heavy-rain", district_id: "nura" }] };
const request = (value: unknown) => new Request("http://localhost/api/events/preview", { method: "POST", body: JSON.stringify(value) });
it("returns a server-validated draft without ranking eligibility", async () => {
  const response = await POST(request(body));
  expect(response.status).toBe(200);
  const result = MapEventsResponseSchema.parse(await response.json());
  expect(result.eligible_for_leaderboard).toBe(false);
  expect(result.final_score).toBeNull();
  expect(result.simulation.budget.remaining).toBe(90);
});
it("rejects outdated datasets, injected effects and overspending", async () => {
  expect((await POST(request({ ...body, dataset_version: "old" }))).status).toBe(409);
  expect((await POST(request({ ...body, score: 100 }))).status).toBe(422);
  expect((await POST(request({ ...body, decisions: dataset.example.decisions }))).status).toBe(422);
  expect((await POST(request({ ...body, events: [{ ...body.events[0], deltas: { T1: 100 } }] }))).status).toBe(422);
  expect((await POST(request({ ...body, map_events_version: "old" }))).status).toBe(422);
});
