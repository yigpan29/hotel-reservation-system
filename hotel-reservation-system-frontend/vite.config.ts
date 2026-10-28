/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true },
  server: { proxy: { '/api': { target: loadEnv(mode, '.', '').API_PROXY_TARGET || 'http://127.0.0.1:3000', changeOrigin: true } } },
}))
