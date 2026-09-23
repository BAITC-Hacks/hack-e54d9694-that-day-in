import { createLeaderboardHandlers } from "../_lib/leaderboard-handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = createLeaderboardHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;
