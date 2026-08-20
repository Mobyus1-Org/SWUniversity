import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // tests/tools holds agent tooling, not tests — see tests/tools/README.md. Tools are .mjs so
    // they are already invisible here; this keeps a stray .test.ts there out of the suite too.
    exclude: [...configDefaults.exclude, "tests/tools/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
