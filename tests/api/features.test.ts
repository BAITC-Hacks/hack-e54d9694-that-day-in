import { describe, expect, it, vi } from "vitest";
import { dataset } from "../../src/data";
import { cityEvents } from "../../src/data/events";
import { createRecommendationsHandler } from "../../src/app/api/_lib/recommendations-handler";
import { createPresentationHandler } from "../../src/app/api/_lib/presentation-handler";
import { createLeaderboardHandlers } from "../../src/app/api/_lib/leaderboard-handler";
import { GET as events, POST as draw } from "../../src/app/api/events/route";
import { POST as eventSimulation } from "../../src/app/api/events/simulate/route";
import { catalog } from "../../src/app/api/_lib/scenario";
import { AiFailure } from "../../src/lib/ai/analyze";
import { rankEntries } from "../../src/lib/simulation/leaderboard";
import type { LeaderboardStore } from "../../src/lib/competition/store";
import { FEATURES_VERSION, LeaderboardResponseSchema, RecommendationsResponseSchema, PresentationResponseSchema, type LeaderboardEntry } from "../../src/shared/features";
import { fixtureCompleteAnalysis } from "../../src/shared/fixtures";

const scenario = () => ({ dataset_version: catalog.dataset_version, decisions: structuredClone(dataset.example.decisions) });
const request = (body: unknown, headers: Record<string, string> = {}) => new Request("https://example.test/api/test", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});
const notes = (_facts: unknown, ids: string[]) => Promise.resolve({ summary: "Проверенные улучшения", items: ids.map(id => ({
  candidate_id: id, explanation: "Более высокий расчётный Score.", tradeoff: "Перераспределение выгод.", evidence_ids: [`candidate:${id}`],
})) });
/** Test-only store. Production never falls back to process memory. */
class MemoryStore implements LeaderboardStore {
  entries = new Map<string, LeaderboardEntry>();
  async saveBest(entry: LeaderboardEntry) {
    const key = `${entry.scenario.dataset_version}:${entry.participant_id}`;
    const old = this.entries.get(key);
    if (!old || old.scenario.simulation.after.score < entry.scenario.simulation.after.score) this.entries.set(key, structuredClone(entry));
    return this.entries.get(key)!;
  }
  async page(version: string, offset: number, limit: number) {
    const entries = rankEntries([...this.entries.values()].filter(e => e.scenario.dataset_version === version));
    return { total: entries.length, entries: entries.slice(offset, offset + limit), best_score: entries[0]?.scenario.simulation.after.score ?? null,
      winner_count: entries.filter(e => e.is_winner).length };
  }
}

describe("feature APIs", () => {
  it("returns scored alternatives with validated AI explanations", async () => {
    const response = await createRecommendationsHandler(notes)(request(scenario()));
    expect(response.status).toBe(200);
    const body = RecommendationsResponseSchema.parse(await response.json());
    expect(body.status).toBe("complete");
    expect(body.candidates).toHaveLength(3);
    expect(body.notes!.items).toHaveLength(3);
    expect(body.candidates.every(c => c.simulation.after.score > body.source.simulation.after.score)).toBe(true);
  });
  it("retains computed improvements on AI failure", async () => {
    const response = await createRecommendationsHandler(async () => { throw new AiFailure("timeout", "Timeout"); })(request(scenario()));
    expect(response.status).toBe(503);
    const body = RecommendationsResponseSchema.parse(await response.json());
    expect(body.candidates).toHaveLength(3);
    expect(body.ai_error?.code).toBe("timeout");
    expect(body.notes).toBeNull();
  });
  it("rejects fabricated AI candidate IDs", async () => {
    const response = await createRecommendationsHandler(async () => notes(null, ["invented"]))(request(scenario()));
    expect(response.status).toBe(503);
    expect((await response.json()).ai_error.code).toBe("invalid_response");
  });
  it.each(["recommendations", "presentation"])("validates before AI: %s", async feature => {
    const run = vi.fn();
    const handler = feature === "recommendations" ? createRecommendationsHandler(run) : createPresentationHandler(run);
    expect((await handler(request({ ...scenario(), decisions: [] }))).status).toBe(422);
    expect((await handler(request({ ...scenario(), dataset_version: "old" }))).status).toBe(409);
    expect((await handler(request({ ...scenario(), score: 100 }))).status).toBe(422);
    expect(run).not.toHaveBeenCalled();
  });
  it("limits streamed input sizes", async () => {
    expect((await createRecommendationsHandler(vi.fn())(request({ text: "a".repeat(33000) }))).status).toBe(413);
  });
  it("generates slides with evidence and verified figures", async () => {
    const response = await createPresentationHandler(async facts => {
      const analysis = structuredClone(fixtureCompleteAnalysis.analysis!);
      for (const item of [...analysis.strengths, ...analysis.risks, ...analysis.consequences]) item.evidence_ids = [facts[0].id];
      return analysis;
    })(request({ ...scenario(), title: "Команда 1" }));
    const body = PresentationResponseSchema.parse(await response.json());
    expect(response.status).toBe(200);
    expect(body.slides).toHaveLength(9);
    expect(body.source.simulation.after.score).toBe(56.54307);
    expect(body.evidence.length).toBeGreaterThan(0);
    expect(body.markdown).toContain("Команда 1");
  });
  it("returns useful slides with explicit failure when AI is unavailable", async () => {
    const response = await createPresentationHandler(async () => { throw new AiFailure("missing_api_key", "No key"); })(request(scenario()));
    const body = PresentationResponseSchema.parse(await response.json());
    expect(response.status).toBe(503);
    expect(body.slides).toHaveLength(6);
    expect(body.status).toBe("ai_unavailable");
  });
  it("lists and draws only versioned synthetic events", async () => {
    expect((await (await events()).json()).events).toEqual(cityEvents);
    const response = await draw(request({ dataset_version: catalog.dataset_version }));
    expect(cityEvents.map(e => e.id)).toContain((await response.json()).event.id);
    expect((await draw(request({ dataset_version: "old" }))).status).toBe(409);
  });
  it("enforces emergency reserve without changing ordinary simulation", async () => {
    const body = { ...scenario(), event_version: FEATURES_VERSION, event_id: "heavy-rain" };
    expect((await eventSimulation(request(body))).status).toBe(422);
    const response = await eventSimulation(request({ ...body, event_id: "heat-wave" }));
    const result = await response.json();
    expect(result.total_budget.remaining).toBe(0);
    expect(result.eligible_for_leaderboard).toBe(false);
    expect((await eventSimulation(request({ ...body, event_id: "invented" }))).status).toBe(422);
    expect((await eventSimulation(request({ ...body, dataset_version: "old" }))).status).toBe(409);
  });
});

describe("shared leaderboard", () => {
  const secret = "test-secret-only-01234567890123456789";
  it("compares independent users and marks all tied winners", async () => {
    const store = new MemoryStore();
    const handlers = createLeaderboardHandlers({ store, secret });
    const one = await handlers.POST(request({ ...scenario(), display_name: "Команда 1" }));
    const two = await handlers.POST(request({ ...scenario(), display_name: "Команда 2" }));
    expect(one.status).toBe(200);
    expect(two.status).toBe(200);
    const cookie = one.headers.get("Set-Cookie")!.split(";")[0];
    const response = await handlers.GET(new Request("https://example.test/api/leaderboard", { headers: { cookie } }));
    const board = LeaderboardResponseSchema.parse(await response.json());
    expect(board.total).toBe(2);
    expect(board.winner_count).toBe(2);
    expect(board.entries.map(e => e.rank)).toEqual([1, 1]);
    expect(board.entries.every(e => e.scenario.simulation.budget.initial === 100 && e.scenario.simulation.budget.spent === 95)).toBe(true);
    expect(board.current_participant_id).toBe((await one.json()).entry.participant_id);
    const repeated = await handlers.POST(request({ ...scenario(), display_name: "Команда 1" }, { cookie }));
    expect(repeated.status).toBe(200);
    expect(store.entries.size).toBe(2);
  });
  it("retains the personal best after a worse submission", async () => {
    const store = new MemoryStore();
    const handlers = createLeaderboardHandlers({ store, secret });
    const initial = await handlers.POST(request({ ...scenario(), display_name: "Один" }));
    const cookie = initial.headers.get("Set-Cookie")!.split(";")[0];
    const worse = scenario();
    worse.decisions = worse.decisions.map(d => d.district_id === "nura" ? { ...d, district_id: "esil" } : d);
    const updated = await handlers.POST(request({ ...worse, display_name: "Один" }, { cookie }));
    expect((await updated.json()).entry.scenario.simulation.after.score).toBe(56.54307);
    expect(store.entries.size).toBe(1);
  });
  it("rejects supplied scores, identities and event rules before storage", async () => {
    const store = { saveBest: vi.fn(), page: vi.fn() };
    const handlers = createLeaderboardHandlers({ store, secret });
    for (const extra of [{ score: 100 }, { participant_id: "fake" }, { event_id: "heat-wave" }]) {
      expect((await handlers.POST(request({ ...scenario(), display_name: "Команда", ...extra }))).status).toBe(422);
    }
    expect((await handlers.POST(request({ ...scenario(), display_name: "<script>" }))).status).toBe(422);
    expect((await handlers.POST(request({ ...scenario(), display_name: "Команда", dataset_version: "old" }))).status).toBe(409);
    expect(store.saveBest).not.toHaveBeenCalled();
  });
  it("returns explicit storage errors instead of an empty or imaginary ranking", async () => {
    const handlers = createLeaderboardHandlers({ secret, store: { saveBest: vi.fn().mockRejectedValue(new Error("token-private")), page: vi.fn().mockRejectedValue(new Error("token-private")) } });
    const response = await handlers.GET(new Request("https://example.test/api/leaderboard"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("token-private");
    expect((await handlers.POST(request({ ...scenario(), display_name: "Команда" }))).status).toBe(503);
  });
  it("validates pages and rejects cross-site publication", async () => {
    const handlers = createLeaderboardHandlers({ secret, store: new MemoryStore() });
    expect((await handlers.GET(new Request("https://example.test/api/leaderboard?limit=1000"))).status).toBe(422);
    expect((await handlers.POST(request({ ...scenario(), display_name: "Команда" }, { origin: "https://other.test" }))).status).toBe(403);
    const empty = await handlers.GET(new Request("https://example.test/api/leaderboard"));
    expect((await empty.json()).best_score).toBeNull();
  });
});
