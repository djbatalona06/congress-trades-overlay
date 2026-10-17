import { execFileSync } from 'node:child_process';

// The site tests read the built pages in site/dist, so build them once before any test runs.
export default function setup() {
  execFileSync(process.execPath, ['scripts/build-site.mjs'], { stdio: 'pipe' });
}
