import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], test: { include: ['src/**/*.{test,spec}.{ts,tsx}'], environment: 'jsdom', environmentOptions: { jsdom: { url: 'http://localhost/' } }, setupFiles: './src/test-setup.ts', pool: 'forks', maxWorkers: 1, fileParallelism: false } });
