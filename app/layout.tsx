import type { Metadata } from "next";
import { AppShell } from "@/shared/components";
import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Everhour viewer",
  description: "Local viewer for Everhour timesheet backups",
};

/**
 * The persistent app shell wraps every page here in the root layout, so
 * client-side navigation between the route segments (`/`, `/week/…`,
 * `/profile`) swaps only the page in `<main>` — the header, sidebar, dialogs,
 * and provider state stay mounted (no re-hydration flash, no refetch, no lost
 * dialog state). Each route segment owns its own page.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
