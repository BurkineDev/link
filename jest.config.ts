import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^server-only$": "<rootDir>/src/__mocks__/server-only.ts",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "esnext",
          moduleResolution: "bundler",
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          jsx: "react-jsx",
          target: "ES2020",
          paths: { "@/*": ["./src/*"] },
        },
      },
    ],
  },
  testMatch: ["**/__tests__/**/*.test.(ts|tsx)"],
  // Les arbres de travail parallèles (.claude/worktrees) et le build Next
  // contiennent une copie des sources : ne pas les compter deux fois.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/.claude/", "<rootDir>/.next/"],
  modulePathIgnorePatterns: ["<rootDir>/.claude/", "<rootDir>/.next/"],
};

export default config;
