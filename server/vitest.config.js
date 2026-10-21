import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        environment: "node",
        setupFiles: ["./tests/setup.js"],
        include: ["tests/**/*.test.js"],
        // the first run downloads a MongoDB binary for mongodb-memory-server
        testTimeout: 30000,
        hookTimeout: 120000,
        clearMocks: true,
    },
})
