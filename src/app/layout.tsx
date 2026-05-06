import type { Metadata } from "next";
import "./globals.css";
import TrafficSourceTracker from "@/components/TrafficSourceTracker";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "MapHouse",
    template: "%s",
  },
  metadataBase: new URL(siteUrl),
  description:
    "MapHouse is a map-first platform for exploring commodities, markets, and global change.",
  openGraph: {
    title: "MapHouse",
    description:
      "MapHouse is a map-first platform for exploring commodities, markets, and global change.",
    images: [{ url: "/maphouse-logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MapHouse",
    description:
      "MapHouse is a map-first platform for exploring commodities, markets, and global change.",
    images: ["/maphouse-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <TrafficSourceTracker />
        {children}
      </body>
    </html>
  );
}
