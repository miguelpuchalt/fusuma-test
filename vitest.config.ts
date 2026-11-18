import { defineConfig } from 'vitest/config'

// Sin los plugins de TanStack Start ni de Nitro: los tests son de TypeScript puro.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
