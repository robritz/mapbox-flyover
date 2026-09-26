import { createMessage, MAX_MESSAGE_LENGTH } from "@/lib/messages";

const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

/** Seal a message onto a flight. Body: { text, arrivesAt (epoch ms) }. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const arrivesAt = Number(body?.arrivesAt);

  if (!text || text.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: `Message must be 1–${MAX_MESSAGE_LENGTH} characters` }, { status: 400 });
  }
  if (!Number.isFinite(arrivesAt) || arrivesAt > Date.now() + TEN_YEARS_MS) {
    return Response.json({ error: "Invalid arrival time" }, { status: 400 });
  }

  const id = await createMessage(text, arrivesAt);
  return Response.json({ id }, { status: 201 });
}
