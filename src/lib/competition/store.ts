import { z } from "zod";
import { LeaderboardEntrySchema, type LeaderboardEntry, type LeaderboardResponse } from "../../shared/features";

export type BoardPage = Pick<LeaderboardResponse, "total" | "entries" | "best_score" | "winner_count">;
export interface LeaderboardStore {
  saveBest(entry: LeaderboardEntry): Promise<LeaderboardEntry>;
  page(datasetVersion: string, offset: number, limit: number): Promise<BoardPage>;
}

// Both keys share a Redis hash tag. Updating a participant and reading a page are atomic.
export const SAVE_BEST_SCRIPT = `
local old = redis.call('HGET', KEYS[1], ARGV[1])
if old then
  local current = cjson.decode(old)
  if current.scenario.simulation.after.score >= tonumber(ARGV[2]) then return old end
elseif redis.call('ZCARD', KEYS[2]) >= 10000 then
  return redis.error_reply('LEADERBOARD_FULL')
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[1])
return ARGV[3]`;
export const PAGE_SCRIPT = `
local total = redis.call('ZCARD', KEYS[2])
local best = redis.call('ZREVRANGE', KEYS[2], 0, 0, 'WITHSCORES')
local bestScore = cjson.null
local winners = 0
if #best > 0 then
  bestScore = tonumber(best[2])
  winners = redis.call('ZCOUNT', KEYS[2], best[2], best[2])
end
local ids = redis.call('ZREVRANGE', KEYS[2], ARGV[1], tonumber(ARGV[1]) + tonumber(ARGV[2]) - 1, 'WITHSCORES')
local rows = {}
for i = 1, #ids, 2 do
  local row = cjson.decode(redis.call('HGET', KEYS[1], ids[i]))
  row.rank = redis.call('ZCOUNT', KEYS[2], '(' .. ids[i+1], '+inf') + 1
  row.is_winner = row.rank == 1
  table.insert(rows, row)
end
return cjson.encode({total=total, best_score=bestScore, winner_count=winners, entries=rows})`;

const PageSchema = z.object({ total: z.number().int().nonnegative(), best_score: z.number().nullable(), winner_count: z.number().int().nonnegative(),
  entries: z.array(LeaderboardEntrySchema.extend({ rank: z.number().int().positive(), is_winner: z.boolean() })) });

/** HTTPS Redis REST adapter; works across processes and Vercel instances without an SDK. */
export class RedisLeaderboardStore implements LeaderboardStore {
  constructor(private url: string, private token: string, private fetcher: typeof fetch = fetch) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("Invalid Redis endpoint");
    if (!token) throw new Error("Missing Redis token");
  }
  private keys(version: string) { return [`akim:{standard-v1-${version}}:entries`, `akim:{standard-v1-${version}}:scores`]; }
  private async eval(script: string, version: string, args: string[]): Promise<unknown> {
    const response = await this.fetcher(this.url, { method: "POST", headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", script, "2", ...this.keys(version), ...args]), cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Leaderboard storage unavailable");
    const body = await response.json() as { result?: unknown; error?: unknown };
    if (body.error || body.result === undefined) throw new Error("Leaderboard storage failed");
    return body.result;
  }
  async saveBest(entry: LeaderboardEntry): Promise<LeaderboardEntry> {
    const value = await this.eval(SAVE_BEST_SCRIPT, entry.scenario.dataset_version,
      [entry.participant_id, String(entry.scenario.simulation.after.score), JSON.stringify(entry)]);
    if (typeof value !== "string") throw new Error("Invalid stored entry");
    const saved = LeaderboardEntrySchema.parse(JSON.parse(value));
    if (saved.participant_id !== entry.participant_id || saved.scenario.dataset_version !== entry.scenario.dataset_version) throw new Error("Mismatched stored entry");
    return saved;
  }
  async page(version: string, offset: number, limit: number): Promise<BoardPage> {
    const value = await this.eval(PAGE_SCRIPT, version, [String(offset), String(limit)]);
    if (typeof value !== "string") throw new Error("Invalid stored page");
    const parsed = JSON.parse(value);
    // Upstash's Lua JSON encoder can omit cjson.null on an empty board.
    if (parsed.total === 0 && parsed.best_score === undefined) parsed.best_score = null;
    // Redis Lua encodes an empty table as {}, not [].
    if (parsed.entries && !Array.isArray(parsed.entries) && Object.keys(parsed.entries).length === 0) parsed.entries = [];
    const page = PageSchema.parse(parsed);
    if (page.entries.some(e => e.scenario.dataset_version !== version)) throw new Error("Mismatched dataset");
    return page;
  }
}

export function configuredLeaderboardStore(): LeaderboardStore {
  // Vercel Marketplace provisions KV_* names; direct Upstash uses UPSTASH_*.
  // Choose an entire pair to avoid mixing credentials from different databases.
  const direct = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_TOKEN;
  const url = direct ? process.env.UPSTASH_REDIS_REST_URL : process.env.KV_REST_API_URL;
  const token = direct ? process.env.UPSTASH_REDIS_REST_TOKEN : process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Leaderboard storage not configured");
  return new RedisLeaderboardStore(url, token);
}
