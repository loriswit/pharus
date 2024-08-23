import { defineConfig } from "vite"
import { resolve } from "node:path"

export default defineConfig({
    root: "assets",
    build: {
        target: "esnext",
        outDir: "../build/assets",
        emptyOutDir: true,
        rollupOptions: {
            output: {
                assetFileNames: () => "[name]-[hash][extname]",
                entryFileNames: () => "[name]-[hash].js",
            },
            input: resolve(import.meta.dirname, "assets", "plot.html"),
        },
    },
})
