import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    // Optimize for 3G - fewer chunks, less HTTP requests
    rollupOptions: {
      output: {
        manualChunks: {
          // Group React into one chunk (critical path)
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Group ALL Firebase into 2 chunks instead of 4 (reduce requests)
          'firebase-core': ['firebase/app', 'firebase/auth'],
          'firebase-data': ['firebase/firestore', 'firebase/database'],
          // Group media libraries
          'media': ['socket.io-client'],
        },
        // Optimize chunk sizes for 3G (reduce request count)
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 2000,
    sourcemap: false,
    // Inline more assets to reduce HTTP requests
    assetsInlineLimit: 10240, // 10kb - fewer requests more important than size on 3G
    // Disable CSS code splitting to reduce requests
    cssCodeSplit: false,
    minify: 'esbuild',
    target: 'es2015',
  },
  // Optimize dependencies - only pre-bundle critical ones
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
    ],
    exclude: [
      '@firebase/app',
      'firebase/firestore',
      'firebase/database',
    ],
  },
})