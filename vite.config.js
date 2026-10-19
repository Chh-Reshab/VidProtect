import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Pages are split by route (see App.jsx); libraries get their own long-cached chunks, and the
    // icon set is one file instead of one tiny request per icon
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'icons', test: /node_modules[/]lucide-react/ },
            { name: 'react', test: /node_modules[/](react|react-dom|react-router|react-router-dom|scheduler)[/]/ },
          ],
        },
      },
    },
  },
  server: {
    // Same-origin API in dev: the httpOnly refresh cookie then works without CORS
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
    },
  },
})
