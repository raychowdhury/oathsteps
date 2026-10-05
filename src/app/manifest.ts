import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OathSteps: US Citizenship Prep",
    short_name: "OathSteps",
    description: "Practice. Prepare. Track your journey.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7FAF9",
    theme_color: "#17324B",
    lang: "en",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
