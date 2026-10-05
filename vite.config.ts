/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH lets the same build work on GitHub Pages (/repo-name/), Vercel and Netlify (/).
// The GitHub Pages workflow sets it automatically. Locally it defaults to "/".
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      // Installed app on iPhone (Home Screen), Mac (Safari "Add to Dock" / Chrome "Install") and Android.
      manifest: {
        id: base,
        name: 'Kiran Planner',
        short_name: 'Planner',
        description: 'Personal daily schedule, study, gym and progress tracker.',
        lang: 'en',
        dir: 'ltr',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        // "any": portrait on iPhone, resizable windows on Mac and iPad.
        orientation: 'any',
        start_url: base,
        scope: base,
        categories: ['productivity', 'education', 'lifestyle'],
        // Chrome/Edge: reuse the open window when the app is launched again.
        launch_handler: { client_mode: ['navigate-existing', 'auto'] },
        prefer_related_applications: false,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press (Android) / right-click (Dock, taskbar) the app icon. Routes are hash based.
        shortcuts: [
          {
            name: 'Today',
            short_name: 'Today',
            description: 'Today’s schedule and progress',
            url: `${base}#/`,
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Study timer',
            short_name: 'Study',
            description: 'Start a study session',
            url: `${base}#/study`,
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Calendar',
            short_name: 'Calendar',
            description: 'Semester dates and important days',
            url: `${base}#/calendar`,
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
