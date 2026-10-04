import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certPath = path.resolve(__dirname, '../server/certs/server.crt');
const keyPath = path.resolve(__dirname, '../server/certs/server.key');

const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const platformEnv = loadEnv(mode, path.resolve(__dirname, '..'), 'VITE_');

  return {
  plugins: [react(), tailwindcss()],
  define: Object.fromEntries(
    Object.entries(platformEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
  ),
  server: {
    host: true, // Exposes on all addresses (localhost, 127.0.0.1, 0.0.0.0, LAN)
    port: 5173,
    watch: {
      usePolling: true,
      interval: 150
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/graphql': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/upload': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  };
});
