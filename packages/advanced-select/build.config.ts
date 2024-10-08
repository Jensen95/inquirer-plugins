import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: ['src/index'],
  outDir: 'dist',
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
