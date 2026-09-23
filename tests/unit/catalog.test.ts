import { describe, expect, it } from "vitest";
import { catalog } from "../../src/data";
import { controlScenarios } from "../../src/data/control-scenarios";
import { CatalogSchema, DIRECTIONS, EvaluateRequestSchema } from "../../src/shared/contracts";

describe("fixed synthetic catalog", () => {
  it("has six linked districts, three priced alternatives per direction and equal weights", () => {
    expect(CatalogSchema.safeParse(catalog).success).toBe(true);
    expect(catalog.districts.reduce((sum, d) => sum + d.population, 0)).toBe(500000);
    expect(catalog.districts.map((d) => d.name)).toEqual(["Центр", "Северный", "Южный", "Восточный", "Западный", "Прибрежный"]);
    for (const direction of DIRECTIONS) {
      expect(catalog.programs.filter((p) => p.direction === direction).map((p) => p.cost)).toEqual([12, 20, 28]);
    }
    expect(catalog.programs.some((p) => p.effects.some((e) => Object.values(e.deltas).some((v) => v < 0)))).toBe(true);
  });

  it.each(["unknown district", "duplicate district", "duplicate program", "wrong prices", "wrong weights", "duplicate effect"])("rejects %s", (mutation) => {
    const data = structuredClone(catalog);
    if (mutation === "unknown district") data.programs[0].effects[0].districtId = "missing";
    if (mutation === "duplicate district") data.districts[1].id = data.districts[0].id;
    if (mutation === "duplicate program") data.programs[1].id = data.programs[0].id;
    if (mutation === "wrong prices") data.programs[0].cost = 13;
    if (mutation === "wrong weights") data.metricWeights.social = 0.3;
    if (mutation === "duplicate effect") data.programs[0].effects.push(data.programs[0].effects[0]);
    expect(CatalogSchema.safeParse(data).success).toBe(false);
  });

  it("keeps three distinct, complete, affordable live review inputs", () => {
    expect(new Set(Object.values(controlScenarios).map((r) => JSON.stringify(r.selections))).size).toBe(3);
    for (const request of Object.values(controlScenarios)) {
      expect(EvaluateRequestSchema.safeParse(request).success).toBe(true);
      const programs = DIRECTIONS.map((d) => catalog.programs.find((p) => p.id === request.selections[d])!);
      expect(programs.every((p, i) => p.direction === DIRECTIONS[i])).toBe(true);
      expect(programs.reduce((sum, p) => sum + p.cost, 0)).toBeLessThanOrEqual(100);
    }
  });
});
