module.exports = {
  clearMocks: true,
  moduleFileExtensions: ["js", "ts"],
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  testRunner: "jest-circus/runner",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  // @actions/core v3+ and @actions/github v9+ are ESM-only packages.
  // Both moduleNameMapper AND transformIgnorePatterns are required together:
  // - moduleNameMapper: bypasses Node's "exports" field so Jest's CJS resolver can find the files
  // - transformIgnorePatterns: allows Jest to transform the ESM syntax (import/export) to CJS
  // Removing either one will break tests.
  moduleNameMapper: {
    "^@actions/core$": "<rootDir>/node_modules/@actions/core/lib/core.js",
    "^@actions/github$": "<rootDir>/node_modules/@actions/github/lib/github.js",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@actions/core|@actions/github)/)",
  ],
  verbose: true,
};
