import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  platform: 'node',
  format: ['esm'],
  dts: true,
  exports: true,
  clean: true,
  publint: true,
})
