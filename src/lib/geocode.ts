import type { LngLat } from "./geo";

export type Place = { name: string; coords: LngLat };

/** Resolve a free-text address to its best match via Mapbox Geocoding v6. */
export async function geocode(query: string, token: string): Promise<Place> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", token);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);

  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) throw new Error(`No match for "${query}"`);

  return {
    name: feature.properties.full_address ?? feature.properties.name ?? query,
    coords: feature.geometry.coordinates as LngLat,
  };
}
