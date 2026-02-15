import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Coverage disabled for now - can be enabled with @vitest/coverage-v8
    // coverage: {
    //   provider: 'v8',
    //   reporter: ['text', 'json', 'html'],
    //   exclude: [
    //     'node_modules/',
    //     'src/test/',
    //     '**/*.d.ts',
    //     '**/*.config.*',
    //     '**/mockData.ts',
    //     'dist/'
    //   ]
    // },
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'dist/',
        'functions/',
        'android/',
        'tools/',
        'scripts/'
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    },
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    // Coverage disabled for now - can be enabled with @vitest/coverage-v8
    // coverage: {
    //   provider: 'v8',
    //   reporter: ['text', 'json', 'html'],
    //   exclude: [
    //     'node_modules/',
    //     'src/test/',
    //     '**/*.d.ts',
    //     '**/*.config.*',
    //     '**/mockData.ts',
    //     'dist/'
    //   ]
    // }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
