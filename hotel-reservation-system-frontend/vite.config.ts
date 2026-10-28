/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true },
  // El contenedor de desarrollo monta el código desde el host: sin sondeo, Vite no recibe los
  // avisos de cambio y sigue sirviendo el módulo anterior. Solo afecta al servidor de desarrollo.
  server: {
    watch: { usePolling: true, interval: 300 },
    proxy: { '/api': { target: loadEnv(mode, '.', '').API_PROXY_TARGET || 'http://127.0.0.1:3000', changeOrigin: true } },
  },
}))
