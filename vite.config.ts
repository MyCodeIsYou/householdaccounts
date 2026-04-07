import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Capacitor 빌드 시: CAPACITOR=true npm run build
  // GitHub Pages 빌드 시: 기본값
  base: process.env.CAPACITOR ? './' : '/householdaccounts/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
})
