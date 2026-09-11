/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  testMatch: ["**/*.test.ts"],
};
