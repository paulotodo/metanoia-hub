import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["__tests__/**/*.spec.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    css: true,
  },
});
