import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      '/sitemap.xml': {
        target: process.env.VITE_SERVER_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Insightly: AI-Powered App Review Intelligence',
        short_name: 'Insightly',
        description: 'Transform app reviews into actionable insights',
        theme_color: '#6366F1',
        icons: [
          {
            src: '/favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  build: {
    // No manual vendor chunk: bundling every dependency (Stripe, OpenAI,
    // Google Generative AI, Supabase, etc.) into one shared file forced
    // every route -- including the marketing homepage -- to download all
    // of it before first paint. Rollup's default per-entry code-splitting
    // already keeps route-only deps inside their own lazy-loaded chunk.
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
})
