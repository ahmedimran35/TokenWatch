import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/index.js',
  format: 'esm',
  external: ['fsevents', 'react', 'react-devtools-core', 'ink', 'ink-spinner', 'ink-table', '@tokenwatch/collector', '@tokenwatch/engine', '@tokenwatch/types'],
  sourcemap: true,
  loader: { '.tsx': 'tsx' },
})

console.log('Build complete')
