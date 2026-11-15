import { defineConfig } from 'vitest/config'
import path from 'path'

// Fondasi test suite Stemmagraph (S-15).
// Lingkungan node: seluruh test menguji modul murni tanpa DOM.
// Pemakaian vitest.config.ts (bukan menumpuk vite.config.ts) supaya
// konfigurasi build aplikasi tidak ikut di-load saat menjalankan test.
// Alias '@' dipertahankan agar modul src yang memakai import '@/'
// (mis. store) tetap bisa diimpor dari test.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
