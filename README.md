# Flyover

Next.js POC: pick a bird, enter two addresses, and watch the bird fly the **great-circle path** between them (a straight line over the globe, not a road route) at that species' real average cruising speed.

## Run

```bash
echo "NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token" > .env.local   # already present locally
npm install
npm run dev
```

Open http://localhost:3000.

## Using it

1. Pick a bird tile: **Pigeon**, **Seagull**, or **Mourning Dove**. You must pick one before **Fly** is enabled.
2. Enter a From and To address and click **Fly**.
3. The bird flies the route in **real time** at its average cruising speed. The panel shows the distance, the bird's total flight time, and a live elapsed clock.

You can switch birds mid-flight: the icon and speed change immediately and the bird carries on from where it is. **Restart flight** sends it back to the origin.

### Sharing and resuming

Clicking **Fly** writes the flight into the address bar, for example `/?bird=pigeon&from=…&to=…&t=<takeoff time>`. The bird's position is always calculated from the takeoff time, so:

- **Copy share link** (or the address bar) gives a link anyone can open to see the bird where it is right now.
- Closing and reopening the browser resumes your last flight, even from the plain base URL, because it is also saved in this browser's local storage.

Nothing is stored on a server. A shared link doesn't pick up changes made after it was copied (such as switching birds); copy a fresh link after changing it.

| Bird | Speed used | Typical cruising range |
|---|---|---|
| Pigeon | 72 km/h (45 mph) | 40–50 mph |
| Seagull (herring gull) | 35 km/h (22 mph) | 20–25 mph |
| Mourning dove | 56 km/h (35 mph) | 30–40 mph |

Because flights are real time, long routes take a long time: San Francisco → Tokyo is about 115 hours for a pigeon. Use nearby addresses to see visible movement.

### Hidden time-lapse slider

A logarithmic time-lapse slider (1× to 100,000×) is built in but hidden, and the default is 1× (real time). To show it, remove the `hidden` wrapper around the slider in `src/components/FlightMap.tsx`. You can change `DEFAULT_SPEED_EXP` in that file to set a different starting speed (the multiplier is 10 to that power).

## How it works

- `src/lib/birds.ts`: each bird's name, cruising speed, and top-down SVG icon. The icons point north so the map marker can rotate to the direction of travel.
- `src/lib/geocode.ts`: turns each address into coordinates with the Mapbox Geocoding v6 API.
- `src/lib/geo.ts`: computes the great-circle path, distance, and heading. Longitudes are unwrapped so routes crossing the date line stay continuous.
- `src/lib/flight.ts`: the flight record (route, bird, takeoff time, speed), its URL encoding, saving to local storage, and the position-from-clock math.
- `src/components/FlightMap.tsx`: the Mapbox GL globe, bird tiles, dashed full route, solid "flown" line, and the rotating bird marker. Each frame places the bird from the wall clock, so every viewer sees the same position.
