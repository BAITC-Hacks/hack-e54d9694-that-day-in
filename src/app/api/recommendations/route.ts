import { createRecommendationsHandler } from "../_lib/recommendations-handler";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = createRecommendationsHandler();
