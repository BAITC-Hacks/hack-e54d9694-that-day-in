import { jsonResponse, readScenario } from "../_lib/scenario";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  const prepared = await readScenario(request);
  return prepared.ok ? jsonResponse(prepared.result) : jsonResponse(prepared.error, prepared.status);
}
