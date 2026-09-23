import { z } from "zod";
import { participantIdentity } from "../../../lib/competition/identity";
import { configuredLeaderboardStore, type LeaderboardStore } from "../../../lib/competition/store";
import { LeaderboardResponseSchema, LeaderboardSubmitSchema, LeaderboardSubmitResponseSchema } from "../../../shared/features";
import { readFeatureInput } from "./feature-input";
import { catalog, jsonResponse, prepareScenario } from "./scenario";

export function createLeaderboardHandlers(options: { store?: LeaderboardStore; secret?: string; now?: () => Date } = {}) {
  const secret = () => options.secret ?? process.env.PARTICIPANT_SECRET ?? "";
  const store = () => options.store ?? configuredLeaderboardStore();
  const unavailable = () => jsonResponse({ code: "leaderboard_unavailable", message: "Общий рейтинг недоступен. Проверьте подключение Redis и PARTICIPANT_SECRET. Публикацию можно повторить." }, 503);
  return {
    async GET(request: Request) {
      const params = new URL(request.url).searchParams;
      const pagination = z.object({ offset: z.coerce.number().int().min(0).max(10000), limit: z.coerce.number().int().min(1).max(100) })
        .safeParse({ offset: params.get("offset") ?? 0, limit: params.get("limit") ?? 20 });
      if (!pagination.success) return jsonResponse({ code: "invalid_request", message: "Некорректная страница рейтинга." }, 422);
      try {
        const identity = participantIdentity(request, secret());
        const page = await store().page(catalog.dataset_version, pagination.data.offset, pagination.data.limit);
        const response = jsonResponse(LeaderboardResponseSchema.parse({ ...page, ...pagination.data, dataset_version: catalog.dataset_version,
          mode: "standard", policy: "personal_best", current_participant_id: identity.id }));
        if (identity.setCookie) response.headers.set("Set-Cookie", identity.setCookie);
        return response;
      } catch { return unavailable(); }
    },
    async POST(request: Request) {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin) return jsonResponse({ code: "invalid_request", message: "Отправка с другого сайта запрещена." }, 403);
      const input = await readFeatureInput(request, LeaderboardSubmitSchema);
      if (!input.ok) return input.response;
      const prepared = prepareScenario({ dataset_version: input.data.dataset_version, decisions: input.data.decisions });
      if (!prepared.ok) return jsonResponse(prepared.error, prepared.status);
      try {
        const identity = participantIdentity(request, secret());
        const entry = await store().saveBest({ participant_id: identity.id, display_name: input.data.display_name,
          scenario: prepared.result, submitted_at: (options.now?.() ?? new Date()).toISOString() });
        const response = jsonResponse(LeaderboardSubmitResponseSchema.parse({ policy: "personal_best", entry }));
        if (identity.setCookie) response.headers.set("Set-Cookie", identity.setCookie);
        return response;
      } catch { return unavailable(); }
    },
  };
}
