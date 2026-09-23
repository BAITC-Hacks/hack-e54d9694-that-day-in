import { describe, expect, it } from "vitest";
import source from "../../dataset/dataset.json";
import { dataset } from "../../src/data";
import { DatasetSchema } from "../../src/shared/contracts";
import { controlScenarios } from "../../src/data/control-scenarios";
import { validateSelections } from "../../src/lib/simulation";

describe("authoritative dataset", () => {
  it("preserves the entire original JSON, IDs and coefficients", () => {
    expect(dataset).toEqual(source);
    expect(dataset.districts).toHaveLength(5);
    expect(dataset.measures).toHaveLength(14);
    expect(dataset.indicators).toHaveLength(10);
    expect(dataset.directions.map(d => d.id)).toContain("ecology");
  });
  it.each(["duplicate district", "duplicate measure", "unknown synergy", "invalid weights", "invalid shares", "invalid lag", "unknown effect"])("rejects %s", mutation => {
    const value = structuredClone(dataset);
    if (mutation === "duplicate district") value.districts[1].id = value.districts[0].id;
    if (mutation === "duplicate measure") value.measures[1].id = value.measures[0].id;
    if (mutation === "unknown synergy") value.synergies[0].target_district_of = "M99";
    if (mutation === "invalid weights") value.indicators[0].weight = 0.5;
    if (mutation === "invalid shares") value.districts[0].population_share = 0.9;
    if (mutation === "invalid lag") value.measures[0].lag_quarters = 9;
    if (mutation === "unknown effect") Object.assign(value.measures[0].effects, { unknown: 3 });
    expect(DatasetSchema.safeParse(value).success).toBe(false);
  });
  it("has valid control scenarios", () => {
    for (const decisions of Object.values(controlScenarios)) expect(validateSelections(dataset, decisions).valid).toBe(true);
  });
});
