import { catalog, jsonResponse } from "../_lib/scenario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  return jsonResponse(catalog);
}
