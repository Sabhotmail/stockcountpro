import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StockCount Pro",
    short_name: "StockCount",
    description:
      "ระบบนับสต็อกภายใน — Internal warehouse stock counting",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    lang: "th",
    theme_color: "#16a34a",
    background_color: "#ffffff",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
      {
        src: "/icons/maskable-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
