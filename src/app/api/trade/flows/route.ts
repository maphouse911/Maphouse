import { NextResponse } from "next/server";
import { commodityProfiles, type CommodityKey } from "@/app/data";

type OecTradeRow = {
  "Exporter Country"?: string;
  "Importer Country"?: string;
  Year?: number;
  "Trade Value"?: number;
};

type OecTradeResponse = {
  data?: OecTradeRow[];
};

type FlowPoint = {
  country: string;
  x: number;
  y: number;
};

type TradeFlowDatum = {
  id: string;
  exporter: string;
  importer: string;
  valueUsd: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  share: number;
  year: number;
};

type OecFetchResult = {
  rows: OecTradeRow[];
  hs4Id: number;
  usedYear: number | null;
};

type TradeFlowCacheEntry = {
  updatedAt: number;
  flows: TradeFlowDatum[];
  year: number;
  hs4Id: number;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_LIMIT = 40;
const OEC_CUBE = "trade_i_baci_a_22";
const HS4_BY_COMMODITY: Record<CommodityKey, number> = {
  soybean: 21201, // Soybeans
  wheat: 21001, // Wheat
  corn: 21005, // Corn
  coffee: 20901, // Coffee
  oil: 52709, // Crude Petroleum
  aluminum: 157601, // Raw Aluminium
  copper: 157403, // Refined Copper
  gold: 147108, // Gold
  silver: 147106, // Silver
  naturalGas: 52711, // Petroleum gas
  brent: 52709, // Crude Petroleum (Brent benchmark view)
  nickel: 157502, // Unwrought nickel
  zinc: 157901, // Unwrought zinc
  lead: 157801, // Unwrought lead
  tin: 180001, // Unwrought tin
  cobalt: 181005, // Cobalt mattes and intermediate products
  lithium: 283691, // Lithium carbonate
  gallium: 181129, // Gallium and related rare metals compounds
  germanium: 181129, // Germanium and related rare metals compounds
  cocoa: 41801, // Cocoa beans
  sugar: 41701, // Cane or beet sugar
  cotton: 115201, // Raw cotton
  soybeanOil: 31507, // Soybean oil
};
const COUNTRY_ALIASES: Record<string, string> = {
  "united arab emirates": "uae",
  uae: "uae",
  "united kingdom": "uk",
  uk: "uk",
  "korea, rep.": "south korea",
  "republic of korea": "south korea",
  "south korea": "south korea",
  "korea, south": "south korea",
  "democratic republic of the congo": "dr congo",
  "congo, dem. rep.": "dr congo",
  "dr congo": "dr congo",
  russia: "russia",
  "united states": "united states",
};
const flowCache = new Map<string, TradeFlowCacheEntry>();

function isCommodityKey(value: string): value is CommodityKey {
  return Object.prototype.hasOwnProperty.call(commodityProfiles, value);
}

function normalizeCountry(value: string) {
  const base = value.toLowerCase().replace(/[().]/g, "").replace(/\s+/g, " ").trim();
  return COUNTRY_ALIASES[base] ?? base;
}

function toFlowPointMap(commodity: CommodityKey) {
  const map = new Map<string, FlowPoint>();
  const bubbles = commodityProfiles[commodity].tradeBubbles;
  bubbles.forEach((bubble) => {
    const key = normalizeCountry(bubble.country);
    if (!map.has(key)) {
      map.set(key, {
        country: bubble.country,
        x: bubble.x,
        y: bubble.y,
      });
    }
  });
  return map;
}

function toKey(exporter: string, importer: string) {
  return `${exporter}__${importer}`;
}

function toOecUrl(commodity: CommodityKey, yearRaw: string | null) {
  const hs4Id = HS4_BY_COMMODITY[commodity];
  const params = new URLSearchParams({
    cube: OEC_CUBE,
    drilldowns: "Year,HS4,Exporter Country,Importer Country",
    measures: "Trade Value",
    limit: "65000,0",
  });

  if (yearRaw && /^\d{4}$/.test(yearRaw)) {
    params.set("include", `HS4:${hs4Id};Year:${yearRaw}`);
  } else {
    params.set("include", `HS4:${hs4Id}`);
    params.set("time", "Year.latest");
  }

  return {
    url: `https://api-v2.oec.world/tesseract/data.jsonrecords?${params.toString()}`,
    hs4Id,
  };
}

async function fetchOecRows(commodity: CommodityKey, yearRaw: string | null): Promise<OecFetchResult> {
  const { url, hs4Id } = toOecUrl(commodity, yearRaw);
  const response = await fetch(url, {
    headers: {
      "user-agent": "MapHouseBot/1.0 (+https://localhost:3000)",
      accept: "application/json",
    },
    next: { revalidate: 6 * 60 * 60 },
  });
  if (!response.ok) {
    throw new Error(`Trade API failed with ${response.status}`);
  }
  const payload = (await response.json()) as OecTradeResponse;
  const rows = payload.data ?? [];
  return {
    rows,
    hs4Id,
    usedYear: yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null,
  };
}

function formatFlowList(rows: OecTradeRow[], pointMap: Map<string, FlowPoint>, limit: number): TradeFlowDatum[] {
  const pairMap = new Map<string, { exporter: string; importer: string; valueUsd: number; year: number }>();

  rows.forEach((row) => {
    const exporterName = row["Exporter Country"];
    const importerName = row["Importer Country"];
    const value = row["Trade Value"];
    const year = row.Year;
    if (
      typeof exporterName !== "string" ||
      typeof importerName !== "string" ||
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value <= 0 ||
      typeof year !== "number"
    ) {
      return;
    }

    const exporterKey = normalizeCountry(exporterName);
    const importerKey = normalizeCountry(importerName);
    if (exporterKey === importerKey) return;

    const exporterPoint = pointMap.get(exporterKey);
    const importerPoint = pointMap.get(importerKey);
    if (!exporterPoint || !importerPoint) return;

    const pairKey = toKey(exporterPoint.country, importerPoint.country);
    const existing = pairMap.get(pairKey);
    if (existing) {
      existing.valueUsd += value;
      existing.year = Math.max(existing.year, year);
      return;
    }
    pairMap.set(pairKey, {
      exporter: exporterPoint.country,
      importer: importerPoint.country,
      valueUsd: value,
      year,
    });
  });

  const sorted = Array.from(pairMap.values()).sort((a, b) => b.valueUsd - a.valueUsd).slice(0, limit);
  const totalValue = sorted.reduce((sum, item) => sum + item.valueUsd, 0);

  return sorted.map((item, index) => {
    const from = pointMap.get(normalizeCountry(item.exporter));
    const to = pointMap.get(normalizeCountry(item.importer));
    return {
      id: `flow-${index}-${item.exporter}-${item.importer}`.toLowerCase().replace(/\s+/g, "-"),
      exporter: item.exporter,
      importer: item.importer,
      valueUsd: item.valueUsd,
      fromX: from?.x ?? 0,
      fromY: from?.y ?? 0,
      toX: to?.x ?? 0,
      toY: to?.y ?? 0,
      share: totalValue > 0 ? (item.valueUsd / totalValue) * 100 : 0,
      year: item.year,
    };
  });
}

function buildFallbackFlowsFromProfile(commodity: CommodityKey, limit: number): TradeFlowDatum[] {
  const bubbles = commodityProfiles[commodity].tradeBubbles;
  const exporters = bubbles
    .filter((item) => item.type === "export")
    .sort((a, b) => b.share - a.share)
    .slice(0, 6);
  const importers = bubbles
    .filter((item) => item.type === "import")
    .sort((a, b) => b.share - a.share)
    .slice(0, 6);

  if (!exporters.length || !importers.length) return [];
  const targetYear = new Date().getFullYear() - 1;
  const estimateBase = 1_000_000_000;
  const raw: TradeFlowDatum[] = [];

  for (const exp of exporters) {
    for (const imp of importers) {
      if (normalizeCountry(exp.country) === normalizeCountry(imp.country)) continue;
      const score = exp.share * imp.share;
      raw.push({
        id: `fallback-${commodity}-${exp.id}-${imp.id}`,
        exporter: exp.country,
        importer: imp.country,
        valueUsd: score * estimateBase,
        fromX: exp.x,
        fromY: exp.y,
        toX: imp.x,
        toY: imp.y,
        share: 0,
        year: targetYear,
      });
    }
  }

  const sorted = raw.sort((a, b) => b.valueUsd - a.valueUsd).slice(0, limit);
  const total = sorted.reduce((sum, item) => sum + item.valueUsd, 0);
  return sorted.map((item) => ({
    ...item,
    share: total > 0 ? (item.valueUsd / total) * 100 : 0,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const commodity = searchParams.get("commodity") ?? "";
  const year = searchParams.get("year");
  const rawLimit = Number(searchParams.get("limit") ?? "18");
  const limit = Number.isFinite(rawLimit) ? Math.max(6, Math.min(MAX_LIMIT, Math.floor(rawLimit))) : 18;

  if (!isCommodityKey(commodity)) {
    return NextResponse.json({ ok: false, error: "Invalid commodity" }, { status: 400 });
  }

  const cacheKey = `${commodity}_${year ?? "latest"}_${limit}`;
  const now = Date.now();
  const cached = flowCache.get(cacheKey);
  if (cached && now - cached.updatedAt <= CACHE_TTL_MS) {
    return NextResponse.json({
      ok: true,
      source: "cache",
      commodity,
      hs4Id: cached.hs4Id,
      year: cached.year,
      flows: cached.flows,
      updatedAt: new Date(cached.updatedAt).toISOString(),
    });
  }

  const pointMap = toFlowPointMap(commodity);
  let hs4IdForError = HS4_BY_COMMODITY[commodity];

  try {
    let rows: OecTradeRow[] = [];
    let hs4Id = HS4_BY_COMMODITY[commodity];
    let resolvedYear: number | null = null;

    if (year && /^\d{4}$/.test(year)) {
      const result = await fetchOecRows(commodity, year);
      rows = result.rows;
      hs4Id = result.hs4Id;
      hs4IdForError = hs4Id;
      resolvedYear = result.usedYear;
    } else {
      const latest = await fetchOecRows(commodity, null);
      rows = latest.rows;
      hs4Id = latest.hs4Id;
      hs4IdForError = hs4Id;

      if (!rows.length) {
        const currentYear = new Date().getFullYear();
        const candidateYears = Array.from({ length: 8 }, (_, i) => String(currentYear - 1 - i));
        for (const candidateYear of candidateYears) {
          const result = await fetchOecRows(commodity, candidateYear);
          if (result.rows.length) {
            rows = result.rows;
            resolvedYear = Number(candidateYear);
            break;
          }
        }
      }
    }

    let flows = formatFlowList(rows, pointMap, limit);
    let source: "oec" | "profile-fallback" = "oec";
    if (!flows.length) {
      flows = buildFallbackFlowsFromProfile(commodity, limit);
      source = "profile-fallback";
    }
    const detectedYear =
      flows[0]?.year ??
      resolvedYear ??
      (year && /^\d{4}$/.test(year) ? Number(year) : new Date().getFullYear() - 1);

    flowCache.set(cacheKey, {
      updatedAt: now,
      flows,
      year: detectedYear,
      hs4Id,
    });

    return NextResponse.json({
      ok: true,
      source,
      commodity,
      hs4Id,
      year: detectedYear,
      flows,
      updatedAt: new Date(now).toISOString(),
      warning:
        source === "profile-fallback"
          ? "OEC 即時可用資料不足，已以商品進出口占比產生估算 flows。"
          : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to fetch trade flows",
        commodity,
        hs4Id: hs4IdForError,
        detail: error instanceof Error ? error.message : "unknown error",
      },
      { status: 502 },
    );
  }
}
