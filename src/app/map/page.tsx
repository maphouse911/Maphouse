import type { Metadata } from "next";
import MapClient from "./MapClient";

export const metadata: Metadata = {
  title: "Interactive Commodity Map | MapHouse",
  description:
    "Map-first commodity intelligence with compare mode. Explore production regions, price drivers, and risk factors across global markets.",
  openGraph: {
    title: "Interactive Commodity Map | MapHouse",
    description:
      "Compare global commodities through map-driven analysis: origins, supply chain, and volatility.",
    images: [{ url: "/maphouse-logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Interactive Commodity Map | MapHouse",
    description:
      "Compare global commodities through map-driven analysis: origins, supply chain, and volatility.",
    images: ["/maphouse-logo.png"],
  },
};

export default function MapPage() {
  return <MapClient />;
}
