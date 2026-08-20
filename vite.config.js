import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'passo-a-passo-icon-v20260820.svg',
        'passo-a-passo-icon-180-v20260820.png',
        'passo-a-passo-icon-192-v20260820.png',
        'passo-a-passo-icon-512-v20260820.png',
      ],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        id: '/?source=pwa-v20260820',
        name: 'Passo a Passo',
        short_name: 'Passo a Passo',
        description: 'Organizador diário',
        lang: 'pt-BR',
        theme_color: '#FAF9F6',
        background_color: '#FAF9F6',
        display: 'standalone',
        icons: [
          {
            src: 'passo-a-passo-icon-v20260820.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'passo-a-passo-icon-192-v20260820.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'passo-a-passo-icon-512-v20260820.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
