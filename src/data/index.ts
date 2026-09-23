import rawCatalog from "./catalog.json";
import { CatalogSchema } from "../shared/contracts";

/** Fixed synthetic catalog. Never imports UI fixtures or the legacy dataset/. */
export const catalog = CatalogSchema.parse(rawCatalog);
