"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import CommodityCandlestickChart from "@/components/CommodityCandlestickChart";
import CommodityWorldMap, { type CommodityTradeFlow } from "@/components/CommodityWorldMap";
import { trackEvent } from "@/lib/analytics";
import { commoditySiteDefaultSources, commoditySitePoints } from "@/lib/commoditySites";
import {
  getPipelineStatusAtYear,
  getPipelineYearExtent,
  pipelineRiskEventsByCommodity,
  pipelineRoutesByCommodity,
  type PipelineRiskType,
} from "@/lib/pipelineRoutes";
import { commodityProfiles, commoditySections, commodityThemes, type CommodityKey, type CommodityProfile } from "../data";

type MapLayer = "production" | "trade";
type SiteKindFilter = "mine" | "field" | "terminal" | "basin" | "belt";

type CountryIntel = {
  companies: string[];
  positioning: string;
};

type DriverSignalResponse = {
  ok?: boolean;
  warning?: string;
  source?: string;
  stale?: boolean;
  partial?: boolean;
  signals?: DriverSignal[];
  newsSnapshot?: CommodityNewsSnapshot | null;
  error?: string;
  details?: string[];
};

type DriverDirection = "positive" | "negative" | "neutral";
type DriverHorizon = "short" | "long";
type PipelineRiskFilterState = Record<PipelineRiskType, boolean>;

type DriverSignal = {
  id: string;
  label: string;
  horizon?: DriverHorizon;
  direction: DriverDirection;
  scoreLabel: string;
  statusText: string;
  rationale: string[];
  updatedAt: string;
  sourceNote: string;
  sourceLinks: Array<{ label: string; href: string }>;
};

type MarketCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type MarketSnapshot = {
  benchmark: string;
  latest: string;
  ytd: string;
  volatility: string;
  symbol: string;
  source: string;
  updatedAt: string;
  stale?: boolean;
  warning?: string;
};

type MarketSnapshotApiResponse = {
  ok?: boolean;
  source?: string;
  stale?: boolean;
  warning?: string;
  symbol?: string;
  updatedAt?: string;
  candles?: MarketCandle[];
  error?: string;
};

type NewsTone = "positive" | "negative" | "neutral";

type CommodityNewsItem = {
  title: string;
  url: string;
  domain?: string;
  publishedAt: string;
  tone: NewsTone;
  relevance: number;
  matchedDrivers: string[];
};

type CommodityKeywordStat = {
  keyword: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
};

type CommodityDriverCoverage = {
  key: string;
  label: string;
  count: number;
};

type CommodityNewsSnapshot = {
  items: CommodityNewsItem[];
  keywords: CommodityKeywordStat[];
  driverCoverage: CommodityDriverCoverage[];
  sourceNote: string;
  sourceLinks: Array<{ label: string; href: string }>;
  updatedAt: string;
};

const HS4_BY_COMMODITY: Record<CommodityKey, number> = {
  soybean: 21201,
  wheat: 21001,
  corn: 21005,
  coffee: 20901,
  oil: 52709,
  aluminum: 157601,
  copper: 157403,
  gold: 147108,
  silver: 147106,
  naturalGas: 52711,
  brent: 52709,
  nickel: 157502,
  zinc: 157901,
  lead: 157801,
  tin: 180001,
  cobalt: 181005,
  lithium: 283691,
  gallium: 181129,
  germanium: 181129,
  cocoa: 41801,
  sugar: 41701,
  cotton: 115201,
  soybeanOil: 31507,
};

const PRICE_UNIT_BY_COMMODITY: Record<CommodityKey, string> = {
  soybean: "bushel",
  wheat: "bushel",
  corn: "bushel",
  coffee: "lb",
  oil: "bbl",
  aluminum: "tonne",
  copper: "lb",
  gold: "oz",
  silver: "oz",
  naturalGas: "MMBtu",
  brent: "bbl",
  nickel: "tonne",
  zinc: "tonne",
  lead: "tonne",
  tin: "tonne",
  cobalt: "tonne",
  lithium: "tonne",
  gallium: "kg",
  germanium: "kg",
  cocoa: "tonne",
  sugar: "lb",
  cotton: "lb",
  soybeanOil: "lb",
};

const SECTION_HEADER_STYLES: Record<
  "agri" | "energy" | "metals",
  { from: string; to: string; border: string; shadow: string }
> = {
  agri: { from: "#7b9264", to: "#5f754b", border: "#5a7047", shadow: "rgba(64, 85, 49, 0.26)" },
  energy: { from: "#4e808a", to: "#365f67", border: "#325760", shadow: "rgba(35, 72, 82, 0.25)" },
  metals: { from: "#ae8553", to: "#876741", border: "#7a5c3b", shadow: "rgba(110, 79, 45, 0.24)" },
};

const COUNTRY_ALIASES: Record<string, string> = {
  us: "united states",
  usa: "united states",
  "u.s.": "united states",
  uae: "united arab emirates",
  uk: "united kingdom",
  "dr congo": "dr congo",
  "democratic republic of the congo": "dr congo",
};

const COUNTRY_INTEL_BY_COMMODITY: Partial<Record<CommodityKey, Record<string, CountryIntel>>> = {
  soybean: {
    brazil: { companies: ["Amaggi", "Cargill Brazil", "Bunge Brasil"], positioning: "出口主導，掌握遠洋供應節奏" },
    "united states": { companies: ["ADM", "Cargill", "Bunge"], positioning: "種植與期貨定價核心市場" },
    argentina: { companies: ["Viterra", "AGD", "Molinos Agro"], positioning: "壓榨與豆粉出口樞紐" },
    china: { companies: ["COFCO", "Sinograin", "Jiusan Group"], positioning: "進口需求錨點，牽動全球庫存循環" },
  },
  wheat: {
    russia: { companies: ["United Grain Company", "RIF", "Aston"], positioning: "黑海出口核心，對價格風險敏感" },
    france: { companies: ["Soufflet", "InVivo", "Euralis"], positioning: "歐洲供應與品質標準中心" },
    "united states": { companies: ["Cargill", "ADM", "CHS"], positioning: "全球備援供給來源" },
    australia: { companies: ["CBH Group", "GrainCorp", "Viterra AU"], positioning: "亞太出口關鍵來源" },
  },
  corn: {
    "united states": { companies: ["ADM", "Cargill", "Bunge"], positioning: "全球玉米定價核心" },
    brazil: { companies: ["Amaggi", "Louis Dreyfus", "Cargill Brazil"], positioning: "第二季供應補位關鍵" },
    argentina: { companies: ["ACA", "Viterra", "Bunge Argentina"], positioning: "出口導向市場" },
    china: { companies: ["COFCO", "Sinograin", "Beidahuang"], positioning: "內需與進口節奏影響區域平衡" },
  },
  coffee: {
    brazil: { companies: ["Cooxupe", "Olam Brazil", "Volcafe"], positioning: "Arabica 供給中樞" },
    vietnam: { companies: ["Intimex", "Simexco", "Louis Dreyfus VN"], positioning: "Robusta 供應核心" },
    colombia: { companies: ["FNC", "Pergamino", "Carcafe"], positioning: "精品與水洗豆品質代表" },
    germany: { companies: ["Neumann Gruppe", "Tchibo", "JDE Germany"], positioning: "歐洲烘焙與進口集散地" },
  },
  oil: {
    "saudi arabia": { companies: ["Saudi Aramco", "SABIC", "Bahri"], positioning: "原油出口主樞紐" },
    "united states": { companies: ["ExxonMobil", "Chevron", "ConocoPhillips"], positioning: "供給彈性與頁岩油核心" },
    russia: { companies: ["Rosneft", "Lukoil", "Gazprom Neft"], positioning: "出口流向與折價結構關鍵" },
    china: { companies: ["Sinopec", "PetroChina", "CNOOC"], positioning: "進口需求與煉油能力中心" },
  },
  aluminum: {
    china: { companies: ["Chalco", "Hongqiao", "China Power Investment"], positioning: "產能與需求雙核心" },
    "united arab emirates": { companies: ["Emirates Global Aluminium", "Dubal Holding", "TAQA"], positioning: "能源優勢型出口冶煉中心" },
    russia: { companies: ["RUSAL", "En+ Group", "Norilsk Logistics"], positioning: "歐亞供應鏈重要來源" },
    canada: { companies: ["Alcoa Canada", "Rio Tinto Aluminium", "Aluminerie Alouette"], positioning: "北美低碳鋁供給來源" },
  },
  copper: {
    chile: { companies: ["Codelco", "BHP Escondida", "Antofagasta Minerals"], positioning: "礦端供給最大來源" },
    peru: { companies: ["Southern Copper", "MMG", "Antamina"], positioning: "全球增量供應關鍵" },
    china: { companies: ["Jiangxi Copper", "Tongling Nonferrous", "Minmetals"], positioning: "精煉與消費中心" },
    "united states": { companies: ["Freeport-McMoRan", "Rio Tinto Kennecott", "Asarco"], positioning: "需求與投資週期指標市場" },
  },
};

const FALLBACK_COMPANIES: Record<CommodityKey, string[]> = {
  soybean: ["Cargill", "ADM", "Bunge"],
  wheat: ["Cargill", "Viterra", "Louis Dreyfus"],
  corn: ["ADM", "Cargill", "COFCO"],
  coffee: ["Nestle", "JDE Peet's", "Starbucks"],
  oil: ["Saudi Aramco", "ExxonMobil", "Shell"],
  aluminum: ["Chalco", "RUSAL", "Alcoa"],
  copper: ["Codelco", "Freeport-McMoRan", "Glencore"],
  gold: ["Newmont", "Barrick Gold", "Agnico Eagle"],
  silver: ["Fresnillo", "Pan American Silver", "Wheaton Precious Metals"],
  naturalGas: ["ExxonMobil", "Chevron", "QatarEnergy"],
  brent: ["Saudi Aramco", "Shell", "BP"],
  nickel: ["Vale", "Nornickel", "Tsingshan"],
  zinc: ["Teck Resources", "Glencore", "Nyrstar"],
  lead: ["Korea Zinc", "Nyrstar", "Henan Yuguang"],
  tin: ["Yunnan Tin", "Minsur", "PT Timah"],
  cobalt: ["CMOC", "Glencore", "Huayou Cobalt"],
  lithium: ["Albemarle", "SQM", "Tianqi Lithium"],
  gallium: ["China Minmetals", "Dowa Holdings", "5N Plus"],
  germanium: ["Umicore", "Teck Resources", "Yunnan Germanium"],
  cocoa: ["Barry Callebaut", "Cargill Cocoa", "Olam Food Ingredients"],
  sugar: ["Raizen", "Cosan", "Mitr Phol"],
  cotton: ["Olam Agri", "Louis Dreyfus", "Ecom"],
  soybeanOil: ["Bunge", "Cargill", "ADM"],
};

function firstDifferentKey(source: CommodityKey): CommodityKey {
  return commodityThemes.find((item) => item.key !== source)?.key ?? source;
}

function sharedRegions(primary: CommodityKey, secondary: CommodityKey) {
  const a = new Set(commodityProfiles[primary].hotspots.map((item) => item.label));
  const b = new Set(commodityProfiles[secondary].hotspots.map((item) => item.label));
  return Array.from(a).filter((label) => b.has(label));
}

function normalizeCountryCode(code: string | number | undefined) {
  if (code === undefined) return "";
  const asNumber = Number(code);
  return Number.isFinite(asNumber) ? String(asNumber) : String(code);
}

function normalizeCountryName(name: string | undefined) {
  if (!name) return "";
  const normalized = name.toLowerCase().replace(/[().]/g, "").replace(/\s+/g, " ").trim();
  return COUNTRY_ALIASES[normalized] ?? normalized;
}

function formatUsdCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function parseDriverScoreMagnitude(scoreLabel: string) {
  const value = Number.parseFloat(scoreLabel.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(value) ? Math.abs(value) : 0;
}

function formatSnapshotPrice(commodity: CommodityKey, value: number) {
  const unit = PRICE_UNIT_BY_COMMODITY[commodity];
  const decimals = Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 100 ? 2 : 3;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value);
  return `US$ ${formatted} / ${unit}`;
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function calculateAnnualizedVolatility(candles: MarketCandle[]) {
  const returns = candles
    .slice(1)
    .map((candle, index) => {
      const previous = candles[index]?.close;
      if (!previous || previous <= 0) return null;
      return Math.log(candle.close / previous);
    })
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (returns.length < 20) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(returns.length - 1, 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function buildMarketSnapshot(
  commodity: CommodityKey,
  profile: CommodityProfile,
  payload: MarketSnapshotApiResponse,
): MarketSnapshot | null {
  const candles = payload.candles?.filter((item) => Number.isFinite(item.close)) ?? [];
  if (!payload.ok || candles.length < 2) return null;

  const latestCandle = candles[candles.length - 1];
  const currentYear = new Date(`${latestCandle.time}T00:00:00Z`).getUTCFullYear();
  const yearStartCandle = candles.find((item) => new Date(`${item.time}T00:00:00Z`).getUTCFullYear() === currentYear) ?? candles[0];
  const ytd = yearStartCandle.close > 0 ? ((latestCandle.close - yearStartCandle.close) / yearStartCandle.close) * 100 : 0;
  const volatility = calculateAnnualizedVolatility(candles);

  return {
    benchmark: profile.benchmark,
    latest: formatSnapshotPrice(commodity, latestCandle.close),
    ytd: formatSignedPercent(ytd),
    volatility: volatility === null ? "--" : `${volatility.toFixed(1)}%`,
    symbol: payload.symbol ?? profile.futuresSymbols[0] ?? "N/A",
    source:
      payload.source === "cache" || payload.source === "cache-stale"
        ? "Yahoo Finance Chart API (cached)"
        : "Yahoo Finance Chart API",
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
    stale: payload.stale,
    warning: payload.warning,
  };
}

function buildOecTradeSourceUrl(hs4Id: number, limit = 65000) {
  const params = new URLSearchParams({
    cube: "trade_i_baci_a_22",
    drilldowns: "Year,HS4,Exporter Country,Importer Country",
    measures: "Trade Value",
    limit: `${limit},0`,
    include: `HS4:${hs4Id}`,
    time: "Year.latest",
  });
  return `https://api-v2.oec.world/tesseract/data.jsonrecords?${params.toString()}`;
}

export default function MapClient() {
  const [themeKey, setThemeKey] = useState<CommodityKey>("soybean");
  const [compareMode, setCompareMode] = useState(false);
  const [compareKey, setCompareKey] = useState<CommodityKey>("aluminum");
  const [panelLayer, setPanelLayer] = useState<MapLayer>("production");
  const [showProductionLayer, setShowProductionLayer] = useState(true);
  const [showTradeLayer, setShowTradeLayer] = useState(true);
  const [showSiteLayer, setShowSiteLayer] = useState(true);
  const [showPipelineLayer, setShowPipelineLayer] = useState(true);
  const [selectedCountryCode, setSelectedCountryCode] = useState(
    normalizeCountryCode(commodityProfiles.soybean.productionShares[0]?.countryCode)
  );
  const [selectedCountryName, setSelectedCountryName] = useState(commodityProfiles.soybean.productionShares[0]?.country ?? "Brazil");
  const [activeProductionCode, setActiveProductionCode] = useState(
    normalizeCountryCode(commodityProfiles.soybean.productionShares[0]?.countryCode)
  );
  const [activeTradeBubbleId, setActiveTradeBubbleId] = useState(commodityProfiles.soybean.tradeBubbles[0]?.id ?? "");
  const [tradeFlows, setTradeFlows] = useState<CommodityTradeFlow[]>([]);
  const [activeTradeFlowId, setActiveTradeFlowId] = useState("");
  const [tradeFlowYear, setTradeFlowYear] = useState<number | null>(null);
  const flowYears = useMemo(() => {
    const now = new Date().getFullYear();
    return [now - 1, now - 2, now - 3, now - 4, now - 5];
  }, []);
  const [selectedFlowYear, setSelectedFlowYear] = useState<number>(new Date().getFullYear() - 1);
  const [tradeFlowLoading, setTradeFlowLoading] = useState(false);
  const [tradeFlowError, setTradeFlowError] = useState<string | null>(null);
  const [driverSignals, setDriverSignals] = useState<DriverSignal[]>([]);
  const [newsSnapshot, setNewsSnapshot] = useState<CommodityNewsSnapshot | null>(null);
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSnapshot | null>(null);
  const [marketSnapshotLoading, setMarketSnapshotLoading] = useState(false);
  const [marketSnapshotError, setMarketSnapshotError] = useState<string | null>(null);
  const [activeDriverId, setActiveDriverId] = useState("");
  const [driverLoading, setDriverLoading] = useState(false);
  const [driverError, setDriverError] = useState<string | null>(null);
  const [driverNotice, setDriverNotice] = useState<string | null>(null);
  const [snapshotPanelVisible, setSnapshotPanelVisible] = useState(false);
  const [legendPanelVisible, setLegendPanelVisible] = useState(false);
  const [intelPanelVisible, setIntelPanelVisible] = useState(false);
  const [siteKindFilters, setSiteKindFilters] = useState<Record<SiteKindFilter, boolean>>({
    mine: true,
    field: true,
    terminal: true,
    basin: true,
    belt: true,
  });
  const [activeSiteId, setActiveSiteId] = useState(commoditySitePoints.soybean[0]?.id ?? "");
  const [activePipelineId, setActivePipelineId] = useState(pipelineRoutesByCommodity.soybean[0]?.id ?? "");
  const [showPipelineRiskLayer, setShowPipelineRiskLayer] = useState(true);
  const [pipelineYear, setPipelineYear] = useState(new Date().getFullYear());
  const [pipelineRiskFilters, setPipelineRiskFilters] = useState<PipelineRiskFilterState>({
    sanction: true,
    war: true,
    accident: true,
  });
  const [activePipelineRiskEventId, setActivePipelineRiskEventId] = useState("");
  const [intelPanelPosition, setIntelPanelPosition] = useState({ x: 12, y: 320 });
  const sessionPrimaryRef = useRef<CommodityKey>("soybean");
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const intelPanelRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    dragging: boolean;
  } | null>(null);

  const currentTheme = useMemo(() => commodityThemes.find((item) => item.key === themeKey) ?? commodityThemes[0], [themeKey]);
  const currentProfile = commodityProfiles[themeKey];
  const compareProfile = commodityProfiles[compareKey];
  const selectedInsight =
    currentTheme.insights[panelLayer === "trade" && currentTheme.insights.length > 1 ? 1 : 0] ?? currentTheme.insights[0];
  const overlapRegions = sharedRegions(themeKey, compareKey);
  const currentSitePoints = useMemo(() => commoditySitePoints[themeKey] ?? [], [themeKey]);
  const currentPipelineRoutes = useMemo(() => pipelineRoutesByCommodity[themeKey] ?? [], [themeKey]);
  const currentPipelineRiskEvents = useMemo(() => pipelineRiskEventsByCommodity[themeKey] ?? [], [themeKey]);
  const pipelineYearExtent = useMemo(
    () => getPipelineYearExtent(currentPipelineRoutes, currentPipelineRiskEvents),
    [currentPipelineRiskEvents, currentPipelineRoutes]
  );
  const clampedPipelineYear = useMemo(
    () => Math.min(Math.max(pipelineYear, pipelineYearExtent.minYear), pipelineYearExtent.maxYear),
    [pipelineYear, pipelineYearExtent.maxYear, pipelineYearExtent.minYear]
  );
  const pipelineStatusById = useMemo(() => {
    const statusMap: Record<string, "planned" | "active" | "disrupted" | "retired"> = {};
    currentPipelineRoutes.forEach((route) => {
      statusMap[route.id] = getPipelineStatusAtYear(route, clampedPipelineYear);
    });
    return statusMap;
  }, [clampedPipelineYear, currentPipelineRoutes]);
  const visiblePipelineRoutes = useMemo(
    () =>
      currentPipelineRoutes.filter((route) => {
        const status = pipelineStatusById[route.id];
        return status !== "planned";
      }),
    [currentPipelineRoutes, pipelineStatusById]
  );
  const visiblePipelineRiskEvents = useMemo(
    () =>
      currentPipelineRiskEvents.filter((event) => {
        const endYear = event.endYear ?? event.year;
        const inYearRange = clampedPipelineYear >= event.year && clampedPipelineYear <= endYear;
        if (!inYearRange) return false;
        if (!pipelineRiskFilters[event.type]) return false;
        if (!showPipelineLayer || !showPipelineRiskLayer) return false;
        return true;
      }),
    [clampedPipelineYear, currentPipelineRiskEvents, pipelineRiskFilters, showPipelineLayer, showPipelineRiskLayer]
  );
  const activePipelineRoute =
    visiblePipelineRoutes.find((item) => item.id === activePipelineId) ?? visiblePipelineRoutes[0] ?? null;
  const activePipelineRiskEvent =
    visiblePipelineRiskEvents.find((item) => item.id === activePipelineRiskEventId) ?? visiblePipelineRiskEvents[0] ?? null;
  const siteKindCounts = useMemo(
    () => ({
      mine: currentSitePoints.filter((item) => item.kind === "mine").length,
      field: currentSitePoints.filter((item) => item.kind === "field").length,
      terminal: currentSitePoints.filter((item) => item.kind === "terminal").length,
      basin: currentSitePoints.filter((item) => item.kind === "basin").length,
      belt: currentSitePoints.filter((item) => item.kind === "belt").length,
    }),
    [currentSitePoints]
  );
  const visibleSitePoints = useMemo(
    () =>
      currentSitePoints.filter(
        (item) =>
          (item.kind === "mine" && siteKindFilters.mine) ||
          (item.kind === "field" && siteKindFilters.field) ||
          (item.kind === "terminal" && siteKindFilters.terminal) ||
          (item.kind === "basin" && siteKindFilters.basin) ||
          (item.kind === "belt" && siteKindFilters.belt)
      ),
    [currentSitePoints, siteKindFilters.basin, siteKindFilters.belt, siteKindFilters.field, siteKindFilters.mine, siteKindFilters.terminal]
  );
  const activeSitePoint = visibleSitePoints.find((item) => item.id === activeSiteId) ?? visibleSitePoints[0] ?? null;
  const activeSiteSourceUrl = activeSitePoint?.sourceUrl ?? commoditySiteDefaultSources[themeKey];
  const productionRanking = useMemo(
    () => [...currentProfile.productionShares].sort((a, b) => b.share - a.share),
    [currentProfile.productionShares]
  );
  const importRanking = useMemo(
    () =>
      [...currentProfile.tradeBubbles]
        .filter((item) => item.type === "import")
        .sort((a, b) => b.share - a.share)
        .slice(0, 10),
    [currentProfile.tradeBubbles]
  );
  const exportRanking = useMemo(
    () =>
      [...currentProfile.tradeBubbles]
        .filter((item) => item.type === "export")
        .sort((a, b) => b.share - a.share)
        .slice(0, 10),
    [currentProfile.tradeBubbles]
  );
  const productionCountryByCode = useMemo(
    () => new Map(currentProfile.productionShares.map((item) => [normalizeCountryCode(item.countryCode), item.country])),
    [currentProfile.productionShares]
  );
  const selectedCountryKey = normalizeCountryName(selectedCountryName);
  const selectedProductionByCountry =
    currentProfile.productionShares.find(
      (item) =>
        normalizeCountryCode(item.countryCode) === selectedCountryCode || normalizeCountryName(item.country) === selectedCountryKey
    ) ?? null;
  const countryExportOrders = useMemo(
    () => tradeFlows.filter((flow) => normalizeCountryName(flow.exporter) === selectedCountryKey).slice(0, 3),
    [selectedCountryKey, tradeFlows]
  );
  const countryImportOrders = useMemo(
    () => tradeFlows.filter((flow) => normalizeCountryName(flow.importer) === selectedCountryKey).slice(0, 3),
    [selectedCountryKey, tradeFlows]
  );
  const countryExportTotal = countryExportOrders.reduce((sum, flow) => sum + flow.valueUsd, 0);
  const countryImportTotal = countryImportOrders.reduce((sum, flow) => sum + flow.valueUsd, 0);
  const countryTradeTag = [
    importRanking.find((item) => normalizeCountryName(item.country) === selectedCountryKey),
    exportRanking.find((item) => normalizeCountryName(item.country) === selectedCountryKey),
  ]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => `${item.type === "import" ? "進口" : "出口"}占比 ${item.share}%`);
  const countryIntel = COUNTRY_INTEL_BY_COMMODITY[themeKey]?.[selectedCountryKey];
  const leadingCompanies = countryIntel?.companies ?? FALLBACK_COMPANIES[themeKey];

  const activeProduction = productionRanking.find((item) => normalizeCountryCode(item.countryCode) === activeProductionCode);
  const activeTrade =
    currentProfile.tradeBubbles.find((item) => item.id === activeTradeBubbleId) ??
    importRanking[0] ??
    exportRanking[0] ??
    null;
  const activeTradeFlow = tradeFlows.find((item) => item.id === activeTradeFlowId) ?? tradeFlows[0] ?? null;
  const activeDriver = driverSignals.find((item) => item.id === activeDriverId) ?? driverSignals[0] ?? null;
  const topKeywordCount = newsSnapshot?.keywords[0]?.count ?? 1;
  const snapshotCards = [
    {
      label: "Benchmark",
      value: marketSnapshot ? `${marketSnapshot.benchmark} · ${marketSnapshot.symbol}` : currentProfile.benchmark,
      note: "合約基準",
    },
    {
      label: "Latest",
      value: marketSnapshot?.latest ?? (marketSnapshotLoading ? "Loading..." : currentProfile.latestPrice),
      note: "最新日收盤",
    },
    {
      label: "YTD",
      value: marketSnapshot?.ytd ?? (marketSnapshotLoading ? "Loading..." : currentProfile.ytdChange),
      note: "年初至今",
    },
    {
      label: "Volatility",
      value: marketSnapshot?.volatility ?? (marketSnapshotLoading ? "Loading..." : currentProfile.volatility),
      note: "1Y 年化",
    },
  ];
  const keyRiskDriver = useMemo(() => {
    return [...driverSignals]
      .filter((signal) => signal.direction !== "neutral")
      .sort((a, b) => parseDriverScoreMagnitude(b.scoreLabel) - parseDriverScoreMagnitude(a.scoreLabel))[0] ?? null;
  }, [driverSignals]);
  const marketAlertTone = keyRiskDriver?.direction === "positive" ? "bullish" : keyRiskDriver?.direction === "negative" ? "bearish" : "neutral";
  const marketAlertTitle = marketAlertTone === "bullish" ? "Tightness Risk - Active" : marketAlertTone === "bearish" ? "Demand Softness - Active" : "Market Signal - Monitoring";
  const keyTradeRoute = tradeFlows[0] ?? null;
  const topProductionShare = productionRanking[0]?.share ?? 1;
  const hs4Id = HS4_BY_COMMODITY[themeKey];
  const productionSourceUrl = "https://www.fao.org/faostat/en/#data/QCL";
  const tradeListSourceUrl = buildOecTradeSourceUrl(hs4Id, 65000);
  const tradeFlowSourceUrl = buildOecTradeSourceUrl(hs4Id, 65000);
  const yahooSymbol = currentProfile.futuresSymbols[0];
  const klineYahooSourceUrl = yahooSymbol
    ? `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbol)}/history?p=${encodeURIComponent(yahooSymbol)}`
    : "https://finance.yahoo.com/markets/commodities/";
  const klineTradingViewSourceUrl = "https://www.tradingview.com/markets/futures/world-commodities/";

  const clampIntelPanelPosition = useCallback((x: number, y: number) => {
    const viewportRect = mapViewportRef.current?.getBoundingClientRect();
    const panelRect = intelPanelRef.current?.getBoundingClientRect();
    if (!viewportRect || !panelRect) return { x, y };

    const padding = 8;
    const maxX = Math.max(padding, viewportRect.width - panelRect.width - padding);
    const maxY = Math.max(padding, viewportRect.height - panelRect.height - padding);
    return {
      x: Math.min(Math.max(padding, x), maxX),
      y: Math.min(Math.max(padding, y), maxY),
    };
  }, []);

  useEffect(() => {
    const startedAt = Date.now();
    const sessionPrimary = sessionPrimaryRef.current;
    void trackEvent("map_view", { commodity: sessionPrimary });

    return () => {
      const dwellSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      void trackEvent("map_dwell", { commodity: sessionPrimary, dwellSeconds });
    };
  }, []);

  function onSelectPrimary(nextKey: CommodityKey) {
    const nextCompareKey = compareKey === nextKey ? firstDifferentKey(nextKey) : compareKey;
    const nextDefaultCode = normalizeCountryCode(commodityProfiles[nextKey].productionShares[0]?.countryCode);
    const nextDefaultCountry = commodityProfiles[nextKey].productionShares[0]?.country ?? "";
    const nextFirstVisibleSite =
      (commoditySitePoints[nextKey] ?? []).find(
        (site) =>
          (site.kind === "mine" && siteKindFilters.mine) ||
          (site.kind === "field" && siteKindFilters.field) ||
          (site.kind === "terminal" && siteKindFilters.terminal) ||
          (site.kind === "basin" && siteKindFilters.basin) ||
          (site.kind === "belt" && siteKindFilters.belt)
      ) ?? null;
    const nextPipelineRoutes = pipelineRoutesByCommodity[nextKey] ?? [];
    const nextPipelineRoute =
      nextPipelineRoutes.find((route) => getPipelineStatusAtYear(route, clampedPipelineYear) !== "planned") ??
      nextPipelineRoutes[0] ??
      null;
    const nextRiskEvent =
      (pipelineRiskEventsByCommodity[nextKey] ?? []).find((event) => {
        const endYear = event.endYear ?? event.year;
        return clampedPipelineYear >= event.year && clampedPipelineYear <= endYear;
      }) ?? null;
    setThemeKey(nextKey);
    setCompareKey(nextCompareKey);
    setActiveProductionCode(nextDefaultCode);
    setSelectedCountryCode(nextDefaultCode);
    setSelectedCountryName(nextDefaultCountry);
    setActiveTradeBubbleId(commodityProfiles[nextKey].tradeBubbles[0]?.id ?? "");
    setActiveSiteId(nextFirstVisibleSite?.id ?? "");
    setActivePipelineId(nextPipelineRoute?.id ?? "");
    setActivePipelineRiskEventId(nextRiskEvent?.id ?? "");
    void trackEvent("map_theme_change", { commodity: nextKey, compareMode, secondary: nextCompareKey });
  }

  function onSelectProductionCountry(code: string) {
    setActiveProductionCode(code);
    setSelectedCountryCode(code);
    const matchedCountry = productionCountryByCode.get(code);
    if (matchedCountry) {
      setSelectedCountryName(matchedCountry);
    }
    setPanelLayer("production");
    setIntelPanelVisible(true);
  }

  function onSelectTradeBubble(id: string) {
    setActiveTradeBubbleId(id);
    const bubble = currentProfile.tradeBubbles.find((item) => item.id === id);
    if (bubble) {
      setSelectedCountryName(bubble.country);
      const matchedProduction = currentProfile.productionShares.find(
        (item) => normalizeCountryName(item.country) === normalizeCountryName(bubble.country)
      );
      if (matchedProduction) {
        setSelectedCountryCode(normalizeCountryCode(matchedProduction.countryCode));
      }
    }
    setPanelLayer("trade");
    setIntelPanelVisible(true);
  }

  function onSelectTradeFlow(id: string) {
    setActiveTradeFlowId(id);
    const flow = tradeFlows.find((item) => item.id === id);
    if (flow) {
      setSelectedCountryName(flow.importer);
    }
    setPanelLayer("trade");
    setIntelPanelVisible(true);
  }

  function onMapCountryClick(countryCode: string, countryName?: string) {
    setSelectedCountryCode(countryCode);
    if (countryName) {
      setSelectedCountryName(countryName);
      setIntelPanelVisible(true);
      return;
    }
    const matchedCountry = productionCountryByCode.get(countryCode);
    if (matchedCountry) {
      setSelectedCountryName(matchedCountry);
      setIntelPanelVisible(true);
      return;
    }
    setSelectedCountryName(`Country ${countryCode}`);
    setIntelPanelVisible(true);
  }

  function onIntelPanelPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: intelPanelPosition.x,
      originY: intelPanelPosition.y,
      dragging: true,
    };
  }

  function onIntelPanelPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || !dragState.dragging || dragState.pointerId !== event.pointerId) return;
    event.preventDefault();
    const nextX = dragState.originX + (event.clientX - dragState.startX);
    const nextY = dragState.originY + (event.clientY - dragState.startY);
    setIntelPanelPosition(clampIntelPanelPosition(nextX, nextY));
  }

  function onIntelPanelPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      setIntelPanelPosition((previous) => clampIntelPanelPosition(previous.x, previous.y));
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [clampIntelPanelPosition]);

  useEffect(() => {
    if (!intelPanelVisible) return;
    const id = window.requestAnimationFrame(() => {
      setIntelPanelPosition((previous) => clampIntelPanelPosition(previous.x, previous.y));
    });
    return () => window.cancelAnimationFrame(id);
  }, [clampIntelPanelPosition, intelPanelVisible]);

  function toggleProductionLayer() {
    const next = !showProductionLayer;
    setShowProductionLayer(next);
    setPanelLayer("production");
    void trackEvent("map_layer_visibility_change", { commodity: themeKey, layer: "production", visible: next });
  }

  function toggleTradeLayer() {
    const next = !showTradeLayer;
    setShowTradeLayer(next);
    setPanelLayer("trade");
    void trackEvent("map_layer_visibility_change", { commodity: themeKey, layer: "trade", visible: next });
  }

  function toggleSiteLayer() {
    const next = !showSiteLayer;
    setShowSiteLayer(next);
    void trackEvent("map_layer_visibility_change", { commodity: themeKey, layer: "sites", visible: next });
  }

  function togglePipelineLayer() {
    const next = !showPipelineLayer;
    setShowPipelineLayer(next);
    void trackEvent("map_layer_visibility_change", { commodity: themeKey, layer: "pipeline", visible: next });
  }

  function togglePipelineRiskLayer() {
    const next = !showPipelineRiskLayer;
    setShowPipelineRiskLayer(next);
    void trackEvent("map_layer_visibility_change", { commodity: themeKey, layer: "pipeline_risk", visible: next });
  }

  function toggleSiteKind(kind: SiteKindFilter) {
    setSiteKindFilters((previous) => {
      const next = { ...previous, [kind]: !previous[kind] };
      if (!next.mine && !next.field && !next.terminal && !next.basin && !next.belt) return previous;
      return next;
    });
  }

  function togglePipelineRiskType(type: PipelineRiskType) {
    setPipelineRiskFilters((previous) => {
      const next = { ...previous, [type]: !previous[type] };
      if (!next.sanction && !next.war && !next.accident) return previous;
      return next;
    });
  }

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();

    async function loadTradeFlows() {
      setTradeFlowLoading(true);
      setTradeFlowError(null);

      try {
        const response = await fetch(
          `/api/trade/flows?commodity=${encodeURIComponent(themeKey)}&year=${selectedFlowYear}&limit=18`,
          {
          signal: controller.signal,
          }
        );
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          year?: number;
          flows?: CommodityTradeFlow[];
        };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Trade flow unavailable");
        }
        if (aborted) return;

        const flows = payload.flows ?? [];
        setTradeFlows(flows);
        setTradeFlowYear(payload.year ?? null);
        setActiveTradeFlowId(flows[0]?.id ?? "");
      } catch (error) {
        if (aborted) return;
        setTradeFlows([]);
        setActiveTradeFlowId("");
        setTradeFlowError(error instanceof Error ? error.message : "Trade flow unavailable");
      } finally {
        if (!aborted) {
          setTradeFlowLoading(false);
        }
      }
    }

    void loadTradeFlows();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [selectedFlowYear, themeKey]);

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();

    async function loadMarketSnapshot() {
      setMarketSnapshotLoading(true);
      setMarketSnapshotError(null);

      if (currentProfile.futuresSymbols.length === 0) {
        setMarketSnapshot(null);
        setMarketSnapshotError("此商品目前沒有可公開抓取的即時市場 symbol。");
        setMarketSnapshotLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/market/candles?commodity=${encodeURIComponent(themeKey)}&range=1y&interval=1d`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as MarketSnapshotApiResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Market snapshot unavailable");
        }
        if (aborted) return;
        const snapshot = buildMarketSnapshot(themeKey, currentProfile, payload);
        if (!snapshot) {
          throw new Error("Market snapshot empty");
        }
        setMarketSnapshot(snapshot);
      } catch (error) {
        if (aborted) return;
        setMarketSnapshot(null);
        setMarketSnapshotError(error instanceof Error ? error.message : "Market snapshot unavailable");
      } finally {
        if (!aborted) setMarketSnapshotLoading(false);
      }
    }

    void loadMarketSnapshot();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [currentProfile, themeKey]);

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();

    async function loadDriverSignals() {
      setDriverLoading(true);
      setDriverError(null);
      setDriverNotice(null);

      try {
        const response = await fetch(`/api/market/drivers?commodity=${encodeURIComponent(themeKey)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as DriverSignalResponse;

        if (!response.ok || !payload.ok || !payload.signals?.length) {
          const fallbackMessage = payload.error ?? "Driver data unavailable";
          throw new Error(fallbackMessage);
        }
        if (aborted) return;

        const signals = payload.signals;
        setNewsSnapshot(payload.newsSnapshot ?? null);
        setDriverSignals(signals);
        setActiveDriverId((previous) => (signals.some((item) => item.id === previous) ? previous : (signals[0]?.id ?? "")));
        if (payload.warning) {
          setDriverNotice(payload.warning);
        }
      } catch (error) {
        if (aborted) return;
        setNewsSnapshot(null);
        setDriverSignals([]);
        setActiveDriverId("");
        setDriverNotice(null);
        setDriverError(error instanceof Error ? error.message : "Driver data unavailable");
      } finally {
        if (!aborted) setDriverLoading(false);
      }
    }

    void loadDriverSignals();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [themeKey]);

  return (
    <div className="maphouse-shell min-h-screen px-6 py-8 md:px-10">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
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
          <div className="flex gap-3 text-sm text-[var(--muted)]">
            <Link href="/" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2">
              Home
            </Link>
            <Link href="/topics" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2">
              Topics
            </Link>
            <Link href="/about" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2">
              About
            </Link>
          </div>
        </header>

        <section className="paper-card p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Interactive Map</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl">Global Commodity Intelligence Desk</h1>
          <p className="mt-2 max-w-4xl text-[var(--muted)]">
            以地圖為核心的商品研究頁。除了單一商品檢視，現在可啟用 Compare 模式同時比較兩個商品的價格脈絡、產區重疊與風險差異。
          </p>
        </section>

        <section className="paper-card p-3 md:p-4">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr),auto]">
            <div className="space-y-2">
              {commoditySections.map((section) => (
                <div key={section.id} className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-[10px] border px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-white"
                    style={{
                      borderColor: SECTION_HEADER_STYLES[section.id].border,
                      backgroundImage: `linear-gradient(135deg, ${SECTION_HEADER_STYLES[section.id].from} 0%, ${SECTION_HEADER_STYLES[section.id].to} 100%)`,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 12px ${SECTION_HEADER_STYLES[section.id].shadow}`,
                    }}
                  >
                    {section.label}
                  </span>
                  {section.keys.map((key) => (
                    <button
                      key={key}
                      onClick={() => onSelectPrimary(key)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium tracking-[0.08em] transition ${
                        key === themeKey
                          ? "border-[var(--brand-ink)] bg-[var(--brand-ink)] text-white"
                          : "border-[var(--line)] bg-white/75 text-[var(--muted)] hover:bg-white"
                      }`}
                    >
                      {commodityProfiles[key].zhName}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                const next = !compareMode;
                setCompareMode(next);
                void trackEvent("map_compare_toggle", { enabled: next, primary: themeKey, secondary: compareKey });
              }}
              className={`h-fit shrink-0 rounded-full border px-3 py-1.5 text-xs tracking-[0.08em] ${
                compareMode ? "border-[var(--brand-ink)] bg-[var(--brand-ink)] text-white" : "border-[var(--line)] bg-white/75"
              }`}
            >
              Compare {compareMode ? "On" : "Off"}
            </button>
          </div>

          {compareMode ? (
            <div className="mt-3 flex gap-2 overflow-x-auto whitespace-nowrap">
              {commodityThemes
                .filter((theme) => theme.key !== themeKey)
                .map((theme) => (
                  <button
                    key={`compare-${theme.key}`}
                    onClick={() => {
                      setCompareKey(theme.key);
                      void trackEvent("map_compare_select", { primary: themeKey, secondary: theme.key });
                    }}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs tracking-[0.08em] ${
                      theme.key === compareKey
                        ? "border-[var(--olive)] bg-[var(--olive)] text-white"
                        : "border-[var(--line)] bg-white/75 text-[var(--muted)] hover:bg-white"
                    }`}
                  >
                    對照：{commodityProfiles[theme.key].zhName}
                  </button>
                ))}
            </div>
          ) : null}
        </section>

        <section className="paper-card p-4 md:p-5">
          <div className="flex gap-3 overflow-x-auto pb-1 md:overflow-visible">
            {snapshotCards.map(({ label, value, note }) => (
              <div
                key={label}
                className="min-h-[90px] min-w-[168px] shrink-0 rounded-xl border border-[var(--line)] bg-white/82 px-4 py-3 md:min-w-0 md:flex-1"
              >
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted)] md:text-[11px]">{label}</p>
                    <p className="mt-1 text-[10px] text-[var(--muted)]">{note}</p>
                  </div>
                  <p className="mt-2 text-lg font-semibold leading-tight text-[var(--brand-ink)] md:text-xl">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
            {marketSnapshot ? (
              <>
                <span>市場資料：{marketSnapshot.source}</span>
                <span>Symbol：{marketSnapshot.symbol}</span>
                <span>更新：{new Date(marketSnapshot.updatedAt).toLocaleString("zh-TW")}</span>
                {marketSnapshot.stale ? <span>暫用快取</span> : null}
              </>
            ) : (
              <span>
                市場資料：{marketSnapshotError ? `暫無即時資料（${marketSnapshotError}）` : "讀取中"}
              </span>
            )}
          </div>

          <div
            className={`mt-3 rounded-xl border px-4 py-2.5 text-sm ${
              marketAlertTone === "bullish"
                ? "border-[rgb(197_93_83_/_45%)] bg-[linear-gradient(90deg,rgba(197,93,83,0.14),rgba(197,93,83,0.05))] text-[#8c332d]"
                : marketAlertTone === "bearish"
                  ? "border-[rgb(68_128_83_/_45%)] bg-[linear-gradient(90deg,rgba(68,128,83,0.14),rgba(68,128,83,0.05))] text-[#2e6d46]"
                  : "border-[var(--line)] bg-white/75 text-[var(--muted)]"
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{marketAlertTitle}</span>
            <span className="ml-2 text-xs md:text-sm">
              {keyRiskDriver
                ? `${keyRiskDriver.label} ${keyRiskDriver.scoreLabel} · ${keyRiskDriver.direction === "positive" ? "正向" : "負向"}`
                : "尚無足夠 driver 訊號"}
              {keyTradeRoute ? ` · Top Flow: ${keyTradeRoute.exporter} → ${keyTradeRoute.importer} ${formatUsdCompact(keyTradeRoute.valueUsd)}` : ""}
            </span>
          </div>

          <div className="mt-3">
            <div ref={mapViewportRef} className="relative">
              <CommodityWorldMap
                showProductionLayer={showProductionLayer}
                showTradeLayer={showTradeLayer}
                showSiteLayer={showSiteLayer}
                showPipelineLayer={showPipelineLayer}
                productionData={currentProfile.productionShares}
                activeProductionCode={activeProductionCode}
                onSelectProductionCountry={onSelectProductionCountry}
                onCountryClick={onMapCountryClick}
                tradeBubbles={currentProfile.tradeBubbles}
                activeTradeBubbleId={activeTradeBubbleId}
                onSelectTradeBubble={onSelectTradeBubble}
                tradeFlows={tradeFlows}
                activeTradeFlowId={activeTradeFlowId}
                onSelectTradeFlow={onSelectTradeFlow}
                sitePoints={visibleSitePoints}
                activeSiteId={activeSitePoint?.id}
                onSelectSite={(id) => {
                  setActiveSiteId(id);
                  const site = currentSitePoints.find((item) => item.id === id);
                  if (site) {
                    setSelectedCountryName(site.country);
                    setIntelPanelVisible(true);
                  }
                }}
                pipelineRoutes={visiblePipelineRoutes}
                pipelineStatusById={pipelineStatusById}
                activePipelineId={activePipelineRoute?.id}
                onSelectPipeline={(id) => setActivePipelineId(id)}
                pipelineRiskEvents={visiblePipelineRiskEvents}
                activePipelineRiskEventId={activePipelineRiskEvent?.id}
                onSelectPipelineRiskEvent={(id) => {
                  setActivePipelineRiskEventId(id);
                  const riskEvent = visiblePipelineRiskEvents.find((item) => item.id === id);
                  if (riskEvent) {
                    const route = currentPipelineRoutes.find((item) => riskEvent.routeIds.includes(item.id));
                    if (route) setActivePipelineId(route.id);
                  }
                }}
              />

              {intelPanelVisible ? (
                <article
                  ref={intelPanelRef}
                  className="absolute z-20 w-[320px] max-w-[calc(100%-1rem)] rounded-2xl border border-[var(--line)] bg-[rgb(248_251_243_/_88%)] p-3 shadow-[0_10px_30px_rgb(10_21_38_/_12%)] backdrop-blur-sm"
                  style={{ left: `${intelPanelPosition.x}px`, top: `${intelPanelPosition.y}px` }}
                >
                  <div
                    className="flex items-start justify-between gap-2 select-none touch-none"
                    onPointerDown={onIntelPanelPointerDown}
                    onPointerMove={onIntelPanelPointerMove}
                    onPointerUp={onIntelPanelPointerUp}
                    onPointerCancel={onIntelPanelPointerUp}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Country Desk</p>
                      <h4 className="mt-1 truncate text-base font-semibold text-[var(--brand-ink)]">{selectedCountryName}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-[var(--line)] bg-white/80 px-2 py-0.5 text-[10px] text-[var(--muted)]">
                        Drag
                      </span>
                      <button
                        type="button"
                        aria-label="Close country panel"
                        onClick={() => setIntelPanelVisible(false)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] bg-white/85 text-sm text-[var(--muted)] transition hover:bg-white"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-[var(--line)] bg-white/80 px-2.5 py-2">
                      <p className="uppercase tracking-[0.12em] text-[var(--muted)]">產出</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--brand-ink)]">
                        {selectedProductionByCountry ? `${selectedProductionByCountry.share}%` : "N/A"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] bg-white/80 px-2.5 py-2">
                      <p className="uppercase tracking-[0.12em] text-[var(--muted)]">淨流向</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--brand-ink)]">
                        {countryExportTotal || countryImportTotal
                          ? formatUsdCompact(countryExportTotal - countryImportTotal)
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {countryTradeTag.length ? (
                      countryTradeTag.map((tag) => (
                        <span key={tag} className="rounded-full border border-[var(--line)] bg-white/85 px-2 py-0.5 text-[10px] text-[var(--muted)]">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-[var(--line)] bg-white/85 px-2 py-0.5 text-[10px] text-[var(--muted)]">
                        尚無主要進出口占比資料
                      </span>
                    )}
                  </div>

                  <div className="mt-2 rounded-lg border border-[var(--line)] bg-white/80 px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">主導企業</p>
                    <p className="mt-1 text-xs leading-6 text-[var(--foreground)]">{leadingCompanies.slice(0, 3).join(" · ")}</p>
                    {countryIntel?.positioning ? (
                      <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{countryIntel.positioning}</p>
                    ) : null}
                  </div>

                  <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                    <div className="rounded-lg border border-[rgb(75_139_94_/_35%)] bg-[rgb(75_139_94_/_8%)] px-2.5 py-2">
                      <p className="uppercase tracking-[0.12em] text-[#2b6a3f]">出口訂單</p>
                      {countryExportOrders.length ? (
                        <p className="mt-1 leading-6 text-[var(--foreground)]">
                          {countryExportOrders
                            .map((item) => `${item.importer} ${formatUsdCompact(item.valueUsd)}`)
                            .join(" / ")}
                        </p>
                      ) : (
                        <p className="mt-1 leading-6 text-[var(--muted)]">暫無主要出口流資料</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-[rgb(203_89_83_/_35%)] bg-[rgb(203_89_83_/_8%)] px-2.5 py-2">
                      <p className="uppercase tracking-[0.12em] text-[#8b2f2a]">進口訂單</p>
                      {countryImportOrders.length ? (
                        <p className="mt-1 leading-6 text-[var(--foreground)]">
                          {countryImportOrders
                            .map((item) => `${item.exporter} ${formatUsdCompact(item.valueUsd)}`)
                            .join(" / ")}
                        </p>
                      ) : (
                        <p className="mt-1 leading-6 text-[var(--muted)]">暫無主要進口流資料</p>
                      )}
                    </div>
                  </div>
                </article>
              ) : null}

              <aside
                className={`absolute top-3 right-3 z-20 w-[360px] max-w-[calc(100%-1.5rem)] max-h-[calc(100%-4.6rem)] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[rgb(248_251_243_/_92%)] p-4 shadow-[0_12px_32px_rgb(10_21_38_/_16%)] backdrop-blur-sm transition ${
                  snapshotPanelVisible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Commodity Snapshot</p>
                    <h2 className="mt-1 truncate font-[family-name:var(--font-display)] text-3xl">{currentProfile.zhName}</h2>
                    <p className="text-sm text-[var(--muted)]">{currentProfile.enName}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close commodity snapshot"
                    onClick={() => setSnapshotPanelVisible(false)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/90 text-sm text-[var(--muted)] transition hover:bg-white"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{currentProfile.intro}</p>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {snapshotCards.map((item) => (
                    <div key={`panel-${item.label}`} className="rounded-lg border border-[var(--line)] bg-white/82 px-2.5 py-2">
                      <p className="uppercase tracking-[0.11em] text-[var(--muted)]">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--brand-ink)]">{item.value}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">{item.note}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">
                  {marketSnapshot
                    ? `市場資料：${marketSnapshot.source} · ${marketSnapshot.symbol} · ${new Date(
                        marketSnapshot.updatedAt,
                      ).toLocaleString("zh-TW")}`
                    : `市場資料：${marketSnapshotError ?? "讀取中"}`}
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPanelLayer("production")}
                    className={`rounded-full border px-3 py-1.5 text-[11px] tracking-[0.12em] ${
                      panelLayer === "production"
                        ? "border-[#4a7144] bg-[rgb(74_113_68_/_14%)]"
                        : "border-[var(--line)] bg-white/75 text-[var(--muted)]"
                    }`}
                  >
                    查看主要產國（Top Share）
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelLayer("trade")}
                    className={`rounded-full border px-3 py-1.5 text-[11px] tracking-[0.12em] ${
                      panelLayer === "trade"
                        ? "border-[#4b8b5e] bg-[rgb(75_139_94_/_14%)]"
                        : "border-[var(--line)] bg-white/75 text-[var(--muted)]"
                    }`}
                  >
                    查看貿易清單
                  </button>
                </div>

                {panelLayer === "production" ? (
                  <div className="mt-4 space-y-2">
                    {productionRanking.map((item, index) => {
                      const isActive = normalizeCountryCode(item.countryCode) === activeProductionCode;
                      const barWidth = Math.max(8, Math.round((item.share / topProductionShare) * 100));
                      return (
                        <button
                          key={`${item.countryCode}-${item.country}`}
                          type="button"
                          onClick={() => onSelectProductionCountry(normalizeCountryCode(item.countryCode))}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                            isActive
                              ? "border-[#4a7144] bg-[rgb(74_113_68_/_11%)]"
                              : "border-[var(--line)] bg-white/75 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              {index + 1}. {item.country}
                            </span>
                            <span className="font-semibold text-[var(--brand-ink)]">{item.share}%</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-[#d5dfc8]">
                            <div className="h-full rounded-full bg-[#4a7144]" style={{ width: `${barWidth}%` }} />
                          </div>
                        </button>
                      );
                    })}
                    <p className="px-1 text-[11px] text-[var(--muted)]">
                      註：此區呈現主要產國占比（非全球完整 100% 國家清單）。
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3">
                    <article className="rounded-xl border border-[rgb(203_89_83_/_35%)] bg-[rgb(203_89_83_/_7%)] p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-[#8b2f2a]">Top 10 Importers</p>
                      <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1">
                        {importRanking.map((item, index) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelectTradeBubble(item.id)}
                            className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition ${
                              activeTrade?.id === item.id ? "bg-[rgb(203_89_83_/_20%)] font-medium" : "hover:bg-white/75"
                            }`}
                          >
                            <span>
                              {index + 1}. {item.country}
                            </span>
                            <span className="font-semibold">{item.share}%</span>
                          </button>
                        ))}
                      </div>
                    </article>

                    <article className="rounded-xl border border-[rgb(75_139_94_/_35%)] bg-[rgb(75_139_94_/_7%)] p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-[#2b6a3f]">Top 10 Exporters</p>
                      <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1">
                        {exportRanking.map((item, index) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelectTradeBubble(item.id)}
                            className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition ${
                              activeTrade?.id === item.id ? "bg-[rgb(75_139_94_/_20%)] font-medium" : "hover:bg-white/75"
                            }`}
                          >
                            <span>
                              {index + 1}. {item.country}
                            </span>
                            <span className="font-semibold">{item.share}%</span>
                          </button>
                        ))}
                      </div>
                    </article>

                    <article className="rounded-xl border border-[var(--line)] bg-white/80 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Trade Flow Map</p>
                      <p className="mt-1 text-[11px] text-[var(--muted)]">{tradeFlowYear ? `${tradeFlowYear} bilateral flows` : "Bilateral flows"}</p>
                      <div className="mt-2 rounded-lg border border-[var(--line)] bg-white/88 px-2.5 py-2">
                        <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                          <span>Time Slider (5Y)</span>
                          <span>{selectedFlowYear}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={flowYears.length - 1}
                          step={1}
                          value={Math.max(0, flowYears.indexOf(selectedFlowYear))}
                          onChange={(event) => {
                            const next = flowYears[Number(event.target.value)] ?? flowYears[0];
                            setSelectedFlowYear(next);
                          }}
                          className="mt-1.5 w-full accent-[var(--brand-ink)]"
                        />
                        <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--muted)]">
                          {flowYears.map((year) => (
                            <button
                              key={`flow-year-${year}`}
                              type="button"
                              onClick={() => setSelectedFlowYear(year)}
                              className={`rounded-full px-1.5 py-0.5 transition ${
                                year === selectedFlowYear ? "bg-[var(--brand-ink)] text-white" : "hover:bg-[#eef3e6]"
                              }`}
                            >
                              {String(year).slice(2)}
                            </button>
                          ))}
                        </div>
                      </div>
                      {tradeFlowLoading ? <p className="mt-2 text-sm text-[var(--muted)]">載入中...</p> : null}
                      {tradeFlowError ? <p className="mt-2 text-sm text-[#8b2f2a]">{tradeFlowError}</p> : null}
                      {!tradeFlowLoading && !tradeFlowError ? (
                        <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                          {tradeFlows.slice(0, 10).map((flow, index) => (
                            <button
                              key={flow.id}
                              type="button"
                              onClick={() => onSelectTradeFlow(flow.id)}
                              className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition ${
                                activeTradeFlow?.id === flow.id
                                  ? "bg-[rgb(31_53_74_/_14%)] font-medium"
                                  : "hover:bg-[rgb(31_53_74_/_7%)]"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">
                                  {index + 1}. {flow.exporter} → {flow.importer}
                                </span>
                                <span className="shrink-0 font-semibold">{formatUsdCompact(flow.valueUsd)}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-[var(--line)] bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Focus Insight</p>
                  {panelLayer === "production" && activeProduction ? (
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      {activeProduction.country} 目前占全球 {currentProfile.zhName} 產量約 {activeProduction.share}% ，是供給結構的重要權重國家。
                    </p>
                  ) : null}
                  {panelLayer === "trade" && activeTrade ? (
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      {activeTrade.country} 屬於{activeTrade.type === "import" ? "進口" : "出口"}前段國家，貿易占比約 {activeTrade.share}%。
                    </p>
                  ) : null}
                  {panelLayer === "trade" && activeTradeFlow ? (
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      主要商品流向：{activeTradeFlow.exporter} → {activeTradeFlow.importer}，流量約 {formatUsdCompact(activeTradeFlow.valueUsd)}。
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{currentProfile.mapBrief}</p>
                </div>
              </aside>

              <aside
                className={`absolute right-3 bottom-14 z-30 w-[238px] max-w-[calc(100%-1.5rem)] rounded-2xl border border-[var(--line)] bg-[rgb(248_251_243_/_92%)] p-3 shadow-[0_10px_28px_rgb(10_21_38_/_14%)] backdrop-blur-sm transition ${
                  legendPanelVisible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Layers & Legend</p>
                  <button
                    type="button"
                    aria-label="Close legend panel"
                    onClick={() => setLegendPanelVisible(false)}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--line)] bg-white/85 text-xs text-[var(--muted)] transition hover:bg-white"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  <button
                    type="button"
                    onClick={toggleProductionLayer}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                      showProductionLayer
                        ? "border-[#4a7144] bg-[rgb(74_113_68_/_12%)] text-[#315938]"
                        : "border-[var(--line)] bg-white/80 text-[var(--muted)]"
                    }`}
                  >
                    <span>Production Choropleth</span>
                    <span className="font-semibold">{showProductionLayer ? "ON" : "OFF"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleTradeLayer}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                      showTradeLayer
                        ? "border-[#4b8b5e] bg-[rgb(75_139_94_/_12%)] text-[#2f6942]"
                        : "border-[var(--line)] bg-white/80 text-[var(--muted)]"
                    }`}
                  >
                    <span>Trade Bubbles + Flow</span>
                    <span className="font-semibold">{showTradeLayer ? "ON" : "OFF"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleSiteLayer}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                      showSiteLayer
                        ? "border-[#7b6f3d] bg-[rgb(170_145_84_/_12%)] text-[#655227]"
                        : "border-[var(--line)] bg-white/80 text-[var(--muted)]"
                    }`}
                  >
                    <span>Production Sites</span>
                    <span className="font-semibold">{showSiteLayer ? "ON" : "OFF"}</span>
                  </button>
                  {currentPipelineRoutes.length ? (
                    <button
                      type="button"
                      onClick={togglePipelineLayer}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                        showPipelineLayer
                          ? "border-[#ff9a1f] bg-[rgb(255_154_31_/_12%)] text-[#8a4b0e]"
                          : "border-[var(--line)] bg-white/80 text-[var(--muted)]"
                      }`}
                    >
                      <span>Pipeline Routes</span>
                      <span className="font-semibold">{showPipelineLayer ? "ON" : "OFF"}</span>
                    </button>
                  ) : null}
                  {currentPipelineRiskEvents.length ? (
                    <button
                      type="button"
                      onClick={togglePipelineRiskLayer}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                        showPipelineRiskLayer
                          ? "border-[#d66660] bg-[rgb(214_102_96_/_12%)] text-[#8f3d37]"
                          : "border-[var(--line)] bg-white/80 text-[var(--muted)]"
                      }`}
                    >
                      <span>Risk Events</span>
                      <span className="font-semibold">{showPipelineRiskLayer ? "ON" : "OFF"}</span>
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/82 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Site Filter</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(
                      [
                        { key: "mine", label: "Mine", count: siteKindCounts.mine },
                        { key: "field", label: "Field", count: siteKindCounts.field },
                        { key: "terminal", label: "Terminal", count: siteKindCounts.terminal },
                        { key: "basin", label: "Basin", count: siteKindCounts.basin },
                        { key: "belt", label: "Belt", count: siteKindCounts.belt },
                      ] as const
                    ).map((item) => (
                      <button
                        key={`site-kind-${item.key}`}
                        type="button"
                        onClick={() => toggleSiteKind(item.key)}
                        className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                          siteKindFilters[item.key]
                            ? "border-[var(--brand-ink)] bg-[var(--brand-ink)] text-white"
                            : "border-[var(--line)] bg-white text-[var(--muted)]"
                        }`}
                      >
                        {item.label} {item.count}
                      </button>
                    ))}
                  </div>
                </div>

                {currentPipelineRoutes.length ? (
                  <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/82 px-2.5 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Pipeline Timeline</p>
                      <span className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[10px] text-[var(--brand-ink)]">
                        {clampedPipelineYear}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={pipelineYearExtent.minYear}
                      max={pipelineYearExtent.maxYear}
                      step={1}
                      value={clampedPipelineYear}
                      onChange={(event) => setPipelineYear(Number(event.target.value))}
                      className="mt-1.5 w-full accent-[var(--brand-ink)]"
                    />
                    <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--muted)]">
                      <span>{pipelineYearExtent.minYear}</span>
                      <span>{pipelineYearExtent.maxYear}</span>
                    </div>
                  </div>
                ) : null}

                {currentPipelineRiskEvents.length ? (
                  <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/82 px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Risk Filter</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(
                        [
                          { key: "sanction", label: "Sanction" },
                          { key: "war", label: "War" },
                          { key: "accident", label: "Accident" },
                        ] as const
                      ).map((item) => (
                        <button
                          key={`risk-type-${item.key}`}
                          type="button"
                          onClick={() => togglePipelineRiskType(item.key)}
                          className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                            pipelineRiskFilters[item.key]
                              ? item.key === "sanction"
                                ? "border-[#8d6cff] bg-[rgb(141_108_255_/_16%)] text-[#5a45bc]"
                                : item.key === "war"
                                  ? "border-[#ff6f7d] bg-[rgb(255_111_125_/_16%)] text-[#a73b46]"
                                  : "border-[#ff9348] bg-[rgb(255_147_72_/_16%)] text-[#aa5e21]"
                              : "border-[var(--line)] bg-white text-[var(--muted)]"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 text-[11px] text-[var(--muted)]">
                  <p className="font-semibold tracking-[0.12em]">Map Stats</p>
                  <p>時間軸年份：{clampedPipelineYear}</p>
                  <p className="mt-1">產量國家：{productionRanking.length}</p>
                  <p>前十大進口：{importRanking.length}</p>
                  <p>前十大出口：{exportRanking.length}</p>
                  <p>Flow routes：{tradeFlows.length}</p>
                  <p>Pipeline routes：{visiblePipelineRoutes.length}</p>
                  <p>Risk events：{visiblePipelineRiskEvents.length}</p>
                  <p>顯示點位：{visibleSitePoints.length}</p>
                  <p>總點位：{currentSitePoints.length}</p>
                </div>

                {activeSitePoint ? (
                  <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/82 px-3 py-2 text-[11px] text-[var(--muted)]">
                    <p className="font-semibold tracking-[0.12em]">Selected Site</p>
                    <p className="mt-1 text-[var(--brand-ink)]">{activeSitePoint.name}</p>
                    <p>{activeSitePoint.country} · {activeSitePoint.kind}</p>
                    <p>
                      {activeSitePoint.lat.toFixed(2)}, {activeSitePoint.lon.toFixed(2)}
                    </p>
                    <a
                      href={activeSiteSourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[10px] underline decoration-[var(--line)] underline-offset-2 hover:text-[var(--brand-ink)]"
                    >
                      source
                    </a>
                  </div>
                ) : null}

                {activePipelineRoute && showPipelineLayer ? (
                  <div className="mt-3 rounded-xl border border-[rgb(255_154_31_/_35%)] bg-[rgb(255_154_31_/_8%)] px-3 py-2 text-[11px] text-[var(--muted)]">
                    <p className="font-semibold tracking-[0.12em] text-[#8a4b0e]">Selected Pipeline</p>
                    <p className="mt-1 text-[var(--brand-ink)]">{activePipelineRoute.name}</p>
                    <p>
                      {activePipelineRoute.from} → {activePipelineRoute.to}
                    </p>
                    <p>
                      {activePipelineRoute.type === "oil" ? "Oil" : "Gas"} · {activePipelineRoute.capacity}
                    </p>
                    <p>
                      {activePipelineRoute.lengthKm.toLocaleString("en-US")} km ·{" "}
                      {pipelineStatusById[activePipelineRoute.id] === "disrupted"
                        ? "disrupted"
                        : pipelineStatusById[activePipelineRoute.id] === "retired"
                          ? "retired"
                          : pipelineStatusById[activePipelineRoute.id] === "planned"
                            ? "planned"
                            : "active"}
                    </p>
                    <p>
                      start {activePipelineRoute.commissionedYear}
                      {activePipelineRoute.decommissionedYear ? ` · end ${activePipelineRoute.decommissionedYear}` : ""}
                    </p>
                    <a
                      href={activePipelineRoute.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[10px] underline decoration-[var(--line)] underline-offset-2 hover:text-[var(--brand-ink)]"
                    >
                      source
                    </a>
                  </div>
                ) : null}

                {activePipelineRiskEvent && showPipelineLayer && showPipelineRiskLayer ? (
                  <div className="mt-3 rounded-xl border border-[rgb(214_102_96_/_35%)] bg-[rgb(214_102_96_/_8%)] px-3 py-2 text-[11px] text-[var(--muted)]">
                    <p className="font-semibold tracking-[0.12em] text-[#8f3d37]">Selected Risk</p>
                    <p className="mt-1 text-[var(--brand-ink)]">{activePipelineRiskEvent.title}</p>
                    <p>
                      {activePipelineRiskEvent.type} · {activePipelineRiskEvent.year}
                      {activePipelineRiskEvent.endYear ? `-${activePipelineRiskEvent.endYear}` : ""}
                    </p>
                    <p>{activePipelineRiskEvent.note}</p>
                    <a
                      href={activePipelineRiskEvent.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[10px] underline decoration-[var(--line)] underline-offset-2 hover:text-[var(--brand-ink)]"
                    >
                      source
                    </a>
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-1 gap-1.5 text-[11px] text-[var(--muted)]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[rgb(203_89_83_/_85%)]" />
                    進口泡泡（紅）
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[rgb(75_139_94_/_85%)]" />
                    出口泡泡（綠）
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-[2px] w-5 bg-[rgb(75_139_94_/_70%)]" />
                    Flow Arc（綠系）
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-[2px] w-5 bg-[rgb(203_89_83_/_70%)]" />
                    Risk Arc（紅系）
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-[2px] w-5 bg-[#ff9a1f]" />
                    Pipeline Active（油/氣）
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-[2px] w-5 border-t border-dashed border-[#ff7a66]" />
                    Pipeline Disrupted
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-[2px] w-5 border-t border-dashed border-[#8f9a8d]" />
                    Pipeline Retired
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[rgb(141_108_255_/_88%)]" />
                    制裁事件（紫）
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[rgb(255_111_125_/_88%)]" />
                    戰爭事件（紅）
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[rgb(255_147_72_/_88%)]" />
                    事故事件（橘）
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[rgb(191_153_73_/_88%)]" />
                    產區點位
                  </div>
                </div>
              </aside>

              <div className="pointer-events-none absolute bottom-3 right-3 z-20">
                <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/88 p-1 shadow-[0_8px_22px_rgb(10_21_38_/_12%)] backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => setSnapshotPanelVisible((previous) => !previous)}
                    className={`rounded-full px-2.5 py-1 text-[11px] tracking-[0.1em] transition ${
                      snapshotPanelVisible ? "bg-[var(--olive)] text-white" : "bg-white text-[var(--muted)] hover:bg-[#eef3e6]"
                    }`}
                  >
                    商品資訊
                  </button>
                  <button
                    type="button"
                    onClick={toggleProductionLayer}
                    className={`rounded-full px-2.5 py-1 text-[11px] tracking-[0.1em] transition ${
                      showProductionLayer
                        ? "bg-[var(--brand-ink)] text-white"
                        : "bg-white text-[var(--muted)] hover:bg-[#eef3e6]"
                    }`}
                  >
                    產量
                  </button>
                  <button
                    type="button"
                    onClick={toggleTradeLayer}
                    className={`rounded-full px-2.5 py-1 text-[11px] tracking-[0.1em] transition ${
                      showTradeLayer ? "bg-[var(--brand-ink)] text-white" : "bg-white text-[var(--muted)] hover:bg-[#eef3e6]"
                    }`}
                  >
                    貿易
                  </button>
                  <button
                    type="button"
                    onClick={toggleSiteLayer}
                    className={`rounded-full px-2.5 py-1 text-[11px] tracking-[0.1em] transition ${
                      showSiteLayer ? "bg-[var(--brand-ink)] text-white" : "bg-white text-[var(--muted)] hover:bg-[#eef3e6]"
                    }`}
                  >
                    產區
                  </button>
                  {currentPipelineRoutes.length ? (
                    <button
                      type="button"
                      onClick={togglePipelineLayer}
                      className={`rounded-full px-2.5 py-1 text-[11px] tracking-[0.1em] transition ${
                        showPipelineLayer ? "bg-[var(--brand-ink)] text-white" : "bg-white text-[var(--muted)] hover:bg-[#eef3e6]"
                      }`}
                    >
                      管線
                    </button>
                  ) : null}
                  {currentPipelineRiskEvents.length ? (
                    <button
                      type="button"
                      onClick={togglePipelineRiskLayer}
                      className={`rounded-full px-2.5 py-1 text-[11px] tracking-[0.1em] transition ${
                        showPipelineRiskLayer ? "bg-[#d66660] text-white" : "bg-white text-[var(--muted)] hover:bg-[#eef3e6]"
                      }`}
                    >
                      風險
                    </button>
                  ) : null}
                  {currentPipelineRoutes.length ? (
                    <div className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-1 py-0.5">
                      <button
                        type="button"
                        onClick={() => setPipelineYear(Math.max(pipelineYearExtent.minYear, clampedPipelineYear - 1))}
                        className="rounded-full px-1.5 py-0.5 text-[10px] text-[var(--muted)] hover:bg-[#eef3e6]"
                        aria-label="Previous pipeline year"
                      >
                        -
                      </button>
                      <span className="min-w-[34px] text-center text-[10px] font-medium text-[var(--brand-ink)]">{clampedPipelineYear}</span>
                      <button
                        type="button"
                        onClick={() => setPipelineYear(Math.min(pipelineYearExtent.maxYear, clampedPipelineYear + 1))}
                        className="rounded-full px-1.5 py-0.5 text-[10px] text-[var(--muted)] hover:bg-[#eef3e6]"
                        aria-label="Next pipeline year"
                      >
                        +
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setLegendPanelVisible((previous) => !previous)}
                    className={`rounded-full px-2.5 py-1 text-[11px] tracking-[0.1em] transition ${
                      legendPanelVisible ? "bg-[var(--olive)] text-white" : "bg-white text-[var(--muted)] hover:bg-[#eef3e6]"
                    }`}
                  >
                    Legend
                  </button>
                </div>
              </div>
          </div>
        </div>
        </section>

        <section className={compareMode ? "grid gap-5 lg:grid-cols-2" : ""}>
          <CommodityCandlestickChart
            commodityKey={themeKey}
            title={currentProfile.zhName}
            benchmark={currentProfile.benchmark}
          />
          {compareMode ? (
            <CommodityCandlestickChart
              commodityKey={compareKey}
              title={compareProfile.zhName}
              benchmark={compareProfile.benchmark}
            />
          ) : null}
        </section>

        {compareMode ? (
          <section className="paper-card p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Commodity Compare Mode</p>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
              {currentProfile.zhName} vs {compareProfile.zhName}
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <article className="rounded-xl border border-[var(--line)] bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{currentProfile.benchmark}</p>
                <h4 className="mt-1 text-xl font-semibold">{currentProfile.zhName}</h4>
                <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                  <li>Latest: {currentProfile.latestPrice}</li>
                  <li>YTD: {currentProfile.ytdChange}</li>
                  <li>Volatility: {currentProfile.volatility}</li>
                </ul>
              </article>

              <article className="rounded-xl border border-[var(--line)] bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{compareProfile.benchmark}</p>
                <h4 className="mt-1 text-xl font-semibold">{compareProfile.zhName}</h4>
                <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                  <li>Latest: {compareProfile.latestPrice}</li>
                  <li>YTD: {compareProfile.ytdChange}</li>
                  <li>Volatility: {compareProfile.volatility}</li>
                </ul>
              </article>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <article className="rounded-xl border border-[var(--line)] bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">產區差異</p>
                <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                  {currentProfile.hotspots.slice(0, 3).map((hotspot) => (
                    <li key={`left-${hotspot.id}`}>
                      {currentProfile.zhName}：{hotspot.label}（{hotspot.role}）
                    </li>
                  ))}
                  {compareProfile.hotspots.slice(0, 3).map((hotspot) => (
                    <li key={`right-${hotspot.id}`}>
                      {compareProfile.zhName}：{hotspot.label}（{hotspot.role}）
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-xl border border-[var(--line)] bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">共同區域 / 風險因子</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  共同區域：{overlapRegions.length ? overlapRegions.join(" / ") : "無明顯重疊核心區"}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                  <li>{currentProfile.zhName}：{currentProfile.watchpoints[0]}</li>
                  <li>{compareProfile.zhName}：{compareProfile.watchpoints[0]}</li>
                </ul>
              </article>
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 md:grid-cols-2">
          <article className="paper-card p-5 md:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Supply Chain Flow</p>
            <ol className="mt-3 space-y-2">
              {currentProfile.supplyChain.map((step, index) => (
                <li key={step} className="rounded-xl border border-[var(--line)] bg-white/65 px-4 py-3 text-sm text-[var(--muted)]">
                  <span className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">Step {index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </article>

          <article className="paper-card p-5 md:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Price Drivers</p>
            <div className="mt-3 space-y-2">
              {driverLoading ? <p className="text-sm text-[var(--muted)]">載入最新 driver 訊號中...</p> : null}
              {!driverLoading && driverNotice ? (
                <p className="rounded-xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--muted)]">{driverNotice}</p>
              ) : null}
              {!driverLoading && driverError ? (
                <p className="rounded-xl border border-[var(--line)] bg-white/65 px-4 py-3 text-sm text-[#8b2f2a]">
                  最新市場資料讀取失敗：{driverError}
                </p>
              ) : null}
              {!driverLoading && !driverError
                ? driverSignals.map((driver) => {
                    const isActive = driver.id === (activeDriver?.id ?? "");
                    const positive = driver.direction === "positive";
                    const neutral = driver.direction === "neutral";
                    return (
                      <button
                        key={driver.id}
                        type="button"
                        onClick={() => setActiveDriverId(driver.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                          isActive
                            ? "border-[var(--brand-ink)] bg-[rgb(10_21_38_/_7%)]"
                            : "border-[var(--line)] bg-white/65 hover:bg-white"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm text-[var(--muted)]">{driver.label}</span>
                          <span className="rounded-full border border-[var(--line)] bg-white/80 px-2 py-0.5 text-[10px] tracking-[0.12em] text-[var(--muted)]">
                            {(driver.horizon ?? "short") === "short" ? "短期" : "長期"}
                          </span>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            neutral
                              ? "bg-[rgb(117_129_144_/_14%)] text-[#5d6b7a]"
                              : positive
                                ? "bg-[rgb(203_89_83_/_14%)] text-[#b4433b]"
                                : "bg-[rgb(75_139_94_/_14%)] text-[#2f7b47]"
                          }`}
                        >
                          {neutral ? "•" : positive ? "↑" : "↓"} {neutral ? "待資料" : positive ? "正向" : "負向"}
                        </span>
                      </button>
                    );
                  })
                : null}
              {!driverLoading && !driverError && driverSignals.length === 0 ? (
                <p className="rounded-xl border border-[var(--line)] bg-white/65 px-4 py-3 text-sm text-[var(--muted)]">
                  目前此商品尚未配置 driver。
                </p>
              ) : null}
            </div>

            {activeDriver ? (
              <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-ink)]">
                    <span>{activeDriver.label}</span>
                    <span className="rounded-full border border-[var(--line)] bg-white/90 px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-[var(--muted)]">
                      {(activeDriver.horizon ?? "short") === "short" ? "短期" : "長期"}
                    </span>
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      activeDriver.direction === "neutral"
                        ? "bg-[rgb(117_129_144_/_14%)] text-[#5d6b7a]"
                        : activeDriver.direction === "positive"
                          ? "bg-[rgb(203_89_83_/_14%)] text-[#b4433b]"
                          : "bg-[rgb(75_139_94_/_14%)] text-[#2f7b47]"
                    }`}
                  >
                    {activeDriver.direction === "neutral"
                      ? "• 待資料"
                      : activeDriver.direction === "positive"
                        ? "↑ 正向"
                        : "↓ 負向"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{activeDriver.statusText}</p>

                <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">參考依據</p>
                <ul className="mt-1 space-y-1">
                  {activeDriver.rationale.map((item) => (
                    <li key={item} className="text-sm text-[var(--muted)]">
                      • {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                  <span>更新時間：{new Date(activeDriver.updatedAt).toLocaleString("zh-TW")}</span>
                  <span>來源：{activeDriver.sourceNote}</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {activeDriver.sourceLinks.map((source) => (
                    <a
                      key={source.label}
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[var(--line)] bg-white/90 px-2.5 py-1 text-[var(--muted)] underline decoration-[var(--line)] underline-offset-2 hover:text-[var(--brand-ink)]"
                    >
                      {source.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {newsSnapshot?.items?.length ? (
              <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/80 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--brand-ink)]">重大新聞（近 14 日）</p>
                  <span className="text-[11px] text-[var(--muted)]">
                    更新：{new Date(newsSnapshot.updatedAt).toLocaleString("zh-TW")}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {newsSnapshot.items.slice(0, 5).map((item, index) => (
                    <a
                      key={`${item.url}-${index}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-[var(--line)] bg-white/85 px-3 py-2 transition hover:bg-white"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
                        <span>#{index + 1}</span>
                        <span>{item.domain ?? "news"}</span>
                        <span>
                          {item.tone === "positive" ? "↑ 正向" : item.tone === "negative" ? "↓ 負向" : "• 中性"}
                        </span>
                        <span>{new Date(item.publishedAt).toLocaleDateString("zh-TW")}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">{item.title}</p>
                    </a>
                  ))}
                </div>

                {newsSnapshot.driverCoverage.length ? (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Driver Coverage in News</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {newsSnapshot.driverCoverage.slice(0, 6).map((item) => (
                        <span
                          key={item.key}
                          className="rounded-full border border-[var(--line)] bg-white/90 px-2.5 py-1 text-xs text-[var(--muted)]"
                        >
                          {item.label} · {item.count}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {newsSnapshot.keywords.length ? (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Keyword Mining</p>
                    <div className="mt-2 grid gap-1.5">
                      {newsSnapshot.keywords.slice(0, 10).map((item) => {
                        const width = Math.max(16, Math.round((item.count / Math.max(topKeywordCount, 1)) * 100));
                        return (
                          <div key={item.keyword} className="grid grid-cols-[120px_1fr_auto] items-center gap-2 text-xs">
                            <span className="truncate text-[var(--muted)]">{item.keyword}</span>
                            <span className="relative h-2 rounded-full bg-[rgb(124_141_107_/_18%)]">
                              <span
                                className="absolute inset-y-0 left-0 rounded-full bg-[rgb(111_142_90_/_80%)]"
                                style={{ width: `${width}%` }}
                              />
                            </span>
                            <span className="text-[var(--muted)]">{item.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {newsSnapshot.sourceLinks.map((source) => (
                    <a
                      key={source.label}
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[var(--line)] bg-white/90 px-2.5 py-1 text-[var(--muted)] underline decoration-[var(--line)] underline-offset-2 hover:text-[var(--brand-ink)]"
                    >
                      {source.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        </section>

        <section className="paper-card p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">MapHouse Research Angle</p>
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl">{currentTheme.title}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">{currentTheme.subtitle}</p>
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-white/70 p-4">
            <p className="text-sm leading-7 text-[var(--muted)]">{selectedInsight.blurb}</p>
            <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">
              <span className="font-semibold">Why it matters: </span>
              {selectedInsight.why}
            </p>
          </div>
        </section>

        <footer className="paper-card px-5 py-4 md:px-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Sources</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] leading-5 text-[var(--muted)]">
            <p>
              產量清單：
              <a
                href={productionSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-1 underline decoration-[var(--line)] underline-offset-2 transition hover:text-[var(--brand-ink)]"
              >
                FAOSTAT (QCL)
              </a>
            </p>
            <p>
              貿易清單：
              <a
                href={tradeListSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-1 underline decoration-[var(--line)] underline-offset-2 transition hover:text-[var(--brand-ink)]"
              >
                OEC BACI (HS4 {hs4Id})
              </a>
            </p>
            <p>
              Trade Flow：
              <a
                href={tradeFlowSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-1 underline decoration-[var(--line)] underline-offset-2 transition hover:text-[var(--brand-ink)]"
              >
                OEC Flow Data API
              </a>
            </p>
            <p>
              Pipeline：
              <a
                href="https://www.eia.gov/international/analysis/special-topics/WorldOilTransitChokepoints"
                target="_blank"
                rel="noreferrer"
                className="ml-1 underline decoration-[var(--line)] underline-offset-2 transition hover:text-[var(--brand-ink)]"
              >
                EIA Global Pipeline/Chokepoint
              </a>
            </p>
            <p>
              產區點位：
              <a
                href="https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries"
                target="_blank"
                rel="noreferrer"
                className="ml-1 underline decoration-[var(--line)] underline-offset-2 transition hover:text-[var(--brand-ink)]"
              >
                USGS MCS
              </a>
              <span className="mx-1.5 text-[var(--line)]">/</span>
              <a
                href="https://www.fao.org/faostat/"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-[var(--line)] underline-offset-2 transition hover:text-[var(--brand-ink)]"
              >
                FAOSTAT
              </a>
            </p>
            <p>
              市場價格 / K-line：
              <a
                href={klineYahooSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-1 underline decoration-[var(--line)] underline-offset-2 transition hover:text-[var(--brand-ink)]"
              >
                Yahoo Finance
              </a>
              <span className="mx-1.5 text-[var(--line)]">/</span>
              <a
                href={klineTradingViewSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-[var(--line)] underline-offset-2 transition hover:text-[var(--brand-ink)]"
              >
                TradingView
              </a>
            </p>
            <p>
              Price Drivers：
              <a
                href="https://fred.stlouisfed.org/"
                target="_blank"
                rel="noreferrer"
                className="ml-1 underline decoration-[var(--line)] underline-offset-2 transition hover:text-[var(--brand-ink)]"
              >
                FRED (St. Louis Fed)
              </a>
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
