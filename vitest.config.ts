import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each workspace package with a vitest.config.ts is a test project.
    projects: ['packages/*/vitest.config.ts', 'apps/*/vitest.config.ts'],
  },
});
