// Server-only: reads Upstash credentials from the environment.
import { Redis } from "@upstash/redis";

export const MAX_MESSAGE_LENGTH = 280;
// Keep delivered messages around for a month so late viewers can still read them.
const KEEP_AFTER_ARRIVAL_S = 30 * 24 * 60 * 60;
// Viewers' clocks may run slightly fast; don't make them wait on a few seconds.
const CLOCK_TOLERANCE_MS = 5_000;

type StoredMessage = { text: string; arrivesAt: number };

export type MessageStatus =
  | { status: "delivered"; text: string }
  | { status: "in-flight"; arrivesAt: number };

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const key = (id: string) => `flyover:message:${id}`;

export const isMessageId = (id: string) => /^[0-9a-f-]{36}$/.test(id);

export async function createMessage(text: string, arrivesAt: number): Promise<string> {
  const id = crypto.randomUUID();
  const ttl = Math.ceil((arrivesAt - Date.now()) / 1000) + KEEP_AFTER_ARRIVAL_S;
  await redis.set<StoredMessage>(key(id), { text, arrivesAt }, { ex: Math.max(ttl, 60) });
  return id;
}

/** The message text only once the bird has landed; before that, just the ETA. */
export async function readMessage(id: string): Promise<MessageStatus | null> {
  const stored = await redis.get<StoredMessage>(key(id));
  if (!stored) return null;
  return Date.now() + CLOCK_TOLERANCE_MS >= stored.arrivesAt
    ? { status: "delivered", text: stored.text }
    : { status: "in-flight", arrivesAt: stored.arrivesAt };
}
