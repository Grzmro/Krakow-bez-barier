import { defineConfig } from "vitest/config";

// The database tests share one scratch database, so test files run one after another.
export default defineConfig({ test: { fileParallelism: false } });
