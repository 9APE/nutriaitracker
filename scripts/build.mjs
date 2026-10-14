import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modeFlagIndex = process.argv.indexOf("--mode");
const mode = modeFlagIndex >= 0 ? process.argv[modeFlagIndex + 1] : "production";

await build({
  configFile: false,
  root: repoRoot,
  mode,
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(repoRoot, "src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
});
