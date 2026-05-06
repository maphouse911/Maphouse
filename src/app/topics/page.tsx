import type { Metadata } from "next";
import TopicsClient from "./TopicsClient";
import { loadMapHousePosts } from "@/lib/instagram";

export const metadata: Metadata = {
  title: "Topics Library | MapHouse",
  description:
    "Browse MapHouse analyses by category with search and filters. Explore commodities, markets, industry chains, and regional insights.",
  openGraph: {
    title: "Topics Library | MapHouse",
    description:
      "MapHouse topic archive with searchable analyses and map-driven insights across global markets.",
    images: [{ url: "/maphouse-logo.png" }],
  },
};

export default async function TopicsPage() {
  const result = await loadMapHousePosts(120);

  return <TopicsClient posts={result.posts} source={result.source} error={result.error} />;
}
