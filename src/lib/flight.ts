import { BIRDS, type Bird } from "./birds";
import type { Place } from "./geocode";
import { distanceKm, type LngLat } from "./geo";

/**
 * Everything needed to reproduce a flight in any browser. Progress is never
 * stored: it's derived from the wall clock, so every viewer sees the same spot.
 */
export type Flight = {
  from: Place;
  to: Place;
  birdId: Bird["id"];
  /** Epoch ms at which the bird would have been at the origin. */
  takeoff: number;
  /** Time-lapse multiplier (1 = real time). */
  speed: number;
};

const STORAGE_KEY = "flyover:flight";
const MS_PER_HOUR = 3_600_000;

export const birdOf = (f: Flight): Bird => BIRDS.find((b) => b.id === f.birdId)!;
export const totalKm = (f: Flight) => distanceKm(f.from.coords, f.to.coords);

export function kmFlown(f: Flight, now: number): number {
  const hours = ((now - f.takeoff) / MS_PER_HOUR) * f.speed;
  return Math.min(totalKm(f), Math.max(0, hours * birdOf(f).kmh));
}

/**
 * Apply a new bird or speed without teleporting the bird: shift `takeoff` so
 * the distance flown right now stays the same under the new settings.
 */
export function rebase(
  f: Flight,
  changes: Partial<Pick<Flight, "birdId" | "speed">>,
  now = Date.now(),
): Flight {
  const km = kmFlown(f, now);
  const next = { ...f, ...changes };
  const kmPerMs = (birdOf(next).kmh * next.speed) / MS_PER_HOUR;
  return { ...next, takeoff: now - km / kmPerMs };
}

/** The same flight, taking off again right now. */
export const restart = (f: Flight): Flight => ({ ...f, takeoff: Date.now() });

// --- URL encoding -----------------------------------------------------------

const fmtCoords = ([lng, lat]: LngLat) => `${lng.toFixed(5)},${lat.toFixed(5)}`;

function parseCoords(value: string | null): LngLat | null {
  const parts = value?.split(",").map(Number);
  if (!parts || parts.length !== 2 || !parts.every(Number.isFinite)) return null;
  return [parts[0], parts[1]];
}

export function toSearchParams(f: Flight): URLSearchParams {
  const params = new URLSearchParams({
    bird: f.birdId,
    from: fmtCoords(f.from.coords),
    fromName: f.from.name,
    to: fmtCoords(f.to.coords),
    toName: f.to.name,
    t: String(Math.round(f.takeoff)),
  });
  if (f.speed !== 1) params.set("x", String(f.speed));
  return params;
}

export function fromSearchParams(params: URLSearchParams): Flight | null {
  const bird = BIRDS.find((b) => b.id === params.get("bird"));
  const from = parseCoords(params.get("from"));
  const to = parseCoords(params.get("to"));
  const takeoff = Number(params.get("t"));
  const speed = Number(params.get("x") ?? 1);
  if (!bird || !from || !to || !Number.isFinite(takeoff) || !(speed > 0)) return null;

  return {
    from: { name: params.get("fromName") || "Origin", coords: from },
    to: { name: params.get("toName") || "Destination", coords: to },
    birdId: bird.id,
    takeoff,
    speed,
  };
}

// --- Persistence ------------------------------------------------------------

/** Mirror the flight into the address bar (shareable) and localStorage (reopenable). */
export function saveFlight(f: Flight) {
  const params = toSearchParams(f);
  window.history.replaceState(null, "", `?${params}`);
  try {
    localStorage.setItem(STORAGE_KEY, params.toString());
  } catch {
    // Storage can be blocked (private mode, disabled site data); the URL still works.
  }
}

/** The URL wins so shared links always show the sender's flight. */
export function loadFlight(): Flight | null {
  const fromUrl = fromSearchParams(new URLSearchParams(window.location.search));
  if (fromUrl) return fromUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? fromSearchParams(new URLSearchParams(stored)) : null;
  } catch {
    return null;
  }
}
