import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "@/app": resolve(__dirname, "./app"),
      "@/components": resolve(__dirname, "./components"),
      "@/hooks": resolve(__dirname, "./hooks"),
      "@/lib": resolve(__dirname, "./lib"),
      "@/server": resolve(__dirname, "./server"),
      // `server-only` is a build-time barrier from Next; in unit tests it's a no-op.
      "server-only": resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules", ".next"],
    environment: "node",
    globals: false,
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "server/**/*.ts", "hooks/**/*.ts"],
      exclude: ["**/index.ts", "**/types.ts", "**/*.test.ts"],
      reporter: ["text", "html"],
    },
  },
});
