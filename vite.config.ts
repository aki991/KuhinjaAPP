import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
        "fonts/Arial.ttf",
        "brand/*.png",
        "brand/*.svg",
      ],
      manifest: {
        name: "Kuhinja po meri",
        short_name: "Kuhinja",
        description: "Kalkulator kuhinja po meri",
        lang: "sr-Latn",
        theme_color: "#3c2417",
        background_color: "#fcf6ed",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "brand/logo.png",
            sizes: "1254x1254",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "brand/icon-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,svg,png,ttf}"],
        maximumFileSizeToCacheInBytes: 5_000_000,
      },
    }),
  ],
  server: { host: "0.0.0.0" },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/exceljs")) return "excel";
          if (id.includes("node_modules/jspdf")) return "pdf";
        },
      },
    },
  },
});
