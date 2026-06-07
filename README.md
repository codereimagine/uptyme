# uptyme

A watch. The **time** axis of codereimagine.

Live: [codereimagine.github.io/uptyme](https://codereimagine.github.io/uptyme/)

By **Bert Peters**.

## Screenshots

_Coming soon — pending fresh captures of the current build._

## What it does

- A watch — your local time, presented as the primary instrument.
- Optional **second city** — one elsewhere place pinned beneath the face, searchable.
- Full-bleed starfield atmosphere; the instrument floats, scale-to-fit.
- Installable PWA; works offline once cached.
- Local-first: on-device, **zero runtime network**.

## Stack

React 18 · Vite · TypeScript · vite-plugin-pwa (Workbox).

## Develop

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc -b && vite build
npm run preview   # serves the production bundle on :4275
npm run test
```

## Project layout

```
src/
  faces/         # watch faces (Clock, Orbit, …)
  components/    # PlacesView (second-city search), Settings, shared UI
  store/         # settings + second-city store (persisted)
public/          # PWA manifest + icons
```

## Related

uptyme is one of three axes of codereimagine:

- **[bewthr](https://github.com/codereimagine/bewthr)** — continuum (weather)
- **uptyme** — time
- **[starnav](https://github.com/codereimagine/starnav)** — space

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
