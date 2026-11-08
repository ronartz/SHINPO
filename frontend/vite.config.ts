import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  build: {
    target: ['es2022', 'chrome100', 'safari15'],
  },

  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/ws': {
        target: apiProxyTarget,
        ws: true,
      },
    },
  },
})
