import type { LeaderboardEntry } from "../../shared/features";

/** Competition ranks (1,1,3); tie order never declares a higher-scoring winner. */
export function rankEntries(entries: LeaderboardEntry[]) {
  const versions = new Set(entries.map(e => e.scenario.dataset_version));
  if (versions.size > 1) throw new Error("Cannot compare different datasets");
  if (new Set(entries.map(e => e.participant_id)).size !== entries.length) throw new Error("Duplicate participant");
  const sorted = [...entries].sort((a, b) => b.scenario.simulation.after.score - a.scenario.simulation.after.score ||
    a.participant_id.localeCompare(b.participant_id, "en"));
  let rank = 1;
  return sorted.map((entry, index) => {
    if (index > 0 && entry.scenario.simulation.after.score !== sorted[index - 1].scenario.simulation.after.score) rank = index + 1;
    return { ...entry, rank, is_winner: rank === 1 };
  });
}
