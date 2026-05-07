"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { commodityProfiles, commoditySections, type CommodityKey } from "@/app/data";

type MarketCandle = {
  time: string;
  close: number;
  volume?: number;
};

type CandleResponse = {
  ok?: boolean;
  source?: string;
  upstreamSource?: string;
  symbol?: string;
  updatedAt?: string;
  candles?: MarketCandle[];
};

type HeatmapTile = {
  key: CommodityKey;
  zhName: string;
  enName: string;
  section: "agri" | "energy" | "metals";
  symbol: string;
  changePct: number | null;
  latest: number | null;
  volume: number | null;
  source: string;
  updatedAt: string | null;
  status: "live" | "fallback";
};

const LIQUIDITY_WEIGHT: Record<CommodityKey, number> = {
  oil: 10,
  brent: 9,
  gold: 9,
  naturalGas: 8,
  copper: 8,
  soybean: 7,
  corn: 7,
  wheat: 7,
  silver: 7,
  coffee: 5,
  sugar: 5,
  cotton: 4,
  soybeanOil: 4,
  cocoa: 4,
  aluminum: 4,
  nickel: 4,
  zinc: 3,
  lead: 2.6,
  tin: 2.4,
  lithium: 2.2,
  cobalt: 2,
  gallium: 1.4,
  germanium: 1.4,
};

const SECTION_TONE: Record<HeatmapTile["section"], string> = {
  agri: "農產品",
  energy: "能源",
  metals: "金屬",
};

function commoditySectionOf(key: CommodityKey): HeatmapTile["section"] {
  return commoditySections.find((section) => section.keys.includes(key))?.id ?? "agri";
}

function parseProfilePercent(value: string) {
  const parsed = Number.parseFloat(value.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercent(value: number | null) {
  if (value === null) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatVolume(value: number | null) {
  if (!value) return "liquidity tier";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function tileColor(changePct: number | null) {
  if (changePct === null) return "linear-gradient(135deg, rgb(126 149 110 / 42%), rgb(248 251 243 / 84%))";
  const intensity = Math.min(Math.abs(changePct) / 4, 1);
  if (changePct > 0) {
    return `linear-gradient(135deg, rgb(158 69 57 / ${0.35 + intensity * 0.5}), rgb(210 129 91 / ${0.18 + intensity * 0.35}))`;
  }
  if (changePct < 0) {
    return `linear-gradient(135deg, rgb(54 112 77 / ${0.36 + intensity * 0.48}), rgb(126 149 110 / ${0.18 + intensity * 0.34}))`;
  }
  return "linear-gradient(135deg, rgb(126 149 110 / 28%), rgb(248 251 243 / 88%))";
}

function sourceLabel(source: string | undefined, upstreamSource: string | undefined) {
  const resolved = source === "cache" || source === "cache-stale" ? upstreamSource : source;
  if (resolved === "stooq") return "Stooq";
  if (resolved === "yahoo") return "Yahoo";
  return "MapHouse profile";
}

async function loadTile(key: CommodityKey): Promise<HeatmapTile> {
  const profile = commodityProfiles[key];
  const section = commoditySectionOf(key);
  try {
    const response = await fetch(`/api/market/candles?commodity=${encodeURIComponent(key)}&range=1mo&interval=1d`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as CandleResponse;
    const candles = payload.candles?.filter((item) => Number.isFinite(item.close)) ?? [];
    const latest = candles[candles.length - 1] ?? null;
    const previous = candles[candles.length - 2] ?? null;
    const changePct = latest && previous && previous.close > 0 ? ((latest.close - previous.close) / previous.close) * 100 : null;

    if (response.ok && payload.ok && latest) {
      return {
        key,
        zhName: profile.zhName,
        enName: profile.enName,
        section,
        symbol: payload.symbol ?? profile.futuresSymbols[0] ?? "N/A",
        changePct,
        latest: latest.close,
        volume: latest.volume ?? null,
        source: sourceLabel(payload.source, payload.upstreamSource),
        updatedAt: payload.updatedAt ?? null,
        status: "live",
      };
    }
  } catch {
    // Fall through to profile fallback. Heatmap should never block the homepage.
  }

  return {
    key,
    zhName: profile.zhName,
    enName: profile.enName,
    section,
    symbol: profile.futuresSymbols[0] ?? "N/A",
    changePct: parseProfilePercent(profile.ytdChange),
    latest: null,
    volume: null,
    source: "MapHouse profile",
    updatedAt: null,
    status: "fallback",
  };
}

export default function CommodityMarketHeatmap() {
  const [tiles, setTiles] = useState<HeatmapTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHeatmap() {
      setLoading(true);
      const keys = commoditySections.flatMap((section) => section.keys);
      const nextTiles = await Promise.all(keys.map((key) => loadTile(key)));
      if (cancelled) return;
      setTiles(nextTiles);
      setUpdatedAt(new Date().toISOString());
      setLoading(false);
    }

    void loadHeatmap();
    return () => {
      cancelled = true;
    };
  }, []);

  const volumeMax = useMemo(() => {
    return Math.max(...tiles.map((tile) => tile.volume ?? 0), 0);
  }, [tiles]);

  const sortedTiles = useMemo(() => {
    return [...tiles].sort((a, b) => {
      const aSize = a.volume && volumeMax > 0 ? a.volume / volumeMax : LIQUIDITY_WEIGHT[a.key] / 10;
      const bSize = b.volume && volumeMax > 0 ? b.volume / volumeMax : LIQUIDITY_WEIGHT[b.key] / 10;
      return bSize - aSize;
    });
  }, [tiles, volumeMax]);

  const liveCount = tiles.filter((tile) => tile.status === "live").length;
  const positiveCount = tiles.filter((tile) => (tile.changePct ?? 0) > 0).length;
  const negativeCount = tiles.filter((tile) => (tile.changePct ?? 0) < 0).length;

  return (
    <section className="paper-card overflow-hidden p-7 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Commodity Heatmap</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-tight md:text-5xl">
            今日商品漲跌熱力圖
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            顏色代表當日漲跌幅，紅色為上漲、綠色為下跌；大小優先使用公開成交量，缺資料時改用 MapHouse
            流動性層級，避免把非標準商品硬拿來比較。
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-xs text-[var(--muted)]">
          <p>
            Live symbols <span className="font-semibold text-[var(--brand-ink)]">{liveCount}</span> / {tiles.length || 23}
          </p>
          <p className="mt-1">
            Up {positiveCount} · Down {negativeCount}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {loading && !sortedTiles.length
          ? Array.from({ length: 12 }, (_, index) => (
              <div
                key={`heatmap-loading-${index}`}
                className="min-h-[96px] flex-1 basis-[140px] animate-pulse rounded-2xl border border-[var(--line)] bg-white/55"
              />
            ))
          : sortedTiles.map((tile) => {
              const volumeWeight = tile.volume && volumeMax > 0 ? 1 + (tile.volume / volumeMax) * 2.9 : LIQUIDITY_WEIGHT[tile.key] / 3.2;
              const basis = `${Math.max(118, Math.min(270, 92 + volumeWeight * 52))}px`;
              const positive = (tile.changePct ?? 0) > 0;
              const negative = (tile.changePct ?? 0) < 0;
              return (
                <Link
                  key={tile.key}
                  href={`/map?commodity=${encodeURIComponent(tile.key)}`}
                  className="group relative min-h-[104px] overflow-hidden rounded-2xl border border-[rgb(255_255_255_/_58%)] p-4 text-white shadow-[0_14px_26px_rgb(10_21_38_/_12%)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_34px_rgb(10_21_38_/_18%)]"
                  style={{
                    flexGrow: volumeWeight,
                    flexBasis: basis,
                    background: tileColor(tile.changePct),
                  }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgb(255_255_255_/_30%),transparent_34%)] opacity-70" />
                  <div className="relative z-10 flex h-full flex-col justify-between gap-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] opacity-80">{SECTION_TONE[tile.section]}</p>
                        <h3 className="mt-1 text-2xl font-semibold leading-none text-white drop-shadow-sm">{tile.zhName}</h3>
                        <p className="mt-1 text-xs opacity-78">{tile.enName}</p>
                      </div>
                      <span className="rounded-full bg-[rgb(10_21_38_/_22%)] px-2 py-1 text-[10px] uppercase tracking-[0.12em]">
                        {tile.symbol}
                      </span>
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] opacity-75">Daily change</p>
                        <p className="text-3xl font-semibold leading-none">
                          {positive ? "▲ " : negative ? "▼ " : ""}
                          {formatPercent(tile.changePct)}
                        </p>
                      </div>
                      <div className="text-right text-[10px] leading-4 opacity-82">
                        <p>Size: {formatVolume(tile.volume)}</p>
                        <p>{tile.source}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] leading-5 text-[var(--muted)]">
        <p>
          資料來源：Yahoo Finance / Stooq；無穩定成交量商品使用 MapHouse liquidity tier。價格 API 約 3 分鐘快取。
        </p>
        <p>{updatedAt ? `更新：${new Date(updatedAt).toLocaleString("zh-TW")}` : "讀取市場資料中"}</p>
      </div>
    </section>
  );
}
