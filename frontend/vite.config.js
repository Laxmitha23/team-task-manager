import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://team-task-manager-1-llid.onrender.com',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})
