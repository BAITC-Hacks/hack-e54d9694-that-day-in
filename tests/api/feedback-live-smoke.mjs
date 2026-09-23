// Manual check only. --live enables real, paid extraction of explicitly synthetic reviews.
import assert from "node:assert/strict";

if (!process.argv.includes("--live")) {
  console.log("No AI requests made. Start the application, then pass --live to check synthetic review processing.");
} else {
  const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3031";
  const response = await fetch(`${base}/api/catalog`);
  assert.equal(response.status, 200);
  const catalog = await response.json();
  const created_at = new Date(Date.now() - 60_000).toISOString();
  const reviews = [
    { id: "live-test-1", district_id: "nura", created_at, text: "В Нуре утром долго жду автобус на остановке." },
    { id: "live-test-2", district_id: "nura", created_at, text: "Автобусы в Нуре ходят редко, трудно добраться до работы." },
    { id: "live-test-3", district_id: "nura", created_at, text: "На моей остановке в Нуре большие интервалы между автобусами." },
  ];
  const run = async (name, input) => {
    const started = Date.now();
    const http = await fetch(`${base}/api/feedback/recalculate`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_version: catalog.dataset_version, reviews: input }), signal: AbortSignal.timeout(60_000) });
    const result = await http.json();
    assert.equal(http.status, 200, JSON.stringify(result.ai_error));
    assert.equal(result.status, "complete");
    assert.equal(result.mode, "experimental_feedback_projection");
    for (const signal of result.extraction.signals) assert.ok(input.find(r => r.id === signal.review_id)?.text.includes(signal.evidence_quote));
    console.log(JSON.stringify({ scenario: name, model: result.model, elapsed_ms: Date.now() - started,
      changes: result.projection.changes, score: result.projection.after.score, signals: result.extraction.signals }));
    return result;
  };
  const supported = await run("three-negative-reviews", reviews);
  assert.equal(supported.projection.districts.find(d => d.district_id === "nura").after.T2, 39);
  assert.equal(supported.projection.after.score, 51.51648);
  const insufficient = await run("single-review", [reviews[0]]);
  assert.deepEqual(insufficient.projection.after, catalog.dataset.baseline);
  const positive = await run("three-positive-reviews", [
    { id: "positive-1", district_id: "esil", created_at, text: "В районе Есиль много зелёных насаждений, дворы хорошо озеленены." },
    { id: "positive-2", district_id: "esil", created_at, text: "В Есиле достаточно деревьев и ухоженных зелёных пространств возле домов." },
    { id: "positive-3", district_id: "esil", created_at, text: "Довольна озеленением района Есиль: вокруг много скверов и деревьев." },
  ]);
  assert.equal(positive.projection.districts.find(d => d.district_id === "esil").after.E1, 69);
  const unchanged = await (await fetch(`${base}/api/catalog`)).json();
  assert.deepEqual(unchanged, catalog);
  console.log("Real extraction checks passed; the authoritative catalog is unchanged. Inputs were synthetic, not collected resident data.");
}
