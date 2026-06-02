import type { MetadataRoute } from "next";

/**
 * A valid `/robots.txt`. Without it the optional catch-all would serve the
 * app's HTML at that path, which Lighthouse flags as an invalid robots file.
 * It's a personal, local-first tool, but the page stays indexable so no
 * "blocked from indexing" SEO penalty applies either.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
  };
}
