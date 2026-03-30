/**
 * Root-level Jest config for the monorepo.
 *
 * All test files in `apps/backend/` are managed by their own Jest config
 * (ts-jest + tsconfig.test.json) and should be run from within that workspace.
 * Running `npx jest` from the monorepo root should only handle packages/shared/
 * (or nothing if no root-level tests exist yet).
 */
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'apps/backend/tsconfig.test.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Skip all apps — they have their own Jest configs
  testPathIgnorePatterns: ['/node_modules/', '/apps/', '/dist/'],
  passWithNoTests: true,
};

export default config;
