import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
  outDir: 'dist',
  entries: ['src/index'],
})
