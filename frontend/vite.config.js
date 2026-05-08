import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point xlsx to its self-contained browser UMD build — avoids Rolldown
      // choking on the CJS main entry which requires Node.js built-ins (fs, crypto)
      xlsx: 'xlsx/dist/xlsx.full.min.js',
    },
  },
  optimizeDeps: {
    include: ['xlsx'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
