# uptyme

A watch. The **time** axis of codereimagine.

Live: [codereimagine.github.io/uptyme](https://codereimagine.github.io/uptyme/)

By **Bert Peters**.

## Screenshots

<table>
  <tr>
    <th>Mobile</th>
    <th>Desktop</th>
  </tr>
  <tr>
    <td><img src="docs/screenshots/watch-mobile.png" alt="uptyme — mobile" width="280"></td>
    <td><img src="docs/screenshots/watch-desktop.png" alt="uptyme — desktop" width="500"></td>
  </tr>
  <tr>
    <td colspan="2"><sub>Watch face floating in a full-bleed starfield. Solar altitude, "you are here" coords, optional second-city readout.</sub></td>
  </tr>
</table>

> Screenshots above are captured against `npm run preview` with a demo geolocation (Belize). Re-capture after UI changes — see `scripts/` or run Playwright against the preview server.

## What it does

- **A watch.** Your local time, presented as the primary instrument. Two faces: **Orbit** (sun position around the horizon) and **Clock** (classic dial).
- **Geolocation on first paint.** First load asks the browser for your coordinates so the watch knows where you are. No network is involved — the geolocation API is a local browser primitive. Deny it and you get Greenwich (the canonical zero-meridian) as a fallback.
- **Optional second city.** Pin one elsewhere place beneath the face. Search any city worldwide; the result carries its own IANA timezone so the readout stays DST-correct.
- **Atmospheric starfield.** Full-bleed, the instrument floats and scales-to-fit.
- **Installable PWA.** Works offline once cached.
- **Local-first by lock.** Zero runtime network for the watch itself. The only network call in the entire app is the geocoding search you explicitly trigger.

## Data sources

- **Sun position + altitude + bands**: NOAA Solar Position Algorithm (Meeus chapter 25), implemented locally in `src/engine.ts`. Verified byte-faithful against the vanilla harness it ports from. **No network.**
- **Moon phase**: Meeus chapter 49, true new- and full-moon instants, also in `src/engine.ts`. **No network.**
- **Timezone math**: device `Intl.DateTimeFormat` for the default place; for searched cities, the IANA tz returned by the geocoder. **No network at watch time.**
- **City search (explicit, user-triggered only)**: [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api) (keyless). Used by `src/lib/geocode.ts` only when the user types in the second-city search.

## Stack

React 18 · Vite · TypeScript · vite-plugin-pwa (Workbox) · Vitest.

## Develop

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc -b && vite build
npm run preview   # serves the production bundle
npm run test
```

## Project layout

```
src/
  faces/                # watch faces
    Clock.tsx           # classic dial
    Orbit.tsx           # sun-around-horizon view
  components/
    PlacesView.tsx      # second-city search panel
    Settings.tsx        # settings UI (face, time format, units, atmosphere)
    UpdateBanner.tsx    # SW update prompt
  hooks/
    useFitScale.ts      # scale-to-fit the instrument
    useVisualViewport.ts
  lib/
    geocode.ts          # Open-Meteo city search (only outbound fetch in the app)
    PwaUpdate.tsx       # registerSW wrapper
  store/
    settings.ts         # zustand store (persisted)
  engine.ts             # sun + moon math, pure-local
  engine.test.ts        # Meeus / NOAA verification
  usePlace.ts           # active place + optional second place
  useMode.ts            # which face is showing
  useTicker.ts          # rAF loop driving the dial
  App.tsx
  main.tsx
public/                 # PWA manifest + icons
docs/
  screenshots/          # README images
```

## Related

uptyme is one of three axes of codereimagine:

- **[bewthr](https://github.com/codereimagine/bewthr)** — continuum (weather)
- **uptyme** — time
- **[starnav](https://github.com/codereimagine/starnav)** — space

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
