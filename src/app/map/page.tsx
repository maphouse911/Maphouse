"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { commodityThemes, type CommodityKey } from "../data";

export default function MapPage() {
  const [themeKey, setThemeKey] = useState<CommodityKey>("soybean");
  const [activeRegion, setActiveRegion] = useState("south-america");

  const currentTheme = useMemo(
    () => commodityThemes.find((item) => item.key === themeKey) ?? commodityThemes[0],
    [themeKey],
  );

  const selected = currentTheme.insights.find((item) => item.id === activeRegion) ?? currentTheme.insights[0];

  return (
    <div className="maphouse-shell min-h-screen px-6 py-8 md:px-10">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="paper-card flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="font-[family-name:var(--font-display)] text-3xl font-semibold">
            maphouse_
          </Link>
          <div className="flex gap-3 text-sm text-[var(--muted)]">
            <Link href="/">Home</Link>
            <Link href="/about">About</Link>
            <Link href="/topics">Topics</Link>
          </div>
        </header>

        <section className="paper-card p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Interactive Map</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl">Commodity Origins & Price Context</h1>
          <p className="mt-2 text-[var(--muted)]">點擊區域卡片，查看產地角色、關鍵指標與價格敘事。</p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr,320px]">
          <article className="paper-card p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {commodityThemes.map((theme) => (
                <button
                  key={theme.key}
                  onClick={() => {
                    setThemeKey(theme.key);
                    setActiveRegion(theme.insights[0]?.id ?? "south-america");
                  }}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    theme.key === themeKey ? "border-[var(--foreground)] bg-[var(--foreground)] text-white" : "border-[var(--line)]"
                  }`}
                >
                  {theme.title}
                </button>
              ))}
            </div>

            <div className="paper-card bg-white/70 p-4">
              <h2 className="font-semibold">{currentTheme.subtitle}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {currentTheme.insights.map((insight) => (
                  <button
                    key={insight.id}
                    onClick={() => setActiveRegion(insight.id)}
                    style={{ borderColor: insight.color }}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected.id === insight.id ? "shadow-md" : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)]">{insight.role}</p>
                    <p className="mt-2 text-lg font-semibold">{insight.region}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{insight.metric}</p>
                  </button>
                ))}
              </div>
            </div>
          </article>

          <aside className="paper-card h-fit p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Insight Panel</p>
            <h3 className="mt-2 text-2xl font-semibold">{selected.region}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{selected.role}</p>
            <p className="mt-4 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm">{selected.metric}</p>
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{selected.blurb}</p>
            <div className="mt-4 rounded-lg px-3 py-2 text-sm" style={{ background: `${selected.color}1A` }}>
              <span className="font-semibold">Why it matters: </span>
              {selected.why}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

