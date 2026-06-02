/**
 * Optional catch-all so every viewer path (`/`, `/profile`, `/week/…`,
 * `/week/…/…`) resolves and survives a refresh. The UI itself is mounted once
 * in the root layout ({@link RootLayout}); this page renders nothing — the
 * active view is derived entirely from the URL inside the viewer.
 */
export default function Page() {
  return null;
}
