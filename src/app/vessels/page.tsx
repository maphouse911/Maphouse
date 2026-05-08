import type { Metadata } from "next";
import VesselMapClient from "./VesselMapClient";

export const metadata: Metadata = {
  title: "Vessel Map | MapHouse",
  description:
    "A dedicated AIS-ready vessel map for viewing global vessel positions, vessel type, speed, destination, ETA, and cargo inference notes.",
  openGraph: {
    title: "Vessel Map | MapHouse",
    description:
      "Explore an AIS-ready vessel map built for future live maritime data integration.",
    images: [{ url: "/maphouse-logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vessel Map | MapHouse",
    description:
      "Explore an AIS-ready vessel map built for future live maritime data integration.",
    images: ["/maphouse-logo.png"],
  },
};

export default function VesselsPage() {
  return <VesselMapClient />;
}
