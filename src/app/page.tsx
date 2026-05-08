import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import CommodityMarketHeatmap from "@/components/CommodityMarketHeatmap";
import HomeCommodityPreview from "@/components/HomeCommodityPreview";
import { loadMapHousePosts } from "@/lib/instagram";
import InstagramOauthBridge from "./InstagramOauthBridge";

export const metadata: Metadata = {
  title: "MapHouse | Geography x Finance x Strategy",
  description:
    "MapHouse is a map-first platform for exploring commodities, financial markets, and global industry change.",
  openGraph: {
    title: "MapHouse | Geography x Finance x Strategy",
    description:
      "Use maps to explore markets and industries. Enter Interactive Map or read the latest analysis.",
    images: [{ url: "/maphouse-logo.png" }],
  },
};

export default async function Home() {
  const postResult = await loadMapHousePosts(8);
  const latestPosts = postResult.posts.slice(0, 4);

  return (
    <div className="maphouse-shell min-h-screen px-6 py-8 md:px-10">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <Suspense fallback={null}>
          <InstagramOauthBridge />
        </Suspense>

        <header className="paper-card flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/maphouse-logo.png"
              alt="MapHouse logo"
              width={38}
              height={38}
              className="rounded-full border border-[var(--line)] bg-white/70"
            />
            <span className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">maphouse_</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <Link href="/map" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2 hover:bg-white">
              Interactive Map
            </Link>
            <Link href="/vessels" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2 hover:bg-white">
              Vessel Map
            </Link>
            <Link href="/topics" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2 hover:bg-white">
              Latest Analysis
            </Link>
            <Link href="/about" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2 hover:bg-white">
              About
            </Link>
          </nav>
        </header>

        <section className="paper-card p-7 md:p-10">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">MapHouse / Home</p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-tight md:text-6xl">
            兩個入口，快速理解全球市場
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-[var(--muted)]">
            先看互動地圖掌握全局，再讀最新分析建立觀點。MapHouse 把地理、財金與產業研究整合成可探索的內容平台。
          </p>
        </section>

        <CommodityMarketHeatmap />

        <section className="grid gap-5 md:grid-cols-[1.05fr,0.95fr]">
          <article className="paper-card overflow-hidden p-7 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_44px_rgb(10_21_38_/_14%)] md:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">01</p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-5xl leading-none">Interactive Map</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              以地圖看懂商品產區與貿易重心。這裡可先切換所有商品做快速預覽，進入後再看完整互動分析。
            </p>
            <div className="mt-4">
              <HomeCommodityPreview />
            </div>
            <Link
              href="/map"
              className="mt-5 inline-flex rounded-full bg-[var(--brand-ink)] px-5 py-2.5 text-sm text-white transition hover:opacity-90"
            >
              進入 Interactive Map
            </Link>
          </article>

          <article className="paper-card p-7 md:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">02</p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-4xl">Latest Analysis</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              最新圖文會同步整理成可閱讀文章，包含重點結論、資料來源與延伸閱讀。
            </p>

            <div className="mt-5 space-y-3">
              {latestPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/topics/${encodeURIComponent(post.id)}`}
                  className="block rounded-xl border border-[var(--line)] bg-white/65 px-4 py-3 hover:bg-white"
                >
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    {post.category} · {post.region}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{post.title}</p>
                </Link>
              ))}
            </div>

            <div className="mt-6">
              <Link href="/topics" className="rounded-full bg-[var(--brand-ink)] px-5 py-2.5 text-sm text-white">
                看最新分析
              </Link>
            </div>
          </article>
        </section>

        <section className="paper-card grid gap-4 p-7 md:grid-cols-[0.8fr,1.2fr] md:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">03 / Vessel Map</p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-4xl">Shipping Intelligence</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              船舶資訊獨立成一頁，避免和商品地圖混在一起。先用 AIS-ready sample 展示點位、船型、目的港與 ETA，未來可接 live AIS。
            </p>
          </div>
          <div className="flex items-end justify-start md:justify-end">
            <Link href="/vessels" className="rounded-full bg-[var(--brand-ink)] px-5 py-2.5 text-sm text-white transition hover:opacity-90">
              進入 Vessel Map
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
