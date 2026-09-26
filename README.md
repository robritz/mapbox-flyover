# Carriers

My good friend Matthew and I sometimes take longer than we'd like to respond to messages. I made the joke, "Let's just pretend we're using carrier pigeons! That way its less embarrassing!"

This is a fun-hearted POC built in Next.js and hosted on Vercel. Maps via the <a href="https://www.mapbox.com/">Mapbox API</a>.

Play with it here: https://carriers.robritz.com

<img width="1200" height="798" alt="image" src="https://github.com/user-attachments/assets/f4f2f166-3597-4d1e-9a24-39069c158762" />


Choose a bird and set it loose. It will fly from point A to point B at its documented average speed.

## Run

```bash
# .env.local (already present locally)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token
KV_REST_API_URL=https://your-db.upstash.io     # Upstash Redis, for sealed messages
KV_REST_API_TOKEN=your_upstash_token
npm install
npm run dev
```

Open http://localhost:3000.

## Using it

1. Pick a bird tile: **Pigeon**, **Seagull**, or **Mourning Dove**. You must pick one before **Fly** is enabled.
2. Enter a From and To address and click **Fly**.
3. The bird flies the route in **real time** at its average cruising speed. The panel shows the distance, the bird's total flight time, and a live elapsed clock.

Once a flight starts, the bird tiles and form are hidden and the panel shows only the flight's stats and links. The bird can't be changed mid-flight.

- **Copy share link** copies a link to this flight.
- **New flight** clears the flight (and the URL) and brings back the empty form.

### Sharing and resuming

Clicking **Fly** writes the flight into the address bar, for example `/?bird=pigeon&from=…&to=…&t=<takeoff time>`. The bird's position is always calculated from the takeoff time, so:

- **Copy share link** (or the address bar) gives a link anyone can open to see the bird where it is right now.
- Closing and reopening the browser resumes your last flight, even from the plain base URL, because it is also saved in this browser's local storage.

The flight itself is not stored on a server. A shared link doesn't pick up a restart made after it was copied; copy a fresh link after restarting.

| Bird | Speed used | Typical cruising range |
|---|---|---|
| Pigeon | 72 km/h (45 mph) | 40–50 mph |
| Seagull (herring gull) | 35 km/h (22 mph) | 20–25 mph |
| Mourning dove | 56 km/h (35 mph) | 30–40 mph |

Because flights are real time, long routes take a long time: San Francisco → Tokyo is about 115 hours for a pigeon. Use nearby addresses to see visible movement.

### Sealed messages

Every flight carries a message of up to 280 characters, and **Fly** stays disabled until you write one. It is stored in Upstash Redis, tied to that flight, and the box clears. Nobody sees it (not even the sender) until the bird lands, and then it appears as a speech bubble next to the bird.

- The flight's link carries only the message id (`msg=…`). The server returns the text only once the flight's arrival time has passed, so it can't be read early.
- Messages are kept for 30 days after landing.

### Hidden time-lapse slider

A logarithmic time-lapse slider (1× to 100,000×) is built in but hidden, and the default is 1× (real time). To show it, remove the `hidden` wrapper around the slider in `src/components/FlightMap.tsx`. You can change `DEFAULT_SPEED_EXP` in that file to set a different starting speed (the multiplier is 10 to that power).

## How it works

- `src/lib/birds.ts`: each bird's name, cruising speed, and top-down SVG icon. The icons point north so the map marker can rotate to the direction of travel.
- `src/lib/geocode.ts`: turns each address into coordinates with the Mapbox Geocoding v6 API.
- `src/lib/geo.ts`: computes the great-circle path, distance, and heading. Longitudes are unwrapped so routes crossing the date line stay continuous.
- `src/lib/flight.ts`: the flight record (route, bird, takeoff time, speed), its URL encoding, saving to local storage, and the position-from-clock math.
- `src/lib/messages.ts` and `src/app/api/messages/`: the server side of sealed messages. `POST /api/messages` stores one; `GET /api/messages/[id]` returns the text only after landing.
- `src/lib/messageApi.ts`: the browser's calls to those routes.
- `src/components/FlightMap.tsx`: the Mapbox GL globe, bird tiles, dashed full route, solid "flown" line, and the rotating bird marker. Each frame places the bird from the wall clock, so every viewer sees the same position.
