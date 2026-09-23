import { afterEach, describe, expect, it, vi } from "vitest";
import { participantIdentity } from "../../src/lib/competition/identity";
import { configuredLeaderboardStore, RedisLeaderboardStore } from "../../src/lib/competition/store";
import { rankEntries } from "../../src/lib/simulation/leaderboard";
import { fixtureLeaderboard } from "../../src/shared/features-fixtures";

describe("participant identity and ranking", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  it("keeps a signed browser identity and replaces a tampered identity", () => {
    const first = participantIdentity(new Request("https://example.test"), secret);
    expect(first.setCookie).toContain("HttpOnly; SameSite=Lax");
    expect(first.setCookie).toContain("Secure");
    const cookie = first.setCookie!.split(";")[0];
    expect(participantIdentity(new Request("https://example.test", { headers: { cookie } }), secret).id).toBe(first.id);
    expect(participantIdentity(new Request("https://example.test", { headers: { cookie: `${cookie.slice(0, -1)}!` } }), secret).id).not.toBe(first.id);
    expect(() => participantIdentity(new Request("https://example.test"), "short")).toThrow();
  });
  it("uses tied ranks and isolates dataset versions", () => {
    const first = fixtureLeaderboard.entries[0];
    const second = structuredClone(first); second.participant_id = "00000000-0000-4000-8000-000000000002";
    const third = structuredClone(first); third.participant_id = "00000000-0000-4000-8000-000000000003"; third.scenario.simulation.after.score -= 1;
    expect(rankEntries([third, second, first]).map(e => e.rank)).toEqual([1, 1, 3]);
    expect(() => rankEntries([first, first])).toThrow();
    second.scenario.dataset_version = "other";
    expect(() => rankEntries([first, second])).toThrow();
  });
});

describe("Redis REST adapter without real credentials", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("supports Marketplace credentials and never mixes credential pairs", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("KV_REST_API_URL", "https://redis.example.test");
    vi.stubEnv("KV_REST_API_TOKEN", "test-token");
    expect(configuredLeaderboardStore()).toBeInstanceOf(RedisLeaderboardStore);
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://other.example.test");
    expect(() => configuredLeaderboardStore()).toThrow();
  });
  it("atomically publishes using server-side Lua and version-scoped keys", async () => {
    const row = fixtureLeaderboard.entries[0];
    const entry = { participant_id: row.participant_id, display_name: row.display_name, scenario: row.scenario, submitted_at: row.submitted_at };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ result: JSON.stringify(entry) }));
    const store = new RedisLeaderboardStore("https://redis.example.test", "test-token", fetcher);
    expect(await store.saveBest(entry)).toEqual(entry);
    const options = fetcher.mock.calls[0][1]!;
    const command = JSON.parse(options.body as string);
    expect(command[0]).toBe("EVAL");
    expect(command[3]).toContain(entry.scenario.dataset_version);
    expect(command[5]).toBe(entry.participant_id);
    expect(command[6]).toBe(String(entry.scenario.simulation.after.score));
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it("normalizes Redis Lua's empty array representation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ result: JSON.stringify({ entries: {}, total: 0, best_score: null, winner_count: 0 }) }));
    const store = new RedisLeaderboardStore("https://redis.example.test", "token", fetcher);
    expect((await store.page("fixture-only", 0, 20)).entries).toEqual([]);
  });
  it("accepts the real Upstash empty-board response without a null field", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ result: JSON.stringify({ entries: [], total: 0, winner_count: 0 }) }));
    const page = await new RedisLeaderboardStore("https://redis.example.test", "token", fetcher).page("fixture-only", 0, 20);
    expect(page.best_score).toBeNull();
    expect(page.entries).toEqual([]);
  });
  it("rejects failed commands, corrupt replies and mismatched versions", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: "ERR" }))
      .mockResolvedValueOnce(Response.json({ result: "not-json" }))
      .mockResolvedValueOnce(Response.json({ result: JSON.stringify({ entries: fixtureLeaderboard.entries, total: 1, best_score: 56.54307, winner_count: 1 }) }));
    const store = new RedisLeaderboardStore("https://redis.example.test", "token", fetcher);
    await expect(store.page("version", 0, 20)).rejects.toThrow();
    await expect(store.page("version", 0, 20)).rejects.toThrow();
    await expect(store.page("version", 0, 20)).rejects.toThrow("Mismatched dataset");
    expect(() => new RedisLeaderboardStore("http://redis.example.test", "token")).toThrow();
  });
});
