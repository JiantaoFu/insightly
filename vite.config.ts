import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
    react()
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
