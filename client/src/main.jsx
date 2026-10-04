import React, { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { initTheme } from './config/themeConfig';
import ErrorBoundary from './components/ErrorBoundary';

// Initialize mobile status bar, theme-color and color scheme immediately
initTheme();

function DismissBootstrapLoader() {
  useEffect(() => {
    const loader = document.getElementById('app-bootstrap-loader');
    if (!loader) return undefined;

    // Wait for React's first committed frame, then cross-fade the HTML shell.
    // This avoids exposing an empty #root while a route or session is resolving.
    const frame = requestAnimationFrame(() => {
      loader.classList.add('app-ready');
    });
    const removal = window.setTimeout(() => loader.remove(), 260);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(removal);
    };
  }, []);

  return null;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <DismissBootstrapLoader />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

