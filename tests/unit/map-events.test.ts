import { describe, expect, it } from "vitest";
import { dataset } from "../../src/data";
import { simulateMapEvents } from "../../src/lib/simulation/map-events";
import { simulateScenario } from "../../src/lib/simulation";
import { districtCamera, districtAtPoint, CITY_CAMERA } from "../../src/features/map/camera";
import { zones } from "../../src/features/map/geography";

const rain = { event_id: "heavy-rain", district_id: "nura" };
describe("map event placements", () => {
  it("changes only the target and refunds the reserve on removal", () => {
    const original = structuredClone(dataset);
    const result = simulateMapEvents(dataset, [], [rain]);
    expect(result.emergency_reserve).toBe(10);
    expect(result.simulation.budget.remaining).toBe(90);
    expect(result.final_score).toBeNull();
    for (const district of result.simulation.districts) {
      const baseline = dataset.districts.find(d => d.id === district.district_id)!;
      expect(district.after.T1).toBe(baseline.indicators.T1 - (district.district_id === "nura" ? 4 : 0));
    }
    expect(simulateMapEvents(dataset, [], []).simulation).toEqual(simulateScenario(dataset, [], { draft: true }));
    expect(dataset).toEqual(original);
  });
  it("supports city scope and mixed positive/negative repair effects", () => {
    const result = simulateMapEvents(dataset, [], [{ event_id: "road-repair", district_id: null }]);
    for (const district of result.simulation.districts) {
      const before = dataset.districts.find(d => d.id === district.district_id)!.indicators;
      expect(district.after.T1).toBe(before.T1 - 3);
      expect(district.after.B2).toBe(before.B2 + 5);
      expect(district.after.C1).toBe(before.C1 + 6);
    }
  });
  it("sums before clamping, independently of placement order", () => {
    const data = structuredClone(dataset);
    data.districts.find(d => d.id === "nura")!.indicators.C1 = 99;
    const events = [rain, { event_id: "road-repair", district_id: "nura" }];
    const a = simulateMapEvents(data, [], events).simulation;
    expect(a).toEqual(simulateMapEvents(data, [], [...events].reverse()).simulation);
    expect(a.districts.find(d => d.district_id === "nura")!.after.C1).toBe(100);
    data.districts.find(d => d.id === "nura")!.indicators.T1 = 1;
    expect(simulateMapEvents(data, [], events).simulation.districts.find(d => d.district_id === "nura")!.after.T1).toBe(0);
  });
  it.each([
    [rain, rain], [{ event_id: "unknown", district_id: null }],
    [{ ...rain, district_id: "unknown" }], [rain, rain, rain, rain],
    [{ ...rain, deltas: { T1: 100 } }],
  ])("rejects invalid placements: %j", (...events) => {
    expect(() => simulateMapEvents(dataset, [], events)).toThrow();
  });
  it("rejects overspending and preserves the reference score with no events", () => {
    expect(() => simulateMapEvents(dataset, dataset.example.decisions, [rain])).toThrow();
    const result = simulateMapEvents(dataset, dataset.example.decisions, []);
    expect(result.final_score).toBe(56.54307);
    expect(result.simulation.budget.spent).toBe(95);
  });
});
it("district cameras contain the complete district polygon", () => {
  for (const zone of zones) {
    expect(districtAtPoint(zone.x, zone.y)).toBe(zone.id);
    const camera = districtCamera(zone.id);
    for (const point of zone.polygon.split(" ")) {
      const [x, y] = point.split(",").map(Number);
      expect(x).toBeGreaterThan(camera.x);
      expect(x).toBeLessThan(camera.x + camera.width);
      expect(y).toBeGreaterThan(camera.y);
      expect(y).toBeLessThan(camera.y + camera.width * .68);
    }
  }
  expect(districtCamera("unknown")).toEqual(CITY_CAMERA);
  expect(districtAtPoint(-100, -100)).toBeNull();
});
