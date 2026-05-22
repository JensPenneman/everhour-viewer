// No-op replacement for the `server-only` package during unit tests.
// In production this is enforced by Next.js's bundler; pure-Node tests don't
// have that bundler, and using the real package throws on import.
export {};
