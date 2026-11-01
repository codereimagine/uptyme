/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

// Content-Security-Policy, the local-first lock enforced by the browser: only this
// origin, plus the two network paths below (city search, Auto-mode location fallback).
// Build only — in dev, Vite injects CSS as inline <style> tags that this would block.
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'", "font-src 'self'", "img-src 'self'",
  "connect-src 'self' https://geocoding-api.open-meteo.com https://ipwho.is",
  "manifest-src 'self'", "worker-src 'self'", "base-uri 'self'", "form-action 'none'", "object-src 'none'",
].join('; ');
const csp = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) => html.replace(/<meta charset="UTF-8">/, `$&\n<meta http-equiv="Content-Security-Policy" content="${CSP}">`),
});

export default defineConfig({
  plugins: [
    csp(),
    react(),
    VitePWA({
      // 'prompt' = the new SW installs but waits for the user to confirm
      // before activating. Pairs with the in-app UpdateBanner + the
      // Settings "Check for updates" button so the user always controls
      // when to apply an update. Same as bewthr.
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
      manifest: {
        name: 'uptyme — time axis of codereimagine',
        short_name: 'uptyme',
        description: 'Local-first celestial time instrument',
        theme_color: '#06060C',
        background_color: '#04040A',
        display: 'standalone',
        scope: './',
        start_url: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  base: './',
  preview: {
    // Quick cloudflared tunnels (trycloudflare.com) need to be allow-listed
    // here or vite preview returns "Blocked request" with a host error.
    // `true` allows any host — safe for local preview because the network
    // surface is opt-in (we're explicitly running a tunnel). Tighten to a
    // specific hostname if/when a named tunnel replaces the quick one.
    allowedHosts: true,
  },
  build: {
    // Strip the modulepreload polyfill — it ships a dead fetch() into the
    // bundle for legacy browsers we don't target, and the local-first lock
    // forbids any reachable network code path (other than the explicit
    // geocoding search, the Auto-mode location fallback in src/geo.ts, and the
    // SW precache fetches).
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'node',
  },
});
