import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Capacitor 빌드 시: CAPACITOR=true npm run build
// GitHub Pages 빌드 시: 기본값
export default defineConfig(({ command }) => {
  const isProd = command === 'build'
  return {
    plugins: [react()],
    base: process.env.CAPACITOR ? './' : '/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      minify: 'esbuild',
    },
    // 프로덕션 빌드에서 console.* / debugger 제거 (보안 + 번들 크기 절감)
    esbuild: isProd
      ? ({ drop: ['console', 'debugger'] } as Record<string, unknown>)
      : undefined,
  }
})
