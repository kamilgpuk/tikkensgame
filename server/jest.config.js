/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^@ai-hype/shared$": "<rootDir>/../shared/src/index.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true, tsconfig: "./tsconfig.json", isolatedModules: true, diagnostics: false }],
  },
  setupFiles: ["<rootDir>/src/test-env.cjs"],
  testPathIgnorePatterns: ["<rootDir>/dist/"],
  forceExit: true,
  testTimeout: 15000,
};
