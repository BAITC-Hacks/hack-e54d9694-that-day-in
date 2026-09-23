import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const PARTICIPANT_COOKIE = "akim_participant";
const sign = (id: string, secret: string) => createHmac("sha256", secret).update(`participant-v1:${id}`).digest("hex");
export function participantIdentity(request: Request, secret: string) {
  if (secret.length < 32) throw new Error("PARTICIPANT_SECRET must be at least 32 characters");
  const token = (request.headers.get("cookie") ?? "").split(";").map(c => c.trim()).find(c => c.startsWith(`${PARTICIPANT_COOKIE}=`))?.slice(PARTICIPANT_COOKIE.length + 1);
  const [id, signature] = (token ?? "").split(".");
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id ?? "") && /^[a-f0-9]{64}$/.test(signature ?? "")) {
    if (timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(id, secret), "hex"))) return { id, setCookie: null };
  }
  const fresh = randomUUID();
  return { id: fresh, setCookie: `${PARTICIPANT_COOKIE}=${fresh}.${sign(fresh, secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol === "https:" ? "; Secure" : ""}` };
}
