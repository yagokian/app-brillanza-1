import type { MetadataRoute } from "next";

// Installable on phones ("Add to Home Screen"). There is deliberately no service worker
// caching pages: personal data must not be stored offline on the device.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Brillanza Limpiezas",
    short_name: "Brillanza",
    description: "Gestión interna de Brillanza Limpiezas",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1E88E5",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
