import { defineConfig } from 'vitest/config';

// Live checks against the official sites. Run with `npm run verify:influence`; never part of `npm test`.
export default defineConfig({
  test: {
    include: ['tests/live/*.live.ts'],
    testTimeout: 15 * 60 * 1000,
  },
});
