// Manual integration check. Not loaded by Vitest. --live explicitly enables paid AI calls.
// Start the app with its server-side key, then: node tests/api/live-smoke.mjs --live
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3031";
const source = JSON.parse(await readFile(new URL("../../dataset/dataset.json", import.meta.url), "utf8"));
const catalogResponse = await fetch(`${base}/api/catalog`);
assert.equal(catalogResponse.status, 200);
const catalog = await catalogResponse.json();
assert.deepEqual(catalog.dataset, source);
const request = decisions => ({ dataset_version: catalog.dataset_version, decisions });
const post = (path, body) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
const response = await post("/api/simulate", request(source.example.decisions));
assert.equal(response.status, 200);
const result = await response.json();
assert.equal(result.simulation.budget.spent, 95);
assert.deepEqual(result.simulation.after, source.example.result);
const reversed = await (await post("/api/simulate", request([...source.example.decisions].reverse()))).json();
assert.deepEqual(reversed, result);
assert.equal((await post("/api/analyze", { ...request(source.example.decisions), dataset_version: "stale" })).status, 409);
assert.equal((await post("/api/analyze", request([]))).status, 422);
console.log(JSON.stringify({ check: "HTTP catalog/simulate/validation", status: "passed", score: result.simulation.after.score, critical_count: result.simulation.after.critical_count }));

if (process.argv.includes("--live")) {
  const scenarios = {
    example: source.example.decisions,
    concentrated: source.example.decisions.map(d => ({ ...d, district_id: d.district_id === null ? null : "esil" })),
    tradeoffs: [
      { measure_id: "M1", district_id: "esil" }, { measure_id: "M2", district_id: null },
      { measure_id: "M11", district_id: "nura" }, { measure_id: "M4", district_id: "saryarka" },
      { measure_id: "M12", district_id: null },
    ],
  };
  for (const [name, decisions] of Object.entries(scenarios)) {
    const started = Date.now();
    const http = await post("/api/analyze", request(decisions));
    const body = await http.json();
    assert.equal(http.status, 200, JSON.stringify(body.ai_error));
    assert.equal(body.status, "complete");
    assert.notEqual(body.model, "fixture-no-ai-call");
    const ids = new Set(body.evidence.map(f => f.id));
    for (const group of [body.analysis.strengths, body.analysis.risks, body.analysis.consequences]) {
      assert.ok(group.length >= 2 && group.length <= 3);
      for (const item of group) assert.ok(item.evidence_ids.length && item.evidence_ids.every(id => ids.has(id)));
    }
    const deterministic = await (await post("/api/simulate", request(decisions))).json();
    assert.deepEqual(body.simulation, deterministic.simulation);
    assert.ok(!("aiPoints" in body) && !("finalScore" in body));
    console.log(JSON.stringify({ scenario: name, status: body.status, model: body.model, prompt_version: body.prompt_version,
      elapsed_ms: Date.now() - started, score: body.simulation.after.score, critical_count: body.simulation.after.critical_count,
      summary: body.analysis.summary,
      tradeoff_explanations: name === "tradeoffs" ? [...body.analysis.risks, ...body.analysis.consequences] : undefined }));
  }
} else {
  console.log("AI was not called. Pass --live explicitly to run three paid analysis requests.");
}
