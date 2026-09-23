// Manual HTTP smoke. --live opts into two paid AI requests; never part of Vitest.
import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3042";
const catalog = await (await fetch(`${base}/api/catalog`)).json();
const input = { dataset_version: catalog.dataset_version, decisions: catalog.dataset.example.decisions };
const post = (path, body) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
const events = await (await fetch(`${base}/api/events`)).json();
const event = await post("/api/events/simulate", { ...input, event_version: events.event_version, event_id: "heat-wave" });
assert.equal(event.status, 200);
assert.equal((await event.json()).total_budget.remaining, 0);
for (const endpoint of ["/api/recommendations", "/api/presentation", "/api/leaderboard"]) {
  assert.equal((await post(endpoint, { ...input, decisions: [] })).status, 422);
}
const board = await fetch(`${base}/api/leaderboard`);
assert.ok([200, 503].includes(board.status));
console.log(JSON.stringify({ check: "HTTP event and invalid scenarios", status: "passed", leaderboard: board.status === 200 ? "connected" : "storage_not_available" }));
if (process.argv.includes("--live")) {
  for (const endpoint of ["/api/recommendations", "/api/presentation"]) {
    const start = Date.now();
    const http = await post(endpoint, input);
    const body = await http.json();
    assert.equal(http.status, 200, JSON.stringify(body.ai_error));
    assert.equal(body.status, "complete");
    assert.equal(body.source.simulation.after.score, 56.54307);
    const facts = new Set(body.evidence.map(e => e.id));
    if (endpoint.endsWith("recommendations")) {
      assert.equal(body.candidates.length, 3);
      assert.equal(body.notes.items.length, 3);
      for (const item of body.notes.items) assert.ok(item.evidence_ids.every(id => facts.has(id)));
      for (const candidate of body.candidates) {
        const verified = await (await post("/api/simulate", { ...input, decisions: candidate.decisions })).json();
        assert.deepEqual(candidate.simulation, verified.simulation);
        assert.ok(candidate.score_gain > 0);
      }
    } else {
      assert.equal(body.slides.length, 9);
      assert.ok(body.markdown.length > 0);
      for (const slide of body.slides) for (const item of slide.explanations) assert.ok(item.evidence_ids.every(id => facts.has(id)));
    }
    console.log(JSON.stringify({ endpoint, status: body.status, model: body.model, elapsed_ms: Date.now() - start,
      score: body.source.simulation.after.score, best_gain: body.candidates?.[0].score_gain, slides: body.slides?.length }));
  }
} else console.log("AI was not called. Use --live to check real recommendations and presentation explanations.");
