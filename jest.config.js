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
  // Map to their entry files so Jest's CJS resolver can find and mock them.
  moduleNameMapper: {
    "^@actions/core$": "<rootDir>/node_modules/@actions/core/lib/core.js",
    "^@actions/github$": "<rootDir>/node_modules/@actions/github/lib/github.js",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@actions/core|@actions/github|@actions/http-client|@octokit)/)",
  ],
  verbose: true,
};
