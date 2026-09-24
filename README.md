# Flyover

Next.js POC: enter two addresses and Mapbox draws the **great-circle flight path** between them (not a road route), then animates a plane along it on a 3D globe.

## Run

```bash
echo "NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token" > .env.local   # already present locally
npm install
npm run dev
```

Open http://localhost:3000.

## How it works

- `src/lib/geocode.ts` — turns each address into coordinates via the Mapbox Geocoding v6 API.
- `src/lib/geo.ts` — computes the great-circle arc (spherical interpolation), distance, and bearing. Longitudes are unwrapped so routes crossing the date line (e.g. SF → Tokyo) stay continuous.
- `src/components/FlightMap.tsx` — Mapbox GL globe, dashed full route, animated solid "flown" line, and a rotating plane marker.
