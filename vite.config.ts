import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { ManifestOptions } from 'vite-plugin-pwa'
import { translations } from './src/i18n/translations'
import { supportedLanguages } from './src/i18n/languages'

const manifest: Partial<ManifestOptions> = {
  id: '.', name: 'Flashcards Notes Deluxe PC Input PWA', short_name: 'PC Input PWA',
  description: 'PC browser input tool that creates ZIP/JSON/CSV files for the Android flashcards app.',
  theme_color: '#121c2a', background_color: '#0d1420', display: 'standalone',
  start_url: '.', scope: '.', lang: 'en', dir: 'ltr',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
  ],
}

const localizedManifests: Plugin = {
  name: 'localized-install-manifests', apply: 'build',
  generateBundle() {
    for (const { code } of supportedLanguages) {
      const text = translations[code]
      this.emitFile({ type: 'asset', fileName: `manifest-${code}.webmanifest`, source: JSON.stringify({
        ...manifest, name: text['window.title'], short_name: text['app.subtitle'], description: text['app.description'],
        lang: code, dir: ['ar', 'ur', 'fa'].includes(code) ? 'rtl' : 'ltr',
      }) })
    }
  },
}

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE ?? '/flashcards-pc-input/',
  plugins: [
    localizedManifests,
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      injectRegister: null,
      manifest,
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
      }
    })
  ],
})
