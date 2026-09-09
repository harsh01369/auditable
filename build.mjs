/**
 * Bundle the CLI and the library entry point.
 *
 * TypeScript emits extensionless relative imports under bundler resolution,
 * which Node's ESM loader rejects outright. Bundling sidesteps that and also
 * means someone running this through npx downloads one file rather than a tree.
 * Runtime dependencies with native or browser payloads stay external.
 */
import { build } from 'esbuild';

const external = ['playwright', 'axe-core', '@axe-core/playwright', '@anthropic-ai/sdk', 'zod'];

await build({
  entryPoints: ['src/cli.ts'],
  outfile: 'dist/cli.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external,
  banner: { js: '#!/usr/bin/env node' },
  legalComments: 'none',
});

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external,
});

console.log('bundled dist/cli.js and dist/index.js');
