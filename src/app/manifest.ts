import type { MetadataRoute } from "next";

// Lets phones install Brew Lab as an app that opens full screen at phone size.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brew Lab",
    short_name: "Brew Lab",
    description: "Pick a favorite from the menu or build your own coffee, exactly how you like it.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf6f0",
    theme_color: "#faf6f0",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
