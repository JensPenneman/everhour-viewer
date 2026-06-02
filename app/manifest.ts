import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes the viewer installable and lets it open
 * standalone, including with no network (the service worker serves the
 * precached shell).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Everhour viewer",
    short_name: "Everhour",
    description: "Live Everhour tracker + timesheet viewer — local, bring-your-own-key.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    lang: "nl",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "maskable" },
    ],
  };
}
