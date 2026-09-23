import { CityEventSchema } from "../shared/features";

/** Synthetic optional game rules, NOT observations or changes to dataset.json. */
export const cityEvents = CityEventSchema.array().parse([
  { id: "heavy-rain", title: "Сильные осадки", description: "Учебное событие: повреждение дорог и нагрузка на коммунальные службы. Зарезервируйте 10 единиц на срочные работы.", reserve_cost: 10,
    effects: [{ district_id: null, deltas: { T1: -4, C1: -5 } }] },
  { id: "heat-wave", title: "Жара", description: "Учебное событие: ухудшение экологического комфорта. Зарезервируйте 5 единиц на экстренную помощь.", reserve_cost: 5,
    effects: [{ district_id: null, deltas: { E1: -4, S2: -3 } }] },
  { id: "utility-failure", title: "Сбой городских сервисов", description: "Учебное событие: перебои обслуживания. Зарезервируйте 10 единиц на восстановление.", reserve_cost: 10,
    effects: [{ district_id: null, deltas: { C1: -6, C2: -4 } }] },
  { id: "road-repair", title: "Ремонт улиц", description: "Учебное событие: плановый ремонт улучшает состояние улиц и ЖКХ, но временно затрудняет движение. Резерв — 10 единиц.", reserve_cost: 10,
    effects: [{ district_id: null, deltas: { T1: -3, B2: 5, C1: 6 } }] },
]);
