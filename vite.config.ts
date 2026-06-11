/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    passWithNoTests: true,
    setupFiles: './src/setupTests.ts',
    environmentOptions: {
      jsdom: {
        url: 'https://example.com/',
      },
    },
  },
});
