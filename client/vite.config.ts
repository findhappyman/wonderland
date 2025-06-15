import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    host: true
  },
  build: {
    // Optimize for cloud deployment
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    // Pre-bundle dependencies to avoid issues
    include: ['react', 'react-dom', 'socket.io-client']
  }
}) 