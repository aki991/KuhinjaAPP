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
      ],
      manifest: {
        name: "Kuhinja Kalkulator",
        short_name: "Kuhinja",
        description: "Kalkulator kuhinja po meri",
        lang: "sr-Latn",
        theme_color: "#164A75",
        background_color: "#f7f9fc",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
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
