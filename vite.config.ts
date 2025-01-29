import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const cspHeader =
  "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.network; " +
    "style-src 'self' 'unsafe-inline' https://js.stripe.com https://m.stripe.network; " +
    "style-src-elem 'self' 'unsafe-inline' https://js.stripe.com https://m.stripe.network; " +
    "frame-src https://js.stripe.com https://hooks.stripe.com; " +
    "connect-src 'self' https://api.stripe.com https://m.stripe.network http://localhost:3000 ws://localhost:5173;"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // {
    //   name: 'vite-plugin-dev-csp',
    //   configureServer(server) {
    //     server.middlewares.use((req, res, next) => {
    //       res.setHeader('Content-Security-Policy', cspHeader);
    //       next(); // ✅ 必须调用 next()
    //     });
    //   }
    // }
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
