import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    base: env.GITHUB_PAGES === 'true' ? '/task-manager/' : '/',
    plugins: [react()],
    test: {
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      environment: 'jsdom',
      environmentOptions: { jsdom: { url: 'http://localhost/' } },
      setupFiles: './src/test-setup.ts',
      pool: 'forks',
      maxWorkers: 1,
      fileParallelism: false,
    },
  };
});
