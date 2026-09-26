"use client";

import { FormEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import type { Feature, LineString } from "geojson";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { BIRDS, type Bird } from "@/lib/birds";
import { birdOf, kmFlown, loadFlight, rebase, restart, saveFlight, totalKm, type Flight } from "@/lib/flight";
import { bearing, greatCircle, type LngLat } from "@/lib/geo";
import { geocode } from "@/lib/geocode";
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

// Zoom used when reopening a flight: close enough to see the bird move
// (a pigeon crosses roughly 1px every 2s at this level).
const BIRD_ZOOM = 12;

/** Point `t` (0–1) of the way along `path`, plus the segment it sits on. */
function pointAlong(path: LngLat[], t: number) {
  const idx = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
  const frac = t * (path.length - 1) - idx;
  const [a, b] = [path[idx], path[idx + 1]];
  const here: LngLat = [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
  return { idx, a, b, here };
}

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
  // Read every frame so bird/speed changes apply mid-flight.
  const flightRef = useRef<Flight | null>(null);
  const speedRef = useRef(10 ** DEFAULT_SPEED_EXP);
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
  const [flight, setFlight] = useState<Flight | null>(null);
  const [copied, setCopied] = useState(false);

  /** Make `f` the current flight everywhere: animation, UI, URL and storage. */
  function commit(f: Flight) {
    flightRef.current = f;
    setFlight(f);
    saveFlight(f);
  }

  /**
   * Draw the route and markers for `f`, then start animating. A new flight is
   * framed whole; a resumed one (`focusBird`) starts zoomed in on the bird.
   */
  function showFlight(f: Flight, { focusBird = false } = {}) {
    const map = mapRef.current;
    const mapboxgl = libRef.current;
    if (!map || !mapboxgl) return;

    const path = greatCircle(f.from.coords, f.to.coords);
    pathRef.current = path;

    markersRef.current.forEach((m) => m.remove());
    const flyerEl = document.createElement("div");
    flyerEl.innerHTML = birdOf(f).svg;
    markersRef.current = [
      new mapboxgl.Marker({ color: "#22c55e" }).setLngLat(path[0]).addTo(map),
      new mapboxgl.Marker({ color: "#ef4444" }).setLngLat(path[path.length - 1]).addTo(map),
      new mapboxgl.Marker({ element: flyerEl, rotationAlignment: "map" }).setLngLat(path[0]).addTo(map),
    ];

    (map.getSource("route") as GeoJSONSource).setData(lineFeature(path));
    (map.getSource("progress") as GeoJSONSource).setData(lineFeature([]));

    if (focusBird) {
      const total = totalKm(f);
      const { here } = pointAlong(path, total ? kmFlown(f, Date.now()) / total : 1);
      map.jumpTo({ center: here, zoom: BIRD_ZOOM });
      animate();
      return;
    }

    const bounds = path.reduce((b, p) => b.extend(p), new mapboxgl.LngLatBounds(path[0], path[0]));
    map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: 380, right: 80 }, maxZoom: 9, duration: 1500 });
    map.once("moveend", animate);
  }

  function animate() {
    const map = mapRef.current;
    const flyer = markersRef.current[2];
    const path = pathRef.current;
    if (!map || !flyer || path.length < 2) return;

    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const progress = map.getSource("progress") as GeoJSONSource;

    const step = () => {
      const f = flightRef.current;
      if (!f) return;
      // Position comes from the wall clock, so every viewer sees the same spot.
      // Great-circle points are evenly spaced, so array progress == distance flown.
      const total = totalKm(f);
      const km = kmFlown(f, Date.now());
      const t = total ? km / total : 1;
      const { idx, a, b, here } = pointAlong(path, t);

      progress.setData(lineFeature([...path.slice(0, idx + 1), here]));
      flyer.setLngLat(here).setRotation(bearing(a, b));
      if (clockRef.current) {
        const kmh = birdOf(f).kmh;
        const kmText = `${Math.round(km).toLocaleString()} of ${Math.round(total).toLocaleString()} km`;
        clockRef.current.textContent =
          t < 1
            ? `${formatDuration(flightHours(km, kmh))} / ${formatDuration(flightHours(total, kmh))} · ${kmText}`
            : `Landed after ${formatDuration(flightHours(total, kmh))}`;
      }

      frameRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    frameRef.current = requestAnimationFrame(step);
  }

  // Resume a flight from a shared link, or from this browser's last flight.
  const onMapReady = useEffectEvent(() => {
    const saved = loadFlight();
    if (!saved) return;
    setFrom(saved.from.name);
    setTo(saved.to.name);
    setBird(birdOf(saved));
    speedRef.current = saved.speed;
    setSpeedExp(Math.log10(saved.speed));
    commit(saved);
    showFlight(saved, { focusBird: true });
  });

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
        onMapReady();
      });
    })();

    return () => {
      cancelled = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mapRef.current || !bird) return;

    setLoading(true);
    setError(null);
    try {
      const [origin, dest] = await Promise.all([geocode(from, TOKEN), geocode(to, TOKEN)]);
      const f = restart({ from: origin, to: dest, birdId: bird.id, takeoff: 0, speed: speedRef.current });
      commit(f);
      showFlight(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function selectBird(next: Bird) {
    setBird(next);
    const f = flightRef.current;
    if (!f) return;
    // Keep the current position; the new bird just flies on from here.
    commit(rebase(f, { birdId: next.id }));
    const flyer = markersRef.current[2];
    if (flyer) flyer.getElement().innerHTML = next.svg;
  }

  function changeSpeed(exp: number) {
    speedRef.current = 10 ** exp;
    setSpeedExp(exp);
    const f = flightRef.current;
    if (f) commit(rebase(f, { speed: speedRef.current }));
  }

  function replay() {
    const f = flightRef.current;
    if (!f) return;
    commit(restart(f));
    animate();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Copy the link from the address bar instead.");
    }
  }

  const flightBird = flight && birdOf(flight);
  const flightKm = flight ? totalKm(flight) : 0;

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
              onChange={(e) => changeSpeed(Number(e.target.value))}
            />
            <span className={styles.hint}>
              {bird ? `${bird.name} · ${bird.kmh} km/h (${toMph(bird.kmh)} mph) · ` : ""}
              {describeSecond(speed)}
            </span>
          </label>
        </div>

        {!TOKEN && <p className={styles.error}>Missing NEXT_PUBLIC_MAPBOX_TOKEN in .env.local</p>}
        {error && <p className={styles.error}>{error}</p>}
        {flight && flightBird && (
          <div className={styles.trip}>
            <p><span className={styles.dotGreen} /> {flight.from.name}</p>
            <p><span className={styles.dotRed} /> {flight.to.name}</p>
            <p className={styles.distance}>
              {Math.round(flightKm).toLocaleString()} km · {Math.round(flightKm * 0.621371).toLocaleString()} mi
            </p>
            <p>
              {flightBird.name} flight time: {formatDuration(flightHours(flightKm, flightBird.kmh))}
              {flight.speed > 1.05 && (
                <> · on screen: {formatScreenTime(flightHours(flightKm, flightBird.kmh) / flight.speed)}</>
              )}
            </p>
            <p className={styles.clock}>
              <span ref={clockRef}>Taking off…</span>
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.link} onClick={copyLink}>
                {copied ? "Link copied!" : "Copy share link"}
              </button>
              <button type="button" className={styles.link} onClick={replay}>
                Restart flight
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
