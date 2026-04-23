import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local-only development server
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    host: 'localhost',
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      }
    }
  },
})
