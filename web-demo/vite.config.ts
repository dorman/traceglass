import { defineConfig } from "vite";
import { resolve } from "node:path";

// Self-contained static demo. No analytics, no third-party CDN scripts.
export default defineConfig({
  root: ".",
  base: "./",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    headers: {
      "Content-Security-Policy": csp(),
    },
  },
  preview: {
    port: 4173,
    headers: {
      "Content-Security-Policy": csp(),
    },
  },
  resolve: {
    alias: {
      "@wasm": resolve(__dirname, "pkg"),
    },
  },
});

function csp(): string {
  // wasm-unsafe-eval is required for WebAssembly.compile / instantiate.
  // connect-src 'self' is required only to fetch the same-origin .wasm bytes
  // at startup (wasm-bindgen init). Log scanning itself never uses the network;
  // Playwright asserts no requests after load / during scan.
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
