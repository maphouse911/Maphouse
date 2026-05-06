import { NextResponse } from "next/server";
import https from "node:https";
import { commodityProfiles, type CommodityKey } from "@/app/data";

type YahooChartQuote = {
  open?: Array<number | null>;
  high?: Array<number | null>;
  low?: Array<number | null>;
  close?: Array<number | null>;
};

type YahooChartResult = {
  timestamp?: number[];
  indicators?: {
    quote?: YahooChartQuote[];
  };
};

type YahooChartResponse = {
  chart?: {
    result?: YahooChartResult[];
    error?: { description?: string } | null;
  };
};

type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type CandleCacheEntry = {
  symbol: string;
  candles: Candle[];
  updatedAt: number;
};

type CandleFetchResult = {
  symbol: string;
  candles: Candle[];
  fetchedAt: number;
  source: "yahoo";
};

class CandleFetchError extends Error {
  details: string[];
  rateLimited: boolean;

  constructor(message: string, details: string[], rateLimited: boolean) {
    super(message);
    this.name = "CandleFetchError";
    this.details = details;
    this.rateLimited = rateLimited;
  }
}

const ALLOWED_RANGES = new Set(["1mo", "3mo", "6mo", "1y", "2y"]);
const ALLOWED_INTERVALS = new Set(["1d", "1wk"]);
const CACHE_TTL_MS = 3 * 60 * 1000;
const STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000;
const candleCache = new Map<string, CandleCacheEntry>();
const inFlightFetches = new Map<string, Promise<CandleFetchResult>>();

function isCommodityKey(value: string): value is CommodityKey {
  return Object.prototype.hasOwnProperty.call(commodityProfiles, value);
}

function toYmd(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function toCandles(result: YahooChartResult | undefined): Candle[] {
  if (!result) return [];
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!quote) return [];

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (
      typeof open !== "number" ||
      typeof high !== "number" ||
      typeof low !== "number" ||
      typeof close !== "number" ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    candles.push({
      time: toYmd(timestamps[i]),
      open,
      high,
      low,
      close,
    });
  }
  return candles;
}

function requestJsonViaHttps<T>(url: string): Promise<{ status: number; data?: T; text: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          accept: "application/json,text/plain,*/*",
          "accept-language": "en-US,en;q=0.9",
          referer: "https://finance.yahoo.com/",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;
          try {
            const data = JSON.parse(text) as T;
            resolve({ status, data, text });
          } catch {
            resolve({ status, text });
          }
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchYahooCandles(symbol: string, range: string, interval: string) {
  const domains = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  const maxAttempts = 2;

  let lastError = "Unknown error";
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    for (const domain of domains) {
      const url = `https://${domain}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
      const response = await requestJsonViaHttps<YahooChartResponse>(url);
      const payload = response.data;

      if (response.status >= 200 && response.status < 300 && payload) {
        const error = payload.chart?.error?.description;
        if (error) {
          lastError = `${domain}: ${error}`;
          continue;
        }
        const candles = toCandles(payload.chart?.result?.[0]);
        if (candles.length > 0) {
          return candles;
        }
        lastError = `${domain}: empty candles`;
        continue;
      }

      lastError = `${domain}: status ${response.status}`;
    }

    if (attempt < maxAttempts - 1) {
      await sleep(320 + attempt * 280);
    }
  }

  throw new Error(lastError);
}

function isRateLimitedMessage(message: string) {
  return /status\s*429/i.test(message);
}

async function fetchFreshCandles(cacheKey: string, symbols: string[], range: string, interval: string): Promise<CandleFetchResult> {
  const inFlight = inFlightFetches.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const task = (async () => {
    const errors: string[] = [];
    let sawRateLimit = false;

    for (const symbol of symbols) {
      try {
        const candles = await fetchYahooCandles(symbol, range, interval);
        if (candles.length > 10) {
          return {
            symbol,
            candles,
            fetchedAt: Date.now(),
            source: "yahoo" as const,
          };
        }
        errors.push(`${symbol}: empty candles`);
      } catch (error) {
        const message = `${symbol}: ${error instanceof Error ? error.message : "request failed"}`;
        errors.push(message);
        if (isRateLimitedMessage(message)) {
          sawRateLimit = true;
        }
      }
    }

    throw new CandleFetchError("Unable to fetch market candles", errors, sawRateLimit);
  })();

  inFlightFetches.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlightFetches.delete(cacheKey);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const commodity = searchParams.get("commodity") ?? "";
  const range = searchParams.get("range") ?? "6mo";
  const interval = searchParams.get("interval") ?? "1d";

  if (!isCommodityKey(commodity)) {
    return NextResponse.json({ ok: false, error: "Invalid commodity" }, { status: 400 });
  }
  if (!ALLOWED_RANGES.has(range)) {
    return NextResponse.json({ ok: false, error: "Invalid range" }, { status: 400 });
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json({ ok: false, error: "Invalid interval" }, { status: 400 });
  }

  const symbols = commodityProfiles[commodity].futuresSymbols;
  const cacheKey = `${commodity}_${range}_${interval}`;
  const now = Date.now();

  const cached = candleCache.get(cacheKey);
  if (cached && now - cached.updatedAt <= CACHE_TTL_MS) {
    return NextResponse.json({
      ok: true,
      source: "cache",
      symbol: cached.symbol,
      commodity,
      range,
      interval,
      candles: cached.candles,
      updatedAt: new Date(cached.updatedAt).toISOString(),
      stale: false,
    });
  }

  try {
    const fresh = await fetchFreshCandles(cacheKey, symbols, range, interval);
    candleCache.set(cacheKey, {
      symbol: fresh.symbol,
      candles: fresh.candles,
      updatedAt: fresh.fetchedAt,
    });
    return NextResponse.json({
      ok: true,
      source: fresh.source,
      symbol: fresh.symbol,
      commodity,
      range,
      interval,
      candles: fresh.candles,
      updatedAt: new Date(fresh.fetchedAt).toISOString(),
    });
  } catch (error) {
    const details =
      error instanceof CandleFetchError ? error.details : [error instanceof Error ? error.message : "request failed"];
    const rateLimited = error instanceof CandleFetchError ? error.rateLimited : false;

    if (cached && now - cached.updatedAt <= STALE_MAX_MS) {
      return NextResponse.json({
        ok: true,
        source: "cache-stale",
        symbol: cached.symbol,
        commodity,
        range,
        interval,
        candles: cached.candles,
        updatedAt: new Date(cached.updatedAt).toISOString(),
        stale: true,
        warning: "Using cached candles due upstream rate limit",
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: rateLimited ? "Market data temporarily rate-limited" : "Unable to fetch market candles",
        commodity,
        rateLimited,
        retryAfterSeconds: rateLimited ? 60 : undefined,
        details,
      },
      { status: rateLimited ? 429 : 502 },
    );
  }
}
