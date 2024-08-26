import {isAbsolute, resolve} from "path";
import {defineConfig} from "vite";
import dts from "vite-plugin-dts";

export default defineConfig(({mode}) => {
  switch (mode) {
    case "development":
      return {
        plugins: [dts()],
        css: {},
        build: {
          outDir: "lib",
          watch: {},
          lib: {
            entry: resolve(__dirname, "src/index.ts"),
            formats: ["es"],
            fileName: "index"
          },
          rollupOptions: {
            external: (id) => !(isAbsolute(id) || id.startsWith("."))
          },
          minify: false,
          sourcemap: true
        }
      };
    case "lib":
      return {
        mode: "production",
        plugins: [dts()],
        build: {
          outDir: "lib",
          lib: {
            entry: resolve(__dirname, "src/index.ts"),
            formats: ["es"],
            fileName: "index"
          },
          rollupOptions: {
            external: (id) => !(isAbsolute(id) || id.startsWith("."))
          }
        }
      };
    case "dist":
      return {
        mode: "production",
        build: {
          outDir: "dist",
          lib: {
            entry: resolve(__dirname, "src/index.ts"),
            formats: ["umd"],
            fileName: () => "utils.js",
            name: "lucilor.utils"
          }
        }
      };
    default:
      return {};
  }
});
