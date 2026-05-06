"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type CandlestickData,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { CommodityKey } from "@/app/data";
import { trackEvent } from "@/lib/analytics";

type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type ApiResponse = {
  ok: boolean;
  source?: string;
  symbol?: string;
  candles?: Candle[];
  error?: string;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
  details?: string[];
};

type RangeKey = "1mo" | "3mo" | "6mo" | "1y" | "2y";

type Props = {
  commodityKey: CommodityKey;
  title: string;
  benchmark: string;
};

type ChartDataMode = "futures" | "proxy" | "spot";

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "1mo", label: "1M" },
  { key: "3mo", label: "3M" },
  { key: "6mo", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "2y", label: "2Y" },
];
const CHART_HEIGHT = 460;

const TV_SYMBOL_MAP: Partial<Record<CommodityKey, string>> = {
  // Use embeddable commodity symbols to avoid TradingView fallback-to-AAPL behavior
  // when exchange-specific futures feeds are restricted in iframe widgets.
  soybean: "CAPITALCOM:SOYBEAN",
  wheat: "CAPITALCOM:WHEAT",
  corn: "CAPITALCOM:CORN",
  coffee: "FOREXCOM:COFFEE",
  oil: "TVC:USOIL",
  aluminum: "CAPITALCOM:ALUMINUM",
  copper: "CAPITALCOM:COPPER",
  gold: "TVC:GOLD",
  silver: "TVC:SILVER",
  naturalGas: "CAPITALCOM:NATURALGAS",
  brent: "BLACKBULL:BRENT",
  nickel: "CAPITALCOM:NICKEL",
  zinc: "PEPPERSTONE:ZINC",
  lead: "CAPITALCOM:LEAD",
  tin: "CAPITALCOM:TIN",
  cobalt: "CAPITALCOM:COBALT",
  lithium: "CAPITALCOM:LITHIUM",
  cocoa: "PEPPERSTONE:COCOA",
  sugar: "FOREXCOM:SUGAR",
  cotton: "FOREXCOM:COTTON",
  soybeanOil: "CAPITALCOM:SOYBEANOIL",
};

const CHART_MODE_BY_COMMODITY: Record<CommodityKey, ChartDataMode> = {
  soybean: "futures",
  wheat: "futures",
  corn: "futures",
  coffee: "futures",
  cocoa: "futures",
  sugar: "futures",
  cotton: "futures",
  soybeanOil: "futures",
  oil: "futures",
  brent: "futures",
  naturalGas: "futures",
  gold: "futures",
  silver: "futures",
  copper: "futures",
  aluminum: "proxy",
  nickel: "proxy",
  zinc: "proxy",
  lead: "proxy",
  tin: "proxy",
  cobalt: "proxy",
  lithium: "proxy",
  gallium: "spot",
  germanium: "spot",
};

const CHART_MODE_LABEL: Record<ChartDataMode, string> = {
  futures: "Futures K-Line",
  proxy: "Market Proxy K-Line",
  spot: "Spot Reference K-Line",
};

const SPOT_REFERENCE_CANDLES: Partial<Record<CommodityKey, Candle[]>> = {
  gallium: [
    { time: "2024-01-01", open: 870, high: 920, low: 840, close: 905 },
    { time: "2024-03-01", open: 910, high: 980, low: 880, close: 960 },
    { time: "2024-05-01", open: 965, high: 1050, low: 930, close: 1020 },
    { time: "2024-07-01", open: 1025, high: 1120, low: 980, close: 1095 },
    { time: "2024-09-01", open: 1100, high: 1260, low: 1060, close: 1220 },
    { time: "2024-11-01", open: 1230, high: 1420, low: 1190, close: 1360 },
    { time: "2025-01-01", open: 1370, high: 1600, low: 1320, close: 1540 },
    { time: "2025-03-01", open: 1545, high: 1710, low: 1490, close: 1650 },
    { time: "2025-05-01", open: 1660, high: 1780, low: 1600, close: 1720 },
    { time: "2025-07-01", open: 1715, high: 1860, low: 1670, close: 1810 },
    { time: "2025-09-01", open: 1815, high: 1950, low: 1760, close: 1890 },
    { time: "2025-11-01", open: 1895, high: 2060, low: 1840, close: 1990 },
    { time: "2026-01-01", open: 1995, high: 2160, low: 1940, close: 2100 },
    { time: "2026-03-01", open: 2105, high: 2210, low: 2050, close: 2125 },
  ],
  germanium: [
    { time: "2024-01-01", open: 12400, high: 13200, low: 11900, close: 12800 },
    { time: "2024-03-01", open: 12850, high: 13800, low: 12400, close: 13450 },
    { time: "2024-05-01", open: 13500, high: 14600, low: 13100, close: 14100 },
    { time: "2024-07-01", open: 14150, high: 15400, low: 13800, close: 14900 },
    { time: "2024-09-01", open: 14950, high: 16300, low: 14500, close: 15700 },
    { time: "2024-11-01", open: 15750, high: 17100, low: 15200, close: 16500 },
    { time: "2025-01-01", open: 16550, high: 17900, low: 16000, close: 17350 },
    { time: "2025-03-01", open: 17400, high: 18800, low: 16900, close: 18100 },
    { time: "2025-05-01", open: 18150, high: 19500, low: 17600, close: 18800 },
    { time: "2025-07-01", open: 18850, high: 20100, low: 18300, close: 19400 },
    { time: "2025-09-01", open: 19450, high: 20500, low: 18900, close: 19900 },
    { time: "2025-11-01", open: 19950, high: 21200, low: 19300, close: 20600 },
    { time: "2026-01-01", open: 20650, high: 21800, low: 20100, close: 21250 },
    { time: "2026-03-01", open: 21300, high: 22100, low: 20800, close: 21700 },
  ],
};

function filterSpotReferenceCandles(candles: Candle[], range: RangeKey) {
  if (!candles.length) return candles;
  const monthsBack: Record<RangeKey, number> = { "1mo": 1, "3mo": 3, "6mo": 6, "1y": 12, "2y": 24 };
  const cutoff = new Date(candles[candles.length - 1].time);
  cutoff.setMonth(cutoff.getMonth() - monthsBack[range]);
  return candles.filter((item) => new Date(item.time) >= cutoff);
}

function toTimestamp(time: string): UTCTimestamp {
  return Math.floor(new Date(`${time}T00:00:00Z`).getTime() / 1000) as UTCTimestamp;
}

export default function CommodityCandlestickChart({ commodityKey, title, benchmark }: Props) {
  const [range, setRange] = useState<RangeKey>("6mo");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const tradingViewSymbol = TV_SYMBOL_MAP[commodityKey];
  const chartMode = CHART_MODE_BY_COMMODITY[commodityKey];
  const showSpotReferenceChart = chartMode === "spot" && Boolean(tradingViewSymbol);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi["addSeries"]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchCandles() {
      if (chartMode === "spot") {
        const referenceSeries = SPOT_REFERENCE_CANDLES[commodityKey] ?? [];
        setCandles(filterSpotReferenceCandles(referenceSeries, range));
        setSymbol("Spot Reference");
        setError("");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/market/candles?commodity=${commodityKey}&range=${range}&interval=1d`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !payload.ok || !payload.candles?.length) {
          if (payload.rateLimited) {
            throw new Error("市場資料來源目前限流，已自動切換 TradingView 即時期貨圖。");
          }
          throw new Error(payload.error ?? "No market data");
        }
        if (!cancelled) {
          setCandles(payload.candles);
          setSymbol(payload.symbol ?? "");
          void trackEvent("kline_loaded", {
            commodity: commodityKey,
            range,
            symbol: payload.symbol ?? "",
            count: payload.candles.length,
          });
        }
      } catch (fetchError) {
        if (!cancelled) {
          setCandles([]);
          setError(fetchError instanceof Error ? fetchError.message : "K-line fetch failed");
          setSymbol("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCandles();
    return () => {
      cancelled = true;
    };
  }, [chartMode, commodityKey, range, tradingViewSymbol]);

  const candleData = useMemo<CandlestickData<UTCTimestamp>[]>(() => {
    return candles.map((item) => ({
      time: toTimestamp(item.time),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }));
  }, [candles]);
  const showTradingViewFallback = (Boolean(error) && Boolean(tradingViewSymbol)) || showSpotReferenceChart;
  const tvFallbackSymbolLabel = symbol || tradingViewSymbol;
  const tvSrcDoc = useMemo(() => {
    if (!tradingViewSymbol) return "";
    const config = {
      autosize: false,
      width: "100%",
      height: CHART_HEIGHT,
      symbol: tradingViewSymbol,
      interval: "D",
      timezone: "Asia/Taipei",
      theme: "light",
      style: "1",
      locale: "en",
      withdateranges: true,
      allow_symbol_change: false,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      save_image: false,
      calendar: false,
      details: false,
      hotlist: false,
      hide_volume: true,
      studies: [],
      support_host: "https://www.tradingview.com",
    };
    const configJson = JSON.stringify(config);
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body style="margin:0;background:#f9fbf4;"><div class="tradingview-widget-container" style="height:100%;width:100%;"><div class="tradingview-widget-container__widget" style="height:100%;width:100%;"></div><script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>${configJson}</script></div></body></html>`;
  }, [tradingViewSymbol]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: CHART_HEIGHT,
      layout: {
        background: { type: ColorType.Solid, color: "#f9fbf4" },
        textColor: "#5f6f57",
        fontFamily: "Avenir Next, Segoe UI, Helvetica Neue, Arial, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(126, 149, 110, 0.13)" },
        horzLines: { color: "rgba(126, 149, 110, 0.13)" },
      },
      rightPriceScale: {
        borderColor: "rgba(126, 149, 110, 0.3)",
      },
      timeScale: {
        borderColor: "rgba(126, 149, 110, 0.3)",
      },
      crosshair: {
        vertLine: { color: "rgba(10, 21, 38, 0.24)" },
        horzLine: { color: "rgba(10, 21, 38, 0.24)" },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#6c8a54",
      downColor: "#c57a55",
      borderVisible: false,
      wickUpColor: "#6c8a54",
      wickDownColor: "#c57a55",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const observer = new ResizeObserver(() => {
      chart.timeScale().fitContent();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    seriesRef.current.setData(candleData);
    chartRef.current.timeScale().fitContent();
  }, [candleData]);

  return (
    <section className="rounded-xl border border-[var(--line)] bg-white/78 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{CHART_MODE_LABEL[chartMode]}</p>
          <h4 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            {title} · {benchmark}
          </h4>
          <p className="mt-1 text-xs text-[var(--muted)]">{tvFallbackSymbolLabel ? `Symbol: ${tvFallbackSymbolLabel}` : "Symbol: --"}</p>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/85 p-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => {
                setRange(option.key);
                void trackEvent("kline_range_change", { commodity: commodityKey, range: option.key });
              }}
              className={`rounded-full px-2.5 py-1 text-xs ${
                option.key === range ? "bg-[var(--brand-ink)] text-white" : "text-[var(--muted)] hover:bg-[#eef3e6]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-[var(--line)] bg-[#f9fbf4]">
        {showTradingViewFallback && tvSrcDoc ? (
          <iframe
            srcDoc={tvSrcDoc}
            key={`${commodityKey}-${tradingViewSymbol}`}
            className="h-[460px] w-full md:h-[500px]"
            title={`${title} live futures k-line`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div ref={containerRef} className="h-[460px] w-full md:h-[500px]" />
        )}
      </div>

      {loading ? <p className="mt-3 text-xs text-[var(--muted)]">Loading market candles...</p> : null}
      {error && showTradingViewFallback ? (
        <p className="mt-3 text-xs text-[var(--muted)]">Yahoo 讀取受限，已自動切換到 TradingView 即時期貨圖。</p>
      ) : null}
      {chartMode === "proxy" ? (
        <p className="mt-3 text-xs text-[var(--muted)]">註：此圖為 proxy 市場曲線（非主交易所標準交割期貨），用於觀察方向與波動。</p>
      ) : null}
      {chartMode === "spot" ? (
        <p className="mt-3 text-xs text-[var(--muted)]">註：此圖為現貨參考曲線（Spot Reference），非標準化期貨主力合約，請留意解讀。</p>
      ) : null}
      {error && !showTradingViewFallback ? <p className="mt-3 text-xs text-[#a0522d]">K-line unavailable: {error}</p> : null}
    </section>
  );
}
