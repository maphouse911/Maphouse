"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import type { MapHouseContentPost } from "@/lib/instagram";
import type { TopicCategory } from "../data";

const filters: Array<{ key: "all" | TopicCategory; label: string }> = [
  { key: "all", label: "All" },
  { key: "commodity", label: "Commodity" },
  { key: "market", label: "Market" },
  { key: "industry", label: "Industry" },
  { key: "taiwan", label: "Taiwan" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "sports", label: "Sports" },
  { key: "instagram", label: "Instagram" },
];

type Props = {
  posts: MapHouseContentPost[];
  source: "live" | "public" | "fallback";
  error?: string;
};

export default function TopicsClient({ posts, source, error }: Props) {
  const [activeFilter, setActiveFilter] = useState<"all" | TopicCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [configStatus, setConfigStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [configMessage, setConfigMessage] = useState("");

  const visiblePosts = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return posts
      .filter((post) => (activeFilter === "all" ? true : post.category === activeFilter))
      .filter((post) => {
        if (!normalized) return true;
        const text = [post.title, post.summary, post.caption, post.region, post.category].join(" ").toLowerCase();
        return text.includes(normalized);
      });
  }, [activeFilter, posts, searchQuery]);
  const sourceLabel =
    source === "live" ? "Instagram API" : source === "public" ? "Instagram Public Sync（無授權）" : "Fallback Dataset";
  const isFallback = source === "fallback";
  const fallbackHint = !error
    ? "Instagram 同步暫時不可用，先顯示你整理好的精選內容。"
    : error.includes("INSTAGRAM_ACCESS_TOKEN") || error.includes("INSTAGRAM_IG_USER_ID")
      ? "尚未完成 Instagram 授權（缺少存取憑證）。按下方『連接 Instagram（自動設定）』即可恢復真實圖文。"
    : error.includes("Please wait")
      ? "Instagram 暫時限制讀取頻率，先顯示備援內容。稍後重新整理即可。"
        : error.includes("require_login")
          ? "Instagram 目前要求重新驗證，我們先顯示備援內容。"
          : "Instagram 同步暫時不穩定，已自動切換到備援內容。";

  useEffect(() => {
    void trackEvent("topics_view", { source, postCount: posts.length });
  }, [posts.length, source]);

  useEffect(() => {
    void trackEvent("topics_filter_change", {
      filter: activeFilter,
      hasQuery: Boolean(searchQuery.trim()),
      results: visiblePosts.length,
    });
  }, [activeFilter, searchQuery, visiblePosts.length]);

  async function saveAppSecret() {
    if (!appSecret.trim()) {
      setConfigStatus("error");
      setConfigMessage("請先貼上 App Secret");
      return;
    }

    setConfigStatus("saving");
    setConfigMessage("");

    try {
      const response = await fetch("/api/instagram/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appSecret: appSecret.trim() }),
      });
      const payload = (await response.json()) as { ok: boolean; message?: string; error?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "儲存 App Secret 失敗");
      }

      setConfigStatus("success");
      setConfigMessage(payload.message ?? "儲存成功");
      setAppSecret("");
    } catch (saveError) {
      setConfigStatus("error");
      setConfigMessage(saveError instanceof Error ? saveError.message : "儲存失敗");
    }
  }

  return (
    <div className="maphouse-shell min-h-screen px-6 py-8 md:px-10">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="paper-card flex items-center justify-between px-6 py-4">
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
          <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <Link href="/map" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2">
              Interactive Map
            </Link>
            <Link href="/about" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2">
              About
            </Link>
          </div>
        </header>

        <section className="paper-card p-7 md:p-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Works / Topics</p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl">Instagram Archive Library</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[var(--muted)]">
            <span>目前載入 {posts.length} 則內容</span>
            <span className="rounded-full border border-[var(--line)] bg-[var(--brand-gold-soft)] px-3 py-1 text-xs tracking-[0.12em]">
              {sourceLabel}
            </span>
          </div>

          {isFallback ? (
            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[linear-gradient(135deg,rgba(10,21,38,0.07),rgba(195,154,98,0.16))] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--brand-ink)]">Sync Status</p>
              <p className="mt-2 text-xl font-semibold">Instagram 同步暫時受限</p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{fallbackHint}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex rounded-full bg-[var(--brand-ink)] px-4 py-2 text-sm font-medium text-white"
                >
                  重新整理
                </button>
                <a
                  href="https://www.instagram.com/maphouse_/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-full border border-[var(--line)] px-4 py-2 text-sm hover:bg-white"
                >
                  前往 IG 主頁
                </a>
              </div>

              <details className="mt-4 rounded-xl border border-[var(--line)] bg-white/70 p-4">
                <summary className="cursor-pointer text-sm font-medium text-[var(--foreground)]">進階設定（可選）</summary>
                <p className="mt-3 text-xs text-[var(--muted)]">先貼上 App Secret（只在你本機保存）</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    value={appSecret}
                    onChange={(event) => setAppSecret(event.target.value)}
                    placeholder="在這裡貼上 App Secret"
                    className="min-w-[260px] flex-1 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm"
                  />
                  <button
                    onClick={saveAppSecret}
                    disabled={configStatus === "saving"}
                    className="rounded-full border border-[var(--line)] px-4 py-2 text-sm hover:bg-white disabled:opacity-50"
                  >
                    {configStatus === "saving" ? "儲存中..." : "儲存 Secret"}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href="/api/instagram/auth/start"
                    className="inline-flex rounded-full bg-[var(--brand-ink)] px-4 py-2 text-sm font-medium text-white"
                  >
                    連接 Instagram（自動設定）
                  </a>
                  <span className="text-xs text-[var(--muted)]">授權完成後，系統會自動將憑證寫入 `.env.local`。</span>
                </div>
                {configStatus === "success" || configStatus === "error" ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">{configMessage}</p>
                ) : null}
                {error ? (
                  <p className="mt-3 rounded-lg bg-[#f5efe3] px-3 py-2 text-xs leading-6 text-[var(--muted)]">
                    技術訊息: {error}
                  </p>
                ) : null}
              </details>
            </div>
          ) : null}
        </section>

        <section className="paper-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜尋主題、關鍵字、地區..."
              className="min-w-[240px] grow rounded-full border border-[var(--line)] bg-white/85 px-4 py-2 text-sm outline-none focus:border-[var(--olive)]"
            />
            {filters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`rounded-full border px-4 py-2 text-sm ${
                  activeFilter === filter.key
                    ? "border-[var(--brand-ink)] bg-[var(--brand-ink)] text-white"
                    : "border-[var(--line)] bg-white/65"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Results: {visiblePosts.length}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visiblePosts.map((post) => (
            <article key={post.id} className="paper-card overflow-hidden p-0">
              <Link href={`/topics/${encodeURIComponent(post.id)}`} className="block">
                {post.mediaUrl ? (
                  <div className="relative h-52 w-full">
                    <Image src={post.mediaUrl} alt={post.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-52 items-center justify-center bg-[#e6dece] text-sm text-[var(--muted)]">No image yet</div>
                )}
              </Link>

              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{post.category}</p>
                <h2 className="mt-2 text-xl font-semibold">
                  <Link href={`/topics/${encodeURIComponent(post.id)}`} className="hover:underline">
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {post.region} · {post.sourceYear}
                </p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{post.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/topics/${encodeURIComponent(post.id)}`}
                    className="inline-flex rounded-full bg-[var(--brand-ink)] px-4 py-2 text-sm text-white"
                  >
                    閱讀全文
                  </Link>
                  <a
                    className="inline-flex rounded-full border border-[var(--line)] px-4 py-2 text-sm hover:bg-white"
                    href={post.permalink}
                    onClick={() => {
                      void trackEvent("ig_outbound_click", { postId: post.id, from: "topics_grid" });
                    }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看 IG 原文
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
