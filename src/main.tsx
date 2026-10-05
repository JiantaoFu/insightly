import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { preloadRoute } from './App.tsx';
import './index.css';

// Load the current route's lazy chunk first, then render once. Until then
// #root keeps showing the static skeleton / prerendered page from the server.
preloadRoute(window.location.pathname).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
