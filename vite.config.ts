import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: true, // This allows access from other devices
    cors: true
  },
  resolve: {
    alias: {
      'lucide-react': 'lucide-react'
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
