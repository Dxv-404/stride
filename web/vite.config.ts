import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: [
      'three',
      'three/examples/jsm/loaders/GLTFLoader.js',
      'three/examples/jsm/loaders/FontLoader.js',
      'three/examples/jsm/geometries/TextGeometry.js',
      '@react-three/fiber',
      'tone',
      'recharts',
      'pixi.js',
      'p2',
      'framer-motion',
      'gsap',
      'gsap/ScrollTrigger',
      'lenis',
    ],
  },
})
