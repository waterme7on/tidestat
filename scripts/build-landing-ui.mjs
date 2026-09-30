import * as esbuild from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
await esbuild.build({
  entryPoints: [root + 'landing/mount.jsx'],
  bundle: true,
  format: 'esm',
  outfile: root + 'landing-ui.js',
  jsx: 'automatic',
  minify: true,
  target: 'es2022',
  legalComments: 'none',
});

const fonts = [
  ['@fontsource/fraunces/files/fraunces-latin-500-normal.woff2', 'fraunces-500.woff2'],
  ['@fontsource/fraunces/files/fraunces-latin-600-normal.woff2', 'fraunces-600.woff2'],
  ['@fontsource/outfit/files/outfit-latin-400-normal.woff2', 'outfit-400.woff2'],
  ['@fontsource/outfit/files/outfit-latin-500-normal.woff2', 'outfit-500.woff2'],
  ['@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', 'ibm-plex-mono-400.woff2'],
];
await mkdir(root + 'assets/fonts', { recursive: true });
for (const [from, to] of fonts) await cp(root + 'node_modules/' + from, root + 'assets/fonts/' + to);
console.log('Built landing-ui.js and copied landing fonts.');
