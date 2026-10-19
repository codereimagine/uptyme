<div align="center">

# ⌚ uptyme

### A clock that shows your time, wherever you are on Earth.

$\textcolor{#FFB04D}{\textsf{space}}$ · $\textcolor{#9FB4E0}{\textsf{time}}$ · $\textcolor{#FF5C7A}{\textsf{continuum}}$

*No accounts, no sign-up, no ads — and your exact location never leaves your device.*

**▶ Open it — [codereimagine.github.io/uptyme](https://codereimagine.github.io/uptyme/)**

<sub><b>CLOCK</b> — a classic dial</sub>
<p>
  <img src="docs/screenshots/clock-day.png" width="40%" alt="uptyme Clock face by day — local time on a classic dial" />
  <img src="docs/screenshots/clock-night.png" width="40%" alt="uptyme Clock face at night" />
</p>
<sub><b>ORBIT</b> — time wrapped around your horizon</sub>
<p>
  <img src="docs/screenshots/orbit-day.png" width="40%" alt="uptyme Orbit face by day — local time with the sky around the horizon" />
  <img src="docs/screenshots/orbit-night.png" width="40%" alt="uptyme Orbit face at night" />
</p>

<sub>By <b>Bert Peters</b> · the <b>time</b> axis of <a href="https://github.com/codereimagine">codereimagine</a></sub>

</div>

---

## 🕐 What is it?

uptyme is a clock. It shows your $\textcolor{#FFB04D}{\textsf{local time}}$, big and clear, anywhere on Earth — as a classic $\textcolor{#9FB4E0}{\textsf{Clock}}$ dial or an $\textcolor{#FF5C7A}{\textsf{Orbit}}$ ring, your pick. Pin a second city to keep another place's time beside it too.

No app store, no account, nothing to sign up for. Open the link and it works. Like it? Add it to your home screen like any other app.

## ✨ How we do things differently

Most apps want your account, your data, and your attention. Every codereimagine app is built $\textcolor{#9FB4E0}{\textsf{the other way round}}$:

- **Private by default** — no accounts, no tracking, nothing sold. Your exact location stays on *your* device.
- **No ads, no clutter** — nothing on the screen is trying to sell you something.
- **Yours to keep** — installs like an app and keeps working offline, even on a weak signal.
- **Fully open & free** — the whole thing is public (Apache-2.0). Nothing hidden.
- **Made to feel good** — an everyday tool should be beautiful, not just functional.

## 👀 What you can do with it

- **Tell the time, anywhere** — your local time, big and clear, as the headline.
- **Pick your face** — *Clock* (a classic dial) or *Orbit* (the time wrapped around your horizon). One tap.
- **Pin a second city** — keep another place's time beneath the face, always DST-correct.
- **Anywhere** — fast on phones and computers.

## 🛠️ Run or build it yourself (developers)

```bash
git clone https://github.com/codereimagine/uptyme.git
cd uptyme && npm install
npm run dev        # local dev server
npm run build      # production build → dist/
npm run preview    # preview the production build
npm test           # unit tests (incl. the Meeus/NOAA verification)
```

<details><summary><b>🔧 Under the hood</b></summary>

- **Sun & moon:** NOAA Solar Position Algorithm and Meeus methods, computed on-device in `src/engine.ts` — no servers, verified against the reference harness it ports from.
- **Location:** an **on/off switch** in Settings (on by default, same as bewthr) and a **target button** in the top bar. Tap it to locate: browser geolocation, **tap-gated** (never prompts on load); if GPS is blocked or never answers, it falls back to an approximate, city-level location from your network via [ipwho.is](https://ipwho.is) — the only location-related request uptyme makes (the lookup sees your IP, as any request does). GPS coordinates are never sent anywhere or reverse-geocoded; the last fix is saved on your device only. **Switching location off is the kill switch:** nothing is acquired or sent and the saved fix is wiped — pick a city with **+** instead. Greenwich (the zero meridian) is the fallback. Pinned cities are saved on your device only.
- **Timezones:** the device's `Intl.DateTimeFormat` for your place; searched cities carry their own IANA zone, so the readout stays DST-correct.
- **City search:** [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api), keyless — the only outbound call in the whole app, and only when you type it.
- **Stack:** React 18 · TypeScript · Vite · `vite-plugin-pwa` (Workbox) · Vitest.

</details>

## 🙌 Credits & thanks

Built with [Claude Code](https://claude.com/claude-code). $\textcolor{#FFB04D}{\textsf{Nothing here is hidden}}$ — uptyme stands on:

- **Geocoding** — [Open-Meteo](https://open-meteo.com) (CC BY 4.0).
- **Astronomy** — sun and moon from Jean Meeus, *Astronomical Algorithms*, and the NOAA Solar Position methods.
- **Emoji** — standard Unicode, drawn by your device.

## 📄 License

Apache-2.0 — see [LICENSE](LICENSE).
