/**
 * Pure URL ↔ view-state mapping for the viewer.
 *
 * The app is a single client surface with no server data, but the active
 * view is reflected in the address bar so weeks and day-details are
 * deep-linkable, shareable, and survive refresh / back-forward. All routing
 * is path-based and served by the optional catch-all route, so any of these
 * paths resolves to the viewer shell:
 *
 *   /                         → home (welcome, or the latest week once synced)
 *   /profile                  → profile detail
 *   /week/2026-W23            → that week
 *   /week/2026-W23/2026-06-01 → that week's day-detail
 */

export type ViewerRoute =
  | { readonly view: "home" }
  | { readonly view: "profile" }
  | { readonly view: "week"; readonly isoWeek: string; readonly date: string | null };

const ISO_WEEK = /^\d{4}-W\d{2}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a pathname into the view it should render. Unknown paths → home. */
export function parseRoute(pathname: string): ViewerRoute {
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return { view: "home" };
  if (segs[0] === "profile") return { view: "profile" };
  if (segs[0] === "week" && segs[1] && ISO_WEEK.test(segs[1])) {
    const date = segs[2] && ISO_DATE.test(segs[2]) ? segs[2] : null;
    return { view: "week", isoWeek: segs[1], date };
  }
  return { view: "home" };
}

/**
 * Navigation depth, used to pick a forward / back / sibling view-transition
 * direction: home (0) → week|profile (1) → day (2).
 */
export function routeDepth(route: ViewerRoute): number {
  if (route.view === "home") return 0;
  if (route.view === "profile") return 1;
  return route.date ? 2 : 1;
}

export const HOME_HREF = "/";
export const PROFILE_HREF = "/profile";

export function weekHref(isoWeek: string): string {
  return `/week/${isoWeek}`;
}

export function dayHref(isoWeek: string, date: string): string {
  return `/week/${isoWeek}/${date}`;
}
