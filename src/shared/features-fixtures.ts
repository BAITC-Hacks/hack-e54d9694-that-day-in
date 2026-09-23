/** TEST DATA ONLY. No network calls or actual participant results. */
import { fixtureCatalog, fixtureCompleteAnalysis, fixtureSimulation } from "./fixtures";
import { LeaderboardResponseSchema, RecommendationsResponseSchema, EventResponseSchema, PresentationResponseSchema, FEATURES_VERSION } from "./features";
import { recommendScenarios } from "../lib/simulation/recommendations";
import { simulateEvent } from "../lib/simulation/events";
import { buildSlides, slidesToMarkdown } from "../lib/simulation/presentation";
import { cityEvents } from "../data/events";

export const fixtureLeaderboard = LeaderboardResponseSchema.parse({
  dataset_version: "fixture-only", mode: "standard", policy: "personal_best", total: 1, offset: 0, limit: 20,
  current_participant_id: "00000000-0000-4000-8000-000000000001", best_score: fixtureSimulation.simulation.after.score, winner_count: 1,
  entries: [{ participant_id: "00000000-0000-4000-8000-000000000001", display_name: "Тестовая команда",
    scenario: fixtureSimulation, submitted_at: "2026-09-23T00:00:00.000Z", rank: 1, is_winner: true }],
});
export const fixtureRecommendations = RecommendationsResponseSchema.parse({
  source: fixtureSimulation, search: "single_replacement", candidates: recommendScenarios(fixtureCatalog.dataset, fixtureSimulation.decisions),
  status: "ai_unavailable", model: "fixture-no-ai", prompt_version: "recommendations-1.0.1", notes: null,
  ai_error: { code: "missing_api_key", message: "Тестовый пример без AI." },
  evidence: [],
});
export const fixtureCompleteRecommendations = RecommendationsResponseSchema.parse({
  ...fixtureRecommendations, status: "complete", ai_error: null,
  notes: { summary: "Тестовое объяснение проверенных замен; модель не вызывалась.",
    items: fixtureRecommendations.candidates.map(c => ({ candidate_id: c.id,
      explanation: `Расчётный прирост Score: ${c.score_gain}.`, tradeoff: `Изменение расходов: ${c.cost_delta}.`,
      evidence_ids: [`candidate:${c.id}`] })) },
  evidence: fixtureRecommendations.candidates.map(c => ({ id: `candidate:${c.id}`, label: "Тестовый вариант", value: JSON.stringify(c) })),
});
export const fixtureEvent = EventResponseSchema.parse({
  dataset_version: "fixture-only", event_version: FEATURES_VERSION, event: cityEvents[1],
  mode: "event_practice", eligible_for_leaderboard: false, decisions: fixtureSimulation.decisions,
  ...simulateEvent(fixtureCatalog.dataset, cityEvents[1], fixtureSimulation.decisions),
});
const slides = buildSlides(fixtureCatalog.dataset, fixtureSimulation, fixtureCompleteAnalysis.analysis);
export const fixturePresentation = PresentationResponseSchema.parse({
  source: fixtureSimulation, title: "Тестовая презентация", slides, markdown: slidesToMarkdown("Тестовая презентация", slides),
  status: "complete", model: "fixture-no-ai", prompt_version: "fixture-only", ai_error: null,
  evidence: fixtureCompleteAnalysis.evidence,
});
