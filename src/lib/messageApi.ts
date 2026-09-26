import type { MessageStatus } from "./messages";

/** Store a message server-side; it stays sealed until `arrivesAt`. */
export async function sealMessage(text: string, arrivesAt: number): Promise<string> {
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, arrivesAt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Couldn't save message (${res.status})`);
  return data.id;
}

/** Milliseconds from now until `epochMs` (negative if it has passed). */
export const msUntil = (epochMs: number) => epochMs - Date.now();

/** null when the message no longer exists (expired or bad link). */
export async function fetchMessage(id: string): Promise<MessageStatus | null> {
  const res = await fetch(`/api/messages/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Couldn't load message (${res.status})`);
  return res.json();
}
