import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: { default: "OathSteps", template: "%s · OathSteps" },
  description: "US Citizenship Prep. Practice. Prepare. Track your journey.",
  applicationName: "OathSteps",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "OathSteps", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#17324B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
