import type { NextRequest } from "next/server";
import { isMessageId, readMessage } from "@/lib/messages";

/** Returns the text only after the flight has landed; otherwise its ETA. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/messages/[id]">) {
  const { id } = await ctx.params;
  const message = isMessageId(id) ? await readMessage(id) : null;
  if (!message) return Response.json({ error: "Message not found" }, { status: 404 });
  return Response.json(message, { headers: { "Cache-Control": "no-store" } });
}
