import { readFileSync } from 'node:fs';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// The fake browser has no manifest; give it the real package version.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
Object.assign(fakeBrowser.runtime, {
  getManifest: () => ({ manifest_version: 3, name: 'Capitol Tape', version }),
});
