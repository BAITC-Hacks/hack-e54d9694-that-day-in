// Map-only coordinates. Gameplay metrics always come from dataset/dataset.json.
// These are illustrative game zones, not administrative cadastral boundaries.
export const zones = [
  {
    id: "saryarka",
    name: "Сарыарка",
    x: 275,
    y: 225,
    color: "#8cab72",
    icon: "museum",
    landmark: "Музей первого президента",
    polygon: "30,25 510,25 518,240 430,306 336,332 198,326 20,320",
  },
  {
    id: "baikonur",
    name: "Байконур",
    x: 672,
    y: 140,
    color: "#b69d76",
    icon: "civic",
    landmark: "Военно-исторический музей",
    polygon: "510,25 1160,25 1160,245 805,275 667,318 518,240",
  },
  {
    id: "almaty",
    name: "Алматы",
    x: 935,
    y: 405,
    color: "#9b97bd",
    icon: "palace",
    landmark: "Дворец Независимости",
    polygon: "1160,245 805,275 667,318 653,428 780,510 1160,525",
  },
  {
    id: "nura",
    name: "Нура",
    x: 230,
    y: 535,
    color: "#76a796",
    icon: "tent",
    landmark: "Хан Шатыр",
    polygon:
      "20,320 198,326 336,332 430,306 518,240 515,344 450,415 460,490 410,670 355,810 20,810",
  },
  {
    id: "esil",
    name: "Есиль",
    x: 710,
    y: 690,
    color: "#71a9b7",
    icon: "tower",
    landmark: "Байтерек",
    polygon:
      "518,240 667,318 653,428 780,510 1160,525 1160,810 355,810 410,670 460,490 450,415 515,344",
  },
] as const;
export type LandmarkKind =
  "museum" | "civic" | "palace" | "tent" | "tower" | "sphere";
export const project = (lon: number, lat: number) => ({
  x: (lon - 71.35) * 6900 + 20,
  y: (51.205 - lat) * 6350 + 20,
});
export const landmarks: {
  name: string;
  lon: number;
  lat: number;
  kind: LandmarkKind;
}[] = [
  { name: "Хан Шатыр", lon: 71.40381, lat: 51.13257, kind: "tent" },
  { name: "Байтерек", lon: 71.43045, lat: 51.12829, kind: "tower" },
  { name: "EXPO", lon: 71.42134, lat: 51.09281, kind: "sphere" },
  { name: "Дворец Независимости", lon: 71.47181, lat: 51.1207, kind: "palace" },
  {
    name: "Музей первого президента",
    lon: 71.41908,
    lat: 51.16678,
    kind: "museum",
  },
  {
    name: "Военно-исторический музей",
    lon: 71.43124,
    lat: 51.15597,
    kind: "civic",
  },
];
