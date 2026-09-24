"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Feature, LineString } from "geojson";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { BIRDS, type Bird } from "@/lib/birds";
import { bearing, distanceKm, greatCircle, type LngLat } from "@/lib/geo";
import { geocode, type Place } from "@/lib/geocode";
import styles from "./FlightMap.module.css";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
// Time-lapse slider is logarithmic: 10^0 = real time … 10^5 = 100,000×.
// The slider is currently hidden, so flights play in real time.
const MAX_SPEED_EXP = 5;
const DEFAULT_SPEED_EXP = 0;

const flightHours = (km: number, kmh: number) => km / kmh;
const toMph = (kmh: number) => Math.round(kmh * 0.621371);

function formatDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function formatScreenTime(hours: number): string {
  const sec = hours * 3600;
  return sec < 60 ? `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s` : formatDuration(hours);
}

function formatSpeed(multiplier: number): string {
  const nice = multiplier < 10 ? Math.round(multiplier * 10) / 10 : Math.round(multiplier);
  return `${nice.toLocaleString()}×`;
}

/** What one second on screen represents at a given time-lapse multiplier. */
function describeSecond(multiplier: number): string {
  if (multiplier < 1.05) return "real time";
  if (multiplier < 60) return `1s = ${Math.round(multiplier)}s of flight`;
  if (multiplier < 3600) return `1s = ${Math.round(multiplier / 60)} min of flight`;
  return `1s = ${(multiplier / 3600).toFixed(1).replace(/\.0$/, "")} hr of flight`;
}

type mapboxgl = typeof import("mapbox-gl").default;

const lineFeature = (coords: LngLat[]): Feature<LineString> => ({
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates: coords },
});

export default function FlightMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const libRef = useRef<mapboxgl | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const frameRef = useRef<number | null>(null);
  const pathRef = useRef<LngLat[]>([]);
  // Read every frame so slider changes apply mid-flight.
  const speedRef = useRef(10 ** DEFAULT_SPEED_EXP);
  // Read every frame so switching birds mid-flight changes speed immediately.
  const birdRef = useRef<Bird | null>(null);
  // Updated imperatively each frame to avoid re-rendering at 60fps.
  const clockRef = useRef<HTMLSpanElement>(null);

  const [ready, setReady] = useState(false);
  const [from, setFrom] = useState("San Francisco, CA");
  const [to, setTo] = useState("Tokyo, Japan");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bird, setBird] = useState<Bird | null>(null);
  const [speedExp, setSpeedExp] = useState(DEFAULT_SPEED_EXP);
  const speed = 10 ** speedExp;
  const [trip, setTrip] = useState<{ from: Place; to: Place; km: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: MapboxMap | undefined;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      libRef.current = mapboxgl;

      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe",
        center: [-40, 30],
        zoom: 1.4,
      });
      mapRef.current = map;

      map.on("style.load", () => {
        map!.setFog({});
        map!.addSource("route", { type: "geojson", data: lineFeature([]) });
        map!.addSource("progress", { type: "geojson", data: lineFeature([]) });
        map!.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-cap": "round" },
          paint: { "line-color": "#7dd3fc", "line-width": 2, "line-opacity": 0.5, "line-dasharray": [2, 2] },
        });
        map!.addLayer({
          id: "progress",
          type: "line",
          source: "progress",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#facc15", "line-width": 3.5 },
        });
        setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  function animate() {
    const map = mapRef.current;
    const flyer = markersRef.current[2];
    const path = pathRef.current;
    if (!map || !flyer || path.length < 2) return;

    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const progress = map.getSource("progress") as GeoJSONSource;
    // Great-circle points are evenly spaced, so progress along the array is
    // proportional to distance flown at a constant cruise speed.
    const totalKm = distanceKm(path[0], path[path.length - 1]);
    let kmFlown = 0;
    let hoursElapsed = 0;
    let last: number | null = null;

    const step = (now: number) => {
      const kmh = birdRef.current?.kmh ?? 1;
      const dtHours = ((now - (last ?? now)) * speedRef.current) / 3_600_000;
      last = now;
      kmFlown = Math.min(totalKm, kmFlown + dtHours * kmh);
      hoursElapsed += dtHours;
      const t = totalKm ? kmFlown / totalKm : 1;
      const idx = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
      const frac = t * (path.length - 1) - idx;
      const [a, b] = [path[idx], path[idx + 1]];
      const here: LngLat = [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];

      progress.setData(lineFeature([...path.slice(0, idx + 1), here]));
      flyer.setLngLat(here).setRotation(bearing(a, b));
      if (clockRef.current) {
        const totalHours = hoursElapsed + flightHours(totalKm - kmFlown, kmh);
        clockRef.current.textContent = `${formatDuration(hoursElapsed)} / ${formatDuration(totalHours)}`;
      }

      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const map = mapRef.current;
    const mapboxgl = libRef.current;
    if (!map || !mapboxgl || !bird) return;

    setLoading(true);
    setError(null);
    try {
      const [origin, dest] = await Promise.all([geocode(from, TOKEN), geocode(to, TOKEN)]);
      const path = greatCircle(origin.coords, dest.coords);
      pathRef.current = path;

      markersRef.current.forEach((m) => m.remove());
      const flyerEl = document.createElement("div");
      flyerEl.innerHTML = bird.svg;
      markersRef.current = [
        new mapboxgl.Marker({ color: "#22c55e" }).setLngLat(path[0]).addTo(map),
        new mapboxgl.Marker({ color: "#ef4444" }).setLngLat(path[path.length - 1]).addTo(map),
        new mapboxgl.Marker({ element: flyerEl, rotationAlignment: "map" }).setLngLat(path[0]).addTo(map),
      ];

      (map.getSource("route") as GeoJSONSource).setData(lineFeature(path));
      (map.getSource("progress") as GeoJSONSource).setData(lineFeature([]));

      const bounds = path.reduce(
        (b, p) => b.extend(p),
        new mapboxgl.LngLatBounds(path[0], path[0]),
      );
      map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: 380, right: 80 }, maxZoom: 9, duration: 1500 });
      map.once("moveend", animate);

      setTrip({ from: origin, to: dest, km: distanceKm(origin.coords, dest.coords) });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function selectBird(next: Bird) {
    birdRef.current = next;
    setBird(next);
    // Swap the icon on the map too if a flight is already showing.
    const flyer = markersRef.current[2];
    if (flyer) flyer.getElement().innerHTML = next.svg;
  }

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.map} />

      <form className={styles.panel} onSubmit={onSubmit}>
        <h1 className={styles.title}>Flyover</h1>
        <div className={styles.tiles} role="radiogroup" aria-label="Bird">
          {BIRDS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={bird?.id === b.id}
              className={`${styles.tile} ${bird?.id === b.id ? styles.tileSelected : ""}`}
              onClick={() => selectBird(b)}
            >
              <span className={styles.tileIcon} dangerouslySetInnerHTML={{ __html: b.svg }} />
              <span className={styles.tileName}>{b.name}</span>
              <span className={styles.tileSpeed}>
                {b.kmh} km/h · {toMph(b.kmh)} mph
              </span>
            </button>
          ))}
        </div>
        <label className={styles.label}>
          From
          <input className={styles.input} value={from} onChange={(e) => setFrom(e.target.value)} required />
        </label>
        <label className={styles.label}>
          To
          <input className={styles.input} value={to} onChange={(e) => setTo(e.target.value)} required />
        </label>
        <button className={styles.button} type="submit" disabled={!ready || loading || !bird}>
          {loading ? "Finding…" : bird ? `Fly the ${bird.name.toLowerCase()}` : "Pick a bird to fly"}
        </button>

        {/* Hidden for now; flights play in real time (1×). */}
        <div hidden>
        <label className={styles.label}>
          Time-lapse · {formatSpeed(speed)}
          <input
            className={styles.slider}
            type="range"
            min={0}
            max={MAX_SPEED_EXP}
            step={0.01}
            value={speedExp}
            onChange={(e) => {
              const exp = Number(e.target.value);
              speedRef.current = 10 ** exp;
              setSpeedExp(exp);
            }}
          />
          <span className={styles.hint}>
            {bird ? `${bird.name} · ${bird.kmh} km/h (${toMph(bird.kmh)} mph) · ` : ""}
            {describeSecond(speed)}
          </span>
        </label>
        </div>

        {!TOKEN && <p className={styles.error}>Missing NEXT_PUBLIC_MAPBOX_TOKEN in .env.local</p>}
        {error && <p className={styles.error}>{error}</p>}
        {trip && bird && (
          <div className={styles.trip}>
            <p><span className={styles.dotGreen} /> {trip.from.name}</p>
            <p><span className={styles.dotRed} /> {trip.to.name}</p>
            <p className={styles.distance}>
              {Math.round(trip.km).toLocaleString()} km · {Math.round(trip.km * 0.621371).toLocaleString()} mi
            </p>
            <p>
              {bird.name} flight time: {formatDuration(flightHours(trip.km, bird.kmh))}
              {speed > 1.05 && <> · on screen: {formatScreenTime(flightHours(trip.km, bird.kmh) / speed)}</>}
            </p>
            <p className={styles.clock}>
              Elapsed <span ref={clockRef}>0m / {formatDuration(flightHours(trip.km, bird.kmh))}</span>
            </p>
            <button type="button" className={styles.link} onClick={animate}>
              Replay flight
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
