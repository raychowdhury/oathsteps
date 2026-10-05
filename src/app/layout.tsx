import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppRoot } from "@/components/AppRoot";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "OathSteps", template: "%s · OathSteps" },
  description: "US Citizenship Prep. Practice. Prepare. Track your journey.",
  applicationName: "OathSteps",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "OathSteps", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AppRoot>{children}</AppRoot>
      </body>
    </html>
  );
}
