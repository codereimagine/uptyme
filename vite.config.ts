/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
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
    // geocoding search and the SW precache fetches).
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'node',
  },
});
