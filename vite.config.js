import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin API in dev: the httpOnly refresh cookie then works without CORS
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
    },
  },
})
