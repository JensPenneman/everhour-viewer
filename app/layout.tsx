import type { Metadata } from "next";
import { Viewer } from "@/components/viewer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Everhour viewer",
  description: "Local viewer for Everhour timesheet backups",
};

/**
 * The viewer is mounted once here in the persistent root layout (not in the
 * page) so client-side navigation between `/`, `/week/…` and `/profile`
 * re-renders it with the new URL rather than remounting it — no re-hydration
 * flash, no provider refetch, no lost dialog state. The matched page (the
 * optional catch-all) renders nothing; the URL alone drives the view.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Viewer />
        {children}
      </body>
    </html>
  );
}
