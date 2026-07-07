/* eslint-disable @typescript-eslint/no-require-imports */
/** @type {import("jest").Config} */
const path = require("node:path")

module.exports = {
  testEnvironment: "node",
  /** Each file gets a clean module tree so e.g. `health` vs `v1` can use different mocks. */
  resetModules: true,
  roots: [path.join(__dirname, "tests")],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": path.join(__dirname, "$1"),
    "^files-sdk$": path.join(__dirname, "node_modules/files-sdk/dist/index.js"),
    "^files-sdk/(.*)$": path.join(
      __dirname,
      "node_modules/files-sdk/dist/$1/index.js"
    ),
  },
  transform: {
    "^.+\\.[tj]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: false },
          target: "es2022",
        },
        module: { type: "commonjs" },
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!files-sdk|@vercel/blob)/"],
  setupFilesAfterEnv: [path.join(__dirname, "tests", "setup.ts")],
}
