import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    globalSetup: ['tests/site-build.setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
