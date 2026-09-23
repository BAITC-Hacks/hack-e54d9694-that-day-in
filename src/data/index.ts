import rawDataset from "../../dataset/dataset.json";
import { DatasetSchema } from "../shared/contracts";

/** The sole data source; original IDs and values are preserved. */
export const dataset = DatasetSchema.parse(rawDataset);
