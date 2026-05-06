import { NextResponse } from "next/server";
import { commodityProfiles, type CommodityKey } from "@/app/data";

type DriverDirection = "positive" | "negative" | "neutral";
type DriverHorizon = "short" | "long";
type DriverUnit = "index" | "pct" | "usd" | "mm";

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

type SeriesPoint = {
  date: string;
  value: number;
};

type FredMetric = {
  seriesId: string;
  metricName: string;
  unit: DriverUnit;
  latest: number;
  latestDate: string;
  change20d: number;
};

type CompositeComponent = {
  seriesId: string;
  metricName: string;
  unit: DriverUnit;
  weight: number;
  polarity: "up" | "down";
};

type CommodityCompositeProfile = {
  label: string;
  sourceNote: string;
  components: CompositeComponent[];
};

type OecTradeRow = {
  "Exporter Country"?: string;
  "Importer Country"?: string;
  Year?: number;
  "Trade Value"?: number;
};

type OecTradeResponse = {
  data?: OecTradeRow[];
};

type GdeltDocArticle = {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  sourcecountry?: string;
};

type GdeltDocResponse = {
  articles?: GdeltDocArticle[];
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

type DriverCacheEntry = {
  signals: DriverSignal[];
  newsSnapshot: CommodityNewsSnapshot | null;
  updatedAt: number;
};

type FactorPlan = {
  key: string;
  label: string;
  horizon?: DriverHorizon;
  theory: string;
  sourceHint: string;
  sourceLinks: Array<{ label: string; href: string }>;
  task: () => Promise<DriverSignal | null>;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const STALE_MAX_MS = 3 * 24 * 60 * 60 * 1000;
const driverCache = new Map<string, DriverCacheEntry>();

const AGRI_COMMODITIES = new Set<CommodityKey>(["soybean", "wheat", "corn", "coffee", "cocoa", "sugar", "cotton", "soybeanOil"]);
const ENERGY_COMMODITIES = new Set<CommodityKey>(["oil", "brent", "naturalGas"]);
const SAFE_HAVEN_COMMODITIES = new Set<CommodityKey>(["gold", "silver"]);
const METAL_COMMODITIES = new Set<CommodityKey>([
  "aluminum",
  "copper",
  "nickel",
  "zinc",
  "lead",
  "tin",
  "cobalt",
  "lithium",
  "gallium",
  "germanium",
  "gold",
  "silver",
]);

const NEWS_QUERY_TERMS: Record<CommodityKey, string[]> = {
  soybean: ["soybean", "soybeans", "soy meal", "soy oil"],
  wheat: ["wheat", "CBOT wheat", "milling wheat"],
  corn: ["corn", "maize", "CBOT corn"],
  coffee: ["arabica coffee", "robusta coffee", "coffee futures"],
  cocoa: ["cocoa", "cocoa futures", "cocoa beans"],
  sugar: ["raw sugar", "sugar futures", "No.11 sugar"],
  cotton: ["cotton futures", "cotton crop"],
  soybeanOil: ["soybean oil", "soy oil futures", "vegetable oil"],
  oil: ["crude oil", "WTI", "oil futures", "OPEC"],
  brent: ["Brent crude", "North Sea oil", "Brent futures"],
  naturalGas: ["natural gas", "LNG", "Henry Hub"],
  aluminum: ["aluminum", "aluminium", "aluminum smelter", "bauxite"],
  copper: ["copper", "copper concentrate", "copper mine"],
  nickel: ["nickel", "nickel pig iron", "stainless steel demand"],
  zinc: ["zinc", "zinc smelter", "galvanized steel"],
  lead: ["lead metal", "lead smelter", "lead battery"],
  tin: ["tin metal", "tin smelter", "solder demand"],
  cobalt: ["cobalt", "battery cobalt", "DR Congo cobalt"],
  lithium: ["lithium", "lithium carbonate", "battery lithium"],
  gallium: ["gallium", "GaN", "GaAs", "gallium export"],
  germanium: ["germanium", "infrared optics", "germanium export"],
  gold: ["gold", "gold bullion", "gold ETF", "gold futures"],
  silver: ["silver", "silver bullion", "silver futures"],
};

const NEWS_BULLISH_TERMS = [
  "supply cut",
  "production cut",
  "output cut",
  "export ban",
  "export curb",
  "sanction",
  "disruption",
  "shortage",
  "strike",
  "drought",
  "frost",
  "logistics bottleneck",
  "inventory draw",
  "demand strong",
  "demand surge",
  "buying spree",
  "tight market",
  "deficit",
];

const NEWS_BEARISH_TERMS = [
  "production rises",
  "output increase",
  "supply increase",
  "oversupply",
  "surplus",
  "export resumes",
  "harvest improves",
  "inventory build",
  "stockpile rise",
  "demand weak",
  "demand slowdown",
  "recession risk",
  "price cap",
  "substitution",
  "mine restart",
  "ceasefire",
  "deal reached",
];

const FACTOR_NEWS_TERMS: Record<string, string[]> = {
  "supply-policy": ["export policy", "quota", "sanction", "geopolitical", "supply disruption"],
  "bauxite-supply": ["bauxite", "alumina", "mine output", "shipment disruption"],
  "china-capacity-policy": ["China smelter", "power curtailment", "capacity policy", "output control"],
  "mine-disruption": ["mine strike", "mine disruption", "ore grade", "permit delay"],
  "tc-rc": ["TC/RC", "treatment charge", "refining charge", "concentrate tightness"],
  "indonesia-policy": ["Indonesia export", "mining permit", "ore ban", "smelter policy"],
  "battery-demand": ["EV demand", "battery demand", "cathode demand", "NMC"],
  "mine-supply": ["mine supply", "ore output", "production guidance", "shutdown"],
  "tc-benchmark": ["benchmark TC", "smelter treatment charge", "concentrate market"],
  "recycling-supply": ["recycled supply", "scrap availability", "secondary metal"],
  "mine-supply-policy": ["mine regulation", "environmental policy", "output restriction"],
  "indonesia-myanmar-supply": ["Indonesia supply", "Myanmar supply", "export permit", "mining disruption"],
  "exchange-inventory": ["LME inventory", "warehouse stock", "exchange stock", "drawdown"],
  "drc-supply-risk": ["DR Congo", "royalty", "political risk", "logistics disruption"],
  "battery-chemistry-shift": ["battery chemistry", "LFP", "high nickel", "cobalt intensity"],
  "mine-project-pipeline": ["new project", "commissioning", "capacity expansion", "project delay"],
  "ev-policy-demand": ["EV subsidy", "emission rule", "purchase incentive", "adoption policy"],
  "export-policy": ["export control", "export restriction", "license requirement", "critical mineral"],
  "gaas-gan-cycle": ["GaN", "GaAs", "semiconductor demand", "power device"],
  "optics-defense-demand": ["infrared optics", "fiber optics", "defense demand", "sensor demand"],
  "central-bank-demand": ["central bank buying", "gold reserve", "official sector", "reserve diversification"],
  "etf-holdings": ["ETF holdings", "fund flow", "gold ETF", "silver ETF"],
  "solar-demand": ["solar demand", "photovoltaic", "PV installation", "solar capacity"],
};

const NEWS_KEYWORD_HINTS: Partial<Record<CommodityKey, string[]>> = {
  gold: [
    "real yield",
    "treasury yield",
    "fed",
    "federal reserve",
    "rate cut",
    "rate hike",
    "inflation",
    "dollar",
    "usd",
    "central bank",
    "reserve",
    "etf",
    "safe haven",
    "geopolitical",
    "ceasefire",
    "war",
    "sanction",
    "china demand",
    "india demand",
  ],
};

const KEYWORD_MINING_TERMS: Partial<Record<CommodityKey, string[]>> = {
  gold: [
    "real yield",
    "treasury yield",
    "fed rate cut",
    "fed rate hike",
    "federal reserve",
    "inflation expectations",
    "dollar strength",
    "dollar weakness",
    "central bank buying",
    "official reserves",
    "gold etf outflow",
    "gold etf inflow",
    "safe haven demand",
    "geopolitical risk",
    "middle east tension",
    "recession risk",
    "china gold demand",
    "india gold demand",
  ],
};

const HEADLINE_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "over",
  "under",
  "amid",
  "after",
  "before",
  "while",
  "that",
  "this",
  "will",
  "have",
  "has",
  "had",
  "its",
  "their",
  "they",
  "you",
  "your",
  "our",
  "are",
  "was",
  "were",
  "been",
  "being",
  "more",
  "less",
  "than",
  "near",
  "toward",
  "around",
  "about",
  "says",
  "said",
  "say",
  "new",
  "latest",
  "market",
  "markets",
  "price",
  "prices",
  "futures",
  "update",
  "today",
]);

const TEMPORAL_NOISE_TERMS = new Set([
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

const SOURCE_NOISE_TERMS = new Set([
  "yahoo",
  "finance",
  "reuters",
  "bloomberg",
  "cnbc",
  "marketwatch",
  "wsj",
  "ft",
  "co",
  "com",
]);

function inferMetalPlanHorizon(planKey: string): DriverHorizon {
  const shortKeys = new Set([
    "industrial-demand",
    "smelting-energy-cost",
    "energy-cost",
    "stainless-demand",
    "galvanized-demand",
    "real-yield",
    "usd-strength",
    "risk-aversion",
  ]);
  return shortKeys.has(planKey) ? "short" : "long";
}

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

const AGRI_WEATHER_POINTS: Record<
  CommodityKey,
  { name: string; lat: number; lon: number }
> = {
  soybean: { name: "Brazil Mato Grosso", lat: -12.5, lon: -55.5 },
  wheat: { name: "Black Sea Wheat Belt", lat: 49.1, lon: 33.4 },
  corn: { name: "US Corn Belt", lat: 41.9, lon: -93.8 },
  coffee: { name: "Brazil Minas Gerais", lat: -18.5, lon: -46.5 },
  oil: { name: "US Gulf Coast", lat: 29.7, lon: -95.3 },
  aluminum: { name: "Guinea Bauxite Belt", lat: 10.5, lon: -10.7 },
  copper: { name: "Chile Norte", lat: -23.5, lon: -69.2 },
  gold: { name: "Nevada Mining Belt", lat: 40.8, lon: -116.0 },
  silver: { name: "Peru Andes", lat: -13.5, lon: -72.0 },
  naturalGas: { name: "US South Central", lat: 31.0, lon: -98.0 },
  brent: { name: "North Sea Hub", lat: 57.0, lon: 2.0 },
  nickel: { name: "Indonesia Sulawesi", lat: -2.3, lon: 121.1 },
  zinc: { name: "China Southwest", lat: 27.0, lon: 104.0 },
  lead: { name: "China Henan", lat: 34.0, lon: 113.5 },
  tin: { name: "Indonesia Bangka", lat: -2.1, lon: 106.1 },
  cobalt: { name: "DR Congo Lualaba", lat: -10.7, lon: 26.7 },
  lithium: { name: "Chile Atacama", lat: -23.3, lon: -68.2 },
  gallium: { name: "China Guangxi", lat: 23.8, lon: 108.3 },
  germanium: { name: "China Yunnan", lat: 24.9, lon: 102.8 },
  cocoa: { name: "Cote d'Ivoire Cocoa Belt", lat: 7.5, lon: -5.6 },
  sugar: { name: "Brazil Center-South", lat: -21.2, lon: -47.2 },
  cotton: { name: "US Texas High Plains", lat: 33.6, lon: -101.8 },
  soybeanOil: { name: "Brazil Mato Grosso", lat: -12.5, lon: -55.5 },
};

const COST_DEMAND_PROFILES: Record<CommodityKey, CommodityCompositeProfile> = {
  soybean: {
    label: "投入成本（肥料/運輸）",
    sourceNote: "Agri input-cost composite",
    components: [
      { seriesId: "DHHNGSP", metricName: "Henry Hub 天然氣現貨", unit: "usd", weight: 0.6, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.4, polarity: "up" },
    ],
  },
  wheat: {
    label: "投入成本（肥料/運輸）",
    sourceNote: "Agri input-cost composite",
    components: [
      { seriesId: "DHHNGSP", metricName: "Henry Hub 天然氣現貨", unit: "usd", weight: 0.55, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.45, polarity: "up" },
    ],
  },
  corn: {
    label: "投入成本（肥料/運輸）",
    sourceNote: "Agri input-cost composite",
    components: [
      { seriesId: "DHHNGSP", metricName: "Henry Hub 天然氣現貨", unit: "usd", weight: 0.6, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.4, polarity: "up" },
    ],
  },
  coffee: {
    label: "投入成本（運輸/加工）",
    sourceNote: "Agri logistics-cost composite",
    components: [
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.7, polarity: "up" },
      { seriesId: "DHHNGSP", metricName: "Henry Hub 天然氣現貨", unit: "usd", weight: 0.3, polarity: "up" },
    ],
  },
  cocoa: {
    label: "投入成本（運輸/加工）",
    sourceNote: "Agri logistics-cost composite",
    components: [
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.75, polarity: "up" },
      { seriesId: "DHHNGSP", metricName: "Henry Hub 天然氣現貨", unit: "usd", weight: 0.25, polarity: "up" },
    ],
  },
  sugar: {
    label: "投入成本（能源/運輸）",
    sourceNote: "Agri energy-cost composite",
    components: [
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.65, polarity: "up" },
      { seriesId: "DHHNGSP", metricName: "Henry Hub 天然氣現貨", unit: "usd", weight: 0.35, polarity: "up" },
    ],
  },
  cotton: {
    label: "投入成本（運輸/加工）",
    sourceNote: "Agri logistics-cost composite",
    components: [
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.7, polarity: "up" },
      { seriesId: "DHHNGSP", metricName: "Henry Hub 天然氣現貨", unit: "usd", weight: 0.3, polarity: "up" },
    ],
  },
  soybeanOil: {
    label: "投入成本（壓榨/能源）",
    sourceNote: "Agri crush-cost composite",
    components: [
      { seriesId: "DHHNGSP", metricName: "Henry Hub 天然氣現貨", unit: "usd", weight: 0.5, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.5, polarity: "up" },
    ],
  },
  oil: {
    label: "能源需求/成本環境",
    sourceNote: "Energy demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.6, polarity: "up" },
      { seriesId: "DHHNGSP", metricName: "Henry Hub 天然氣現貨", unit: "usd", weight: 0.4, polarity: "up" },
    ],
  },
  brent: {
    label: "能源需求/成本環境",
    sourceNote: "Energy demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.6, polarity: "up" },
      { seriesId: "DHHNGSP", metricName: "Henry Hub 天然氣現貨", unit: "usd", weight: 0.4, polarity: "up" },
    ],
  },
  naturalGas: {
    label: "能源需求/替代環境",
    sourceNote: "Gas demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.5, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.5, polarity: "up" },
    ],
  },
  aluminum: {
    label: "工業需求/冶煉成本",
    sourceNote: "Base metal demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.7, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.3, polarity: "up" },
    ],
  },
  copper: {
    label: "工業需求/電網投資代理",
    sourceNote: "Copper demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.75, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.25, polarity: "up" },
    ],
  },
  nickel: {
    label: "工業需求/能源成本",
    sourceNote: "Nickel demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.65, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.35, polarity: "up" },
    ],
  },
  zinc: {
    label: "工業需求/冶煉成本",
    sourceNote: "Zinc demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.65, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.35, polarity: "up" },
    ],
  },
  lead: {
    label: "工業需求/再生鉛成本",
    sourceNote: "Lead demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.6, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.4, polarity: "up" },
    ],
  },
  tin: {
    label: "電子需求/冶煉成本",
    sourceNote: "Tin demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.7, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.3, polarity: "up" },
    ],
  },
  cobalt: {
    label: "電池鏈需求/加工成本",
    sourceNote: "Cobalt demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.55, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.45, polarity: "up" },
    ],
  },
  lithium: {
    label: "電池需求/精煉成本",
    sourceNote: "Lithium demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.5, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.5, polarity: "up" },
    ],
  },
  gallium: {
    label: "半導體需求/精煉成本",
    sourceNote: "Gallium demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.65, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.35, polarity: "up" },
    ],
  },
  germanium: {
    label: "光學需求/精煉成本",
    sourceNote: "Germanium demand composite",
    components: [
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.6, polarity: "up" },
      { seriesId: "DCOILWTICO", metricName: "WTI 現貨價格", unit: "usd", weight: 0.4, polarity: "up" },
    ],
  },
  gold: {
    label: "避險需求/機會成本",
    sourceNote: "Precious metal composite",
    components: [
      { seriesId: "VIXCLS", metricName: "VIX 風險指數", unit: "index", weight: 0.6, polarity: "up" },
      { seriesId: "DGS10", metricName: "美國 10 年期公債殖利率", unit: "pct", weight: 0.4, polarity: "down" },
    ],
  },
  silver: {
    label: "避險需求/工業雙重屬性",
    sourceNote: "Silver mixed-demand composite",
    components: [
      { seriesId: "VIXCLS", metricName: "VIX 風險指數", unit: "index", weight: 0.4, polarity: "up" },
      { seriesId: "INDPRO", metricName: "美國工業生產指數", unit: "index", weight: 0.35, polarity: "up" },
      { seriesId: "DGS10", metricName: "美國 10 年期公債殖利率", unit: "pct", weight: 0.25, polarity: "down" },
    ],
  },
};

function isCommodityKey(value: string): value is CommodityKey {
  return Object.prototype.hasOwnProperty.call(commodityProfiles, value);
}

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function signedBps(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)}bp`;
}

function pctChange(latest: number, previous: number) {
  if (!Number.isFinite(latest) || !Number.isFinite(previous) || previous === 0) return 0;
  return ((latest - previous) / previous) * 100;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function addYears(base: Date, years: number) {
  const next = new Date(base);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function formatValue(value: number, unit: DriverUnit) {
  if (!Number.isFinite(value)) return "--";
  if (unit === "pct") return `${value.toFixed(2)}%`;
  if (unit === "usd") return `$${value.toFixed(2)}`;
  if (unit === "mm") return `${value.toFixed(1)} mm`;
  return value.toFixed(2);
}

function unavailableSignal(commodity: CommodityKey, plan: FactorPlan, reason: string): DriverSignal {
  return {
    id: `driver-${commodity}-${plan.key}-na`,
    label: plan.label,
    horizon: plan.horizon ?? "short",
    direction: "neutral",
    scoreLabel: "--",
    statusText: `${plan.label}：目前無可用 API 數據（${reason}）。`,
    rationale: [`學理依據：${plan.theory}`, "狀態：保留該因子於版面，待後續串接。"],
    updatedAt: new Date().toISOString(),
    sourceNote: `${plan.sourceHint} (unavailable)`,
    sourceLinks: plan.sourceLinks,
  };
}

function parseFredCsv(rawCsv: string): SeriesPoint[] {
  const lines = rawCsv.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const points: SeriesPoint[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const commaIndex = line.indexOf(",");
    if (commaIndex <= 0) continue;
    const date = line.slice(0, commaIndex).replaceAll('"', "").trim();
    const valueText = line.slice(commaIndex + 1).replaceAll('"', "").trim();
    if (!date || !valueText || valueText === ".") continue;
    const value = Number(valueText);
    if (!Number.isFinite(value)) continue;
    points.push({ date, value });
  }
  return points;
}

async function fetchFredMetric(seriesId: string, metricName: string, unit: DriverUnit): Promise<FredMetric> {
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - 2);
  const cosd = formatDate(fromDate);
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}&cosd=${encodeURIComponent(cosd)}`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`fred status ${response.status}`);
  }
  const csv = await response.text();
  const points = parseFredCsv(csv);
  if (points.length < 3) {
    throw new Error("fred empty");
  }

  const latest = points.at(-1) ?? points[points.length - 1];
  const point20 = points[Math.max(0, points.length - 21)] ?? points[0];
  return {
    seriesId,
    metricName,
    unit,
    latest: latest.value,
    latestDate: latest.date,
    change20d: pctChange(latest.value, point20.value),
  };
}

async function fetchPrecipTotal(lat: number, lon: number, startDate: string, endDate: string) {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", `${lat}`);
  url.searchParams.set("longitude", `${lon}`);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("daily", "precipitation_sum");
  url.searchParams.set("timezone", "UTC");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`open-meteo status ${response.status}`);
  }

  const payload = (await response.json()) as {
    daily?: { precipitation_sum?: Array<number | null> };
  };

  const values = payload.daily?.precipitation_sum ?? [];
  const total = values.reduce<number>(
    (sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? value : 0),
    0,
  );
  return { total };
}

async function fetchOecRows(commodity: CommodityKey, yearRaw: string | "latest"): Promise<OecTradeRow[]> {
  const hs4Id = HS4_BY_COMMODITY[commodity];
  const params = new URLSearchParams({
    cube: "trade_i_baci_a_22",
    drilldowns: "Year,HS4,Exporter Country,Importer Country",
    measures: "Trade Value",
    limit: "65000,0",
  });

  if (yearRaw === "latest") {
    params.set("include", `HS4:${hs4Id}`);
    params.set("time", "Year.latest");
  } else {
    params.set("include", `HS4:${hs4Id};Year:${yearRaw}`);
  }

  const url = `https://api-v2.oec.world/tesseract/data.jsonrecords?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "MapHouseBot/1.0 (+https://localhost:3000)",
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`oec status ${response.status}`);
  }

  const payload = (await response.json()) as OecTradeResponse;
  return payload.data ?? [];
}

function summarizeTradeRows(rows: OecTradeRow[]) {
  const importerTotals = new Map<string, number>();
  let total = 0;
  let latestYear = 0;

  rows.forEach((row) => {
    const importer = row["Importer Country"];
    const value = row["Trade Value"];
    const year = row.Year;
    if (typeof importer !== "string" || typeof value !== "number" || !Number.isFinite(value) || value <= 0) return;
    total += value;
    importerTotals.set(importer, (importerTotals.get(importer) ?? 0) + value);
    if (typeof year === "number") latestYear = Math.max(latestYear, year);
  });

  const top3Share =
    total > 0
      ? Array.from(importerTotals.values())
          .sort((a, b) => b - a)
          .slice(0, 3)
          .reduce((sum, value) => sum + value, 0) / total
      : 0;

  return { total, top3Share, latestYear };
}

function normalizeForKeywordMatch(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countKeywordHits(text: string, keywords: string[]) {
  return keywords.reduce((sum, keyword) => (text.includes(keyword) ? sum + 1 : sum), 0);
}

function parseGdeltSeenDate(raw: string | undefined) {
  if (!raw) return null;
  const matched = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!matched) return null;
  const [, year, month, day, hour, minute, second] = matched;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildCommodityNewsQuery(commodity: CommodityKey) {
  const terms = NEWS_QUERY_TERMS[commodity] ?? [commodityProfiles[commodity].enName];
  return `(${terms.map((term) => `"${term}"`).join(" OR ")})`;
}

function getFactorNewsTerms(planKey: string) {
  return FACTOR_NEWS_TERMS[planKey] ?? [];
}

function buildFactorAwareNewsQuery(commodity: CommodityKey, planKey?: string) {
  const commodityQuery = buildCommodityNewsQuery(commodity);
  const factorTerms = planKey ? getFactorNewsTerms(planKey) : [];
  if (factorTerms.length === 0) return commodityQuery;
  const factorQuery = `(${factorTerms.map((term) => `"${term}"`).join(" OR ")})`;
  return `${commodityQuery} ${factorQuery}`;
}

async function fetchGdeltCommodityNews(
  commodity: CommodityKey,
  options?: { queryOverride?: string; maxRecords?: number; timespan?: string },
): Promise<GdeltDocArticle[]> {
  const query = options?.queryOverride ?? buildCommodityNewsQuery(commodity);
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", String(options?.maxRecords ?? 30));
  url.searchParams.set("timespan", options?.timespan ?? "7days");
  url.searchParams.set("sort", "datedesc");

  let payload: GdeltDocResponse | null = null;
  let lastError: string | null = null;
  const retries = [0, 5200];
  for (let i = 0; i < retries.length; i += 1) {
    if (retries[i] > 0) {
      await delay(retries[i]);
    }
    const response = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (response.ok) {
      payload = (await response.json()) as GdeltDocResponse;
      lastError = null;
      break;
    }
    lastError = `news status ${response.status}`;
    if (response.status !== 429) break;
  }
  if (!payload) {
    throw new Error(lastError ?? "news unavailable");
  }
  const dedup = new Set<string>();
  const filtered = (payload.articles ?? []).filter((article) => {
    const title = article.title?.trim();
    const href = article.url?.trim();
    if (!title || !href) return false;
    const key = `${title}::${href}`;
    if (dedup.has(key)) return false;
    dedup.add(key);
    return true;
  });

  return filtered.slice(0, Math.min(options?.maxRecords ?? 12, 24));
}

function decodeXmlEntity(text: string) {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripHtmlTags(text: string) {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRssPubDate(raw: string | undefined) {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function fetchGoogleNewsRss(commodity: CommodityKey, maxRecords = 24): Promise<GdeltDocArticle[]> {
  const query = (NEWS_QUERY_TERMS[commodity] ?? [commodityProfiles[commodity].enName]).join(" OR ");
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");

  const response = await fetch(url.toString(), {
    headers: { accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`google-news-rss status ${response.status}`);
  }
  const xml = await response.text();
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, maxRecords);
  const parsedRaw: Array<GdeltDocArticle | null> = items
    .map((match) => {
      const block = match[1];
      const titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const pubMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      if (!titleMatch || !linkMatch) return null;
      const rawTitle = titleMatch[1] ?? titleMatch[2] ?? "";
      const rawLink = linkMatch[1] ?? "";
      const rawPub = pubMatch?.[1];
      const title = stripHtmlTags(decodeXmlEntity(rawTitle));
      const link = decodeXmlEntity(rawLink).trim();
      if (!title || !link) return null;
      let domain = "";
      try {
        domain = new URL(link).hostname;
      } catch {
        domain = "";
      }
      const publishedAt = parseRssPubDate(rawPub) ?? undefined;
      return {
        title,
        url: link,
        domain,
        seendate: publishedAt,
      } satisfies GdeltDocArticle;
    })
  const parsed = parsedRaw.filter((item): item is GdeltDocArticle => item !== null);
  return parsed.slice(0, Math.min(maxRecords, 24));
}

async function fetchCommodityNewsArticles(
  commodity: CommodityKey,
  options?: { queryOverride?: string; maxRecords?: number; timespan?: string },
): Promise<GdeltDocArticle[]> {
  try {
    return await fetchGdeltCommodityNews(commodity, options);
  } catch {
    return fetchGoogleNewsRss(commodity, options?.maxRecords ?? 24);
  }
}

function classifyNewsTitleTone(title: string) {
  const normalized = normalizeForKeywordMatch(title);
  const positiveHits = countKeywordHits(normalized, NEWS_BULLISH_TERMS);
  const negativeHits = countKeywordHits(normalized, NEWS_BEARISH_TERMS);
  const score = positiveHits - negativeHits;
  if (score > 0) return { tone: "positive" as const, score };
  if (score < 0) return { tone: "negative" as const, score };
  return { tone: "neutral" as const, score };
}

function tokenizeHeadline(title: string) {
  return normalizeForKeywordMatch(title)
    .split(" ")
    .filter((token) => token.length >= 3 && !HEADLINE_STOPWORDS.has(token));
}

function isNoisyKeyword(keyword: string, commodity: CommodityKey) {
  if (!keyword) return true;
  if (/^\d{4}$/.test(keyword)) return true;
  if (/^\d+$/.test(keyword)) return true;
  if (TEMPORAL_NOISE_TERMS.has(keyword)) return true;
  if (SOURCE_NOISE_TERMS.has(keyword)) return true;

  const commodityTerms = parseKeywordsForMatch(NEWS_QUERY_TERMS[commodity] ?? [commodityProfiles[commodity].enName]);
  const commodityTokenSet = new Set(
    commodityTerms
      .flatMap((term) => term.split(" "))
      .filter((term) => term.length >= 3),
  );
  if (commodityTokenSet.has(keyword)) return true;

  return false;
}

function phraseLikelyMentioned(normalizedTitle: string, phrase: string) {
  if (normalizedTitle.includes(phrase)) return true;
  const phraseTokens = phrase.split(" ").filter((token) => token.length >= 3);
  if (phraseTokens.length < 2) return false;
  const hitCount = phraseTokens.reduce(
    (sum, token) => (normalizedTitle.includes(token) ? sum + 1 : sum),
    0,
  );
  return hitCount >= Math.min(2, phraseTokens.length);
}

function extractKeywordStats(
  commodity: CommodityKey,
  items: Array<{ title: string; tone: NewsTone }>,
): CommodityKeywordStat[] {
  const keywordMap = new Map<string, CommodityKeywordStat>();

  const putKeyword = (keywordRaw: string, tone: NewsTone) => {
    const keyword = normalizeForKeywordMatch(keywordRaw);
    if (!keyword || keyword.length < 3 || HEADLINE_STOPWORDS.has(keyword)) return;
    if (isNoisyKeyword(keyword, commodity)) return;
    const existing = keywordMap.get(keyword) ?? {
      keyword,
      count: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
    };
    existing.count += 1;
    if (tone === "positive") existing.positive += 1;
    else if (tone === "negative") existing.negative += 1;
    else existing.neutral += 1;
    keywordMap.set(keyword, existing);
  };

  const phraseHints = parseKeywordsForMatch([
    ...(KEYWORD_MINING_TERMS[commodity] ?? []),
    ...(NEWS_KEYWORD_HINTS[commodity] ?? []),
  ])
    .filter((phrase) => phrase.includes(" ") || phrase.length >= 8)
    .filter((phrase) => !isNoisyKeyword(phrase, commodity));

  // 1) Prefer curated phrase-level signals.
  items.forEach((item) => {
    const normalizedTitle = normalizeForKeywordMatch(item.title);
    phraseHints.forEach((phrase) => {
      if (phraseLikelyMentioned(normalizedTitle, phrase)) {
        putKeyword(phrase, item.tone);
      }
    });
  });

  if (commodity === "gold") {
    return Array.from(keywordMap.values())
      .filter((entry) => entry.count >= 1)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.keyword.localeCompare(b.keyword);
      })
      .slice(0, 12);
  }

  // 2) Backfill with filtered single tokens only when phrase counts are too sparse.
  const strongPhraseCount = Array.from(keywordMap.values()).filter((entry) => entry.count >= 2).length;
  if (strongPhraseCount < 6) {
    items.forEach((item) => {
      tokenizeHeadline(item.title).forEach((token) => putKeyword(token, item.tone));
    });
  }

  return Array.from(keywordMap.values())
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.keyword.localeCompare(b.keyword);
    })
    .slice(0, 14);
}

async function buildNewsSnapshot(
  commodity: CommodityKey,
  plans: FactorPlan[],
): Promise<CommodityNewsSnapshot | null> {
  const articles = await fetchCommodityNewsArticles(commodity, { maxRecords: 60, timespan: "14days" });
  if (articles.length === 0) return null;

  const factorLabelByKey = new Map(plans.map((plan) => [plan.key, plan.label]));
  const factorTermsByKey = new Map(
    plans.map((plan) => [plan.key, parseKeywordsForMatch(getFactorNewsTerms(plan.key))]),
  );
  const coverageCounter = new Map<string, number>();

  const enriched = articles.map((article, index) => {
    const title = article.title?.trim() ?? "";
    const url = article.url?.trim() ?? "";
    const publishedAt = parseGdeltSeenDate(article.seendate) ?? new Date().toISOString();
    const tone = classifyNewsTitleTone(title);
    const normalizedTitle = normalizeForKeywordMatch(title);
    const matchedDrivers = Array.from(factorTermsByKey.entries())
      .filter(([, terms]) => terms.length > 0 && terms.some((term) => normalizedTitle.includes(term)))
      .map(([key]) => key);
    matchedDrivers.forEach((key) => {
      coverageCounter.set(key, (coverageCounter.get(key) ?? 0) + 1);
    });
    const relevance = matchedDrivers.length * 3 + (tone.tone === "neutral" ? 0 : 1) + Math.max(0, 10 - index);

    return {
      title,
      url,
      domain: article.domain,
      publishedAt,
      tone: tone.tone,
      relevance,
      matchedDrivers,
    };
  });

  const majorNews = enriched
    .filter((item) => Boolean(item.title) && Boolean(item.url))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);

  const keywordStats = extractKeywordStats(
    commodity,
    enriched.map((item) => ({ title: item.title, tone: item.tone })),
  );

  const driverCoverage = Array.from(coverageCounter.entries())
    .map(([key, count]) => ({
      key,
      label: factorLabelByKey.get(key) ?? key,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    items: majorNews,
    keywords: keywordStats,
    driverCoverage,
    sourceNote: "GDELT DOC 14-day window (fallback: Google News RSS)",
    sourceLinks: [
      {
        label: "GDELT query",
        href: `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(
          buildCommodityNewsQuery(commodity),
        )}&mode=ArtList&format=json&maxrecords=60&timespan=14days&sort=datedesc`,
      },
    ],
    updatedAt:
      majorNews
        .map((item) => item.publishedAt)
        .sort()
        .at(-1) ?? new Date().toISOString(),
  };
}

async function buildNewsDriver(commodity: CommodityKey): Promise<DriverSignal> {
  const articles = await fetchCommodityNewsArticles(commodity);
  if (articles.length === 0) {
    throw new Error("no news articles");
  }

  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  let weightedScore = 0;
  const headlineNotes: string[] = [];

  articles.forEach((article) => {
    const title = article.title ?? "";
    const tone = classifyNewsTitleTone(title);
    if (tone.tone === "positive") positiveCount += 1;
    else if (tone.tone === "negative") negativeCount += 1;
    else neutralCount += 1;
    weightedScore += tone.score;
  });

  const normalizedScore = (weightedScore / Math.max(articles.length, 1)) * 20;
  const direction: DriverDirection =
    normalizedScore > 2 ? "positive" : normalizedScore < -2 ? "negative" : "neutral";

  const top3 = articles.slice(0, 3);
  top3.forEach((article, index) => {
    const title = article.title ?? "";
    const tone = classifyNewsTitleTone(title);
    const toneLabel = tone.tone === "positive" ? "正向" : tone.tone === "negative" ? "負向" : "中性";
    headlineNotes.push(`${index + 1}. ${title}（${toneLabel}）`);
  });

  const latestArticleDate =
    articles
      .map((article) => parseGdeltSeenDate(article.seendate))
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1) ?? new Date().toISOString();

  const queryUrl = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  queryUrl.searchParams.set("query", buildFactorAwareNewsQuery(commodity));
  queryUrl.searchParams.set("mode", "ArtList");
  queryUrl.searchParams.set("format", "json");
  queryUrl.searchParams.set("maxrecords", "30");
  queryUrl.searchParams.set("timespan", "7days");
  queryUrl.searchParams.set("sort", "datedesc");

  return {
    id: `driver-${commodity}-news-flow`,
    label: "新聞事件流（7日）",
    horizon: "short",
    direction,
    scoreLabel: signedPct(normalizedScore),
    statusText: `近 7 日新聞：正向 ${positiveCount} / 負向 ${negativeCount} / 中性 ${neutralCount}，綜合判讀為${
      direction === "positive" ? "偏正向" : direction === "negative" ? "偏負向" : "中性"
    }。`,
    rationale: [
      "學理依據：供給中斷、政策調整、需求訊號常先透過新聞流反映到短線風險溢價。",
      `樣本數：${articles.length} 則（近 7 日）`,
      ...headlineNotes,
    ],
    updatedAt: latestArticleDate,
    sourceNote: "GDELT DOC global news (fallback: Google News RSS)",
    sourceLinks: [
      { label: "GDELT query", href: queryUrl.toString() },
      ...articles.slice(0, 5).map((article, index) => ({
        label: `News ${index + 1}${article.domain ? ` (${article.domain})` : ""}`,
        href: article.url ?? "#",
      })),
    ],
  };
}

function parseKeywordsForMatch(rawTerms: string[]) {
  return rawTerms
    .map((term) => normalizeForKeywordMatch(term))
    .filter((term) => term.length >= 3);
}

function titleMatchesTerms(title: string, terms: string[]) {
  const normalizedTitle = normalizeForKeywordMatch(title);
  return terms.some((term) => normalizedTitle.includes(term));
}

async function buildNewsBackedFactorSignal(
  commodity: CommodityKey,
  plan: FactorPlan,
): Promise<DriverSignal | null> {
  const commodityTerms = parseKeywordsForMatch(NEWS_QUERY_TERMS[commodity] ?? [commodityProfiles[commodity].enName]);
  const factorTerms = parseKeywordsForMatch(getFactorNewsTerms(plan.key));
  if (factorTerms.length === 0) return null;

  const query = buildFactorAwareNewsQuery(commodity, plan.key);
  const articles = await fetchCommodityNewsArticles(commodity, {
    queryOverride: query,
    maxRecords: 40,
    timespan: "10days",
  });
  if (articles.length < 4) return null;

  const relevant = articles.filter((article) => {
    const title = article.title ?? "";
    const commodityHit = titleMatchesTerms(title, commodityTerms);
    const factorHit = titleMatchesTerms(title, factorTerms);
    return commodityHit && factorHit;
  });

  // Common-sense gate: require both enough count and enough relevance ratio.
  if (relevant.length < 3 || relevant.length / articles.length < 0.35) return null;

  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  let weightedScore = 0;
  relevant.forEach((article) => {
    const title = article.title ?? "";
    const tone = classifyNewsTitleTone(title);
    if (tone.tone === "positive") positiveCount += 1;
    else if (tone.tone === "negative") negativeCount += 1;
    else neutralCount += 1;
    weightedScore += tone.score;
  });

  const normalizedScore = (weightedScore / Math.max(relevant.length, 1)) * 20;
  const direction: DriverDirection =
    normalizedScore > 2 ? "positive" : normalizedScore < -2 ? "negative" : "neutral";
  const latestArticleDate =
    relevant
      .map((article) => parseGdeltSeenDate(article.seendate))
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1) ?? new Date().toISOString();

  return {
    id: `driver-${commodity}-${plan.key}-news`,
    label: plan.label,
    horizon: plan.horizon ?? "long",
    direction,
    scoreLabel: signedPct(normalizedScore),
    statusText: `${plan.label}：以新聞證據補齊，近 10 日相關新聞 ${relevant.length} 則，判讀為${
      direction === "positive" ? "偏正向" : direction === "negative" ? "偏負向" : "中性"
    }。`,
    rationale: [
      `學理依據：${plan.theory}`,
      "目前無穩定結構化 API，暫以新聞事件流作為替代訊號（GDELT/Google RSS）。",
      `可用性檢核：樣本 ${articles.length} 則、通過因子語意篩選 ${relevant.length} 則。`,
      `新聞結構：正向 ${positiveCount} / 負向 ${negativeCount} / 中性 ${neutralCount}`,
    ],
    updatedAt: latestArticleDate,
    sourceNote: `${plan.sourceHint} (news-backed proxy via GDELT/Google RSS)`,
    sourceLinks: [
      { label: "GDELT factor query", href: `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&format=json&maxrecords=40&timespan=10days&sort=datedesc` },
      ...relevant.slice(0, 4).map((article, index) => ({
        label: `Evidence ${index + 1}${article.domain ? ` (${article.domain})` : ""}`,
        href: article.url ?? "#",
      })),
    ],
  };
}

async function buildMacroDriver(commodity: CommodityKey): Promise<DriverSignal> {
  const [usd, rates, vix] = await Promise.all([
    fetchFredMetric("DTWEXBGS", "美元指數（Broad Dollar Index）", "index"),
    fetchFredMetric("DGS10", "美國 10 年期公債殖利率", "pct"),
    fetchFredMetric("VIXCLS", "VIX 風險指數", "index"),
  ]);

  const usdImpact = -usd.change20d;
  const ratesImpact = ENERGY_COMMODITIES.has(commodity)
    ? rates.change20d
    : SAFE_HAVEN_COMMODITIES.has(commodity)
      ? -rates.change20d
      : -rates.change20d * 0.5;
  const vixImpact = SAFE_HAVEN_COMMODITIES.has(commodity) ? vix.change20d : -vix.change20d;
  const composite = usdImpact * 0.5 + ratesImpact * 0.2 + vixImpact * 0.3;
  const direction: DriverDirection = composite >= 0 ? "positive" : "negative";

  const updatedAt = [usd.latestDate, rates.latestDate, vix.latestDate].sort().at(-1) ?? new Date().toISOString().slice(0, 10);

  return {
    id: `driver-${commodity}-macro`,
    label: "總體經濟環境（獨立）",
    direction,
    scoreLabel: signedPct(composite),
    statusText: `美元/利率/VIX 綜合分數 ${signedPct(composite)}。目前總體環境對 ${commodityProfiles[commodity].zhName} 期貨判讀為${
      direction === "positive" ? "偏正向" : "偏負向"
    }。`,
    rationale: [
      "學理依據：商品期貨會受美元流動性、利率折現與市場風險偏好共同影響。",
      `美元（20d）：${signedPct(usd.change20d)}，對商品通常為反向`,
      `10Y 殖利率（20d）：${signedPct(rates.change20d)}`,
      `VIX（20d）：${signedPct(vix.change20d)}`,
    ],
    updatedAt: new Date(`${updatedAt}T00:00:00.000Z`).toISOString(),
    sourceNote: "FRED macro composite",
    sourceLinks: [
      { label: "FRED DTWEXBGS", href: "https://fred.stlouisfed.org/series/DTWEXBGS" },
      { label: "FRED DGS10", href: "https://fred.stlouisfed.org/series/DGS10" },
      { label: "FRED VIXCLS", href: "https://fred.stlouisfed.org/series/VIXCLS" },
    ],
  };
}

async function buildAgriWeatherDriver(commodity: CommodityKey): Promise<DriverSignal | null> {
  if (!AGRI_COMMODITIES.has(commodity)) return null;

  const point = AGRI_WEATHER_POINTS[commodity];
  const endDate = addDays(new Date(), -1);
  const startDate = addDays(endDate, -29);
  const prevEndDate = addYears(endDate, -1);
  const prevStartDate = addYears(startDate, -1);

  const [current, previous] = await Promise.all([
    fetchPrecipTotal(point.lat, point.lon, formatDate(startDate), formatDate(endDate)),
    fetchPrecipTotal(point.lat, point.lon, formatDate(prevStartDate), formatDate(prevEndDate)),
  ]);

  const precipChange = pctChange(current.total, previous.total);
  const drynessPressure = -precipChange;
  const direction: DriverDirection = drynessPressure >= 0 ? "positive" : "negative";

  const archiveLink = `https://archive-api.open-meteo.com/v1/archive?latitude=${point.lat}&longitude=${point.lon}&start_date=${formatDate(
    startDate,
  )}&end_date=${formatDate(endDate)}&daily=precipitation_sum&timezone=UTC`;

  return {
    id: `driver-${commodity}-harvest-weather`,
    label: "收成天候（主產區降雨）",
    direction,
    scoreLabel: signedPct(drynessPressure),
    statusText: `${point.name} 近 30 日降雨 ${formatValue(current.total, "mm")}，較去年同期 ${signedPct(
      precipChange,
    )}。對收成供給壓力判讀為${direction === "positive" ? "偏正向（偏乾）" : "偏負向（偏濕）"}。`,
    rationale: [
      "學理依據：主產區天候會先影響單位產量與品質，進而改變收成預期與期貨風險溢價。",
      `本期降雨量：${formatValue(current.total, "mm")} (${formatDate(startDate)} ~ ${formatDate(endDate)})`,
      `去年同期：${formatValue(previous.total, "mm")}`,
      `降雨 YoY：${signedPct(precipChange)}（轉成供給壓力分數：${signedPct(drynessPressure)}）`,
    ],
    updatedAt: new Date(`${formatDate(endDate)}T00:00:00.000Z`).toISOString(),
    sourceNote: "Open-Meteo archive rainfall",
    sourceLinks: [
      { label: "Open-Meteo Archive", href: archiveLink },
      { label: "Location", href: `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lon}#map=5/${point.lat}/${point.lon}` },
    ],
  };
}

async function buildInputCostDriver(commodity: CommodityKey): Promise<DriverSignal> {
  const profile = COST_DEMAND_PROFILES[commodity];
  const metrics = await Promise.all(
    profile.components.map((item) => fetchFredMetric(item.seriesId, item.metricName, item.unit)),
  );

  const score = metrics.reduce((sum, metric, index) => {
    const component = profile.components[index];
    const directionalChange = component.polarity === "up" ? metric.change20d : -metric.change20d;
    return sum + directionalChange * component.weight;
  }, 0);

  const direction: DriverDirection = score >= 0 ? "positive" : "negative";
  const updatedAt = metrics.map((item) => item.latestDate).sort().at(-1) ?? new Date().toISOString().slice(0, 10);
  const rationale = metrics.map((metric, index) => {
    const component = profile.components[index];
    const signText = component.polarity === "up" ? "同向" : "反向";
    return `${metric.metricName}（20d）：${signedPct(metric.change20d)}，權重 ${Math.round(component.weight * 100)}%，${signText}計分`;
  });

  return {
    id: `driver-${commodity}-cost-demand`,
    label: profile.label,
    direction,
    scoreLabel: signedPct(score),
    statusText: `${profile.label} 綜合分數 ${signedPct(score)}，對 ${commodityProfiles[commodity].zhName} 期貨判讀為${
      direction === "positive" ? "偏正向" : "偏負向"
    }。`,
    rationale: [
      "學理依據：投入成本（能源、運輸、加工）變動會透過邊際成本傳導至期貨定價。",
      ...rationale,
    ],
    updatedAt: new Date(`${updatedAt}T00:00:00.000Z`).toISOString(),
    sourceNote: profile.sourceNote,
    sourceLinks: metrics.map((item) => ({
      label: `FRED ${item.seriesId}`,
      href: `https://fred.stlouisfed.org/series/${item.seriesId}`,
    })),
  };
}

async function buildTradeDemandDriver(commodity: CommodityKey): Promise<DriverSignal> {
  const latestRows = await fetchOecRows(commodity, "latest");
  const latestSummary = summarizeTradeRows(latestRows);
  if (!latestSummary.latestYear || latestSummary.total <= 0) {
    throw new Error("oec latest empty");
  }

  const previousYear = String(latestSummary.latestYear - 1);
  const prevRows = await fetchOecRows(commodity, previousYear);
  const prevSummary = summarizeTradeRows(prevRows);
  if (prevSummary.total <= 0) {
    throw new Error("oec previous empty");
  }

  const yoy = pctChange(latestSummary.total, prevSummary.total);
  const top3Delta = (latestSummary.top3Share - prevSummary.top3Share) * 100;
  const score = yoy - top3Delta * 0.2;
  const direction: DriverDirection = score >= 0 ? "positive" : "negative";
  const hs4Id = HS4_BY_COMMODITY[commodity];
  const latestUrl = `https://api-v2.oec.world/tesseract/data.jsonrecords?cube=trade_i_baci_a_22&drilldowns=Year,HS4,Exporter%20Country,Importer%20Country&measures=Trade%20Value&limit=65000,0&include=HS4:${hs4Id}&time=Year.latest`;
  const prevUrl = `https://api-v2.oec.world/tesseract/data.jsonrecords?cube=trade_i_baci_a_22&drilldowns=Year,HS4,Exporter%20Country,Importer%20Country&measures=Trade%20Value&limit=65000,0&include=HS4:${hs4Id};Year:${previousYear}`;

  return {
    id: `driver-${commodity}-trade-demand`,
    label: "國際貿易需求（OEC）",
    direction,
    scoreLabel: signedPct(score),
    statusText: `${latestSummary.latestYear} 年貿易金額較 ${previousYear} 年 ${signedPct(yoy)}，需求/流向綜合判讀為${
      direction === "positive" ? "偏正向" : "偏負向"
    }。`,
    rationale: [
      "學理依據：跨國貿易流量與集中度會影響邊際需求韌性與價格彈性。",
      `${latestSummary.latestYear} 總貿易額：$${(latestSummary.total / 1_000_000_000).toFixed(2)}B`,
      `${previousYear} 總貿易額：$${(prevSummary.total / 1_000_000_000).toFixed(2)}B`,
      `Top3 進口國集中度變化：${top3Delta >= 0 ? "+" : ""}${top3Delta.toFixed(2)} pct`,
    ],
    updatedAt: new Date().toISOString(),
    sourceNote: "OEC BACI trade dataset",
    sourceLinks: [
      { label: `OEC ${latestSummary.latestYear}`, href: latestUrl },
      { label: `OEC ${previousYear}`, href: prevUrl },
    ],
  };
}

async function buildSingleFredDriver(
  commodity: CommodityKey,
  config: {
    key: string;
    label: string;
    seriesId: string;
    metricName: string;
    unit: DriverUnit;
    bullishWhen: "up" | "down";
    theory: string;
    sourceNote: string;
  },
): Promise<DriverSignal> {
  const metric = await fetchFredMetric(config.seriesId, config.metricName, config.unit);
  const score = config.bullishWhen === "up" ? metric.change20d : -metric.change20d;
  const direction: DriverDirection = score >= 0 ? "positive" : "negative";
  const directionalText =
    config.bullishWhen === "up" ? "上升通常偏多" : "下降通常偏多（上升偏空）";

  return {
    id: `driver-${commodity}-${config.key}`,
    label: config.label,
    direction,
    scoreLabel: signedPct(score),
    statusText: `${config.metricName} 20 日變動 ${signedPct(metric.change20d)}，判讀為${
      direction === "positive" ? "偏正向" : "偏負向"
    }。`,
    rationale: [
      `學理依據：${config.theory}`,
      `最新值：${formatValue(metric.latest, config.unit)}（${metric.latestDate}）`,
      `20 日變動：${signedPct(metric.change20d)}；解讀規則：${directionalText}`,
    ],
    updatedAt: new Date(`${metric.latestDate}T00:00:00.000Z`).toISOString(),
    sourceNote: config.sourceNote,
    sourceLinks: [{ label: `FRED ${config.seriesId}`, href: `https://fred.stlouisfed.org/series/${config.seriesId}` }],
  };
}

async function buildEnergyCostDriver(
  commodity: CommodityKey,
  config: { key: string; label: string; theory: string; oilWeight: number; gasWeight: number; sourceNote: string },
): Promise<DriverSignal> {
  const [oil, gas] = await Promise.all([
    fetchFredMetric("DCOILWTICO", "WTI 現貨價格", "usd"),
    fetchFredMetric("DHHNGSP", "Henry Hub 天然氣現貨", "usd"),
  ]);
  const score = oil.change20d * config.oilWeight + gas.change20d * config.gasWeight;
  const direction: DriverDirection = score >= 0 ? "positive" : "negative";
  const updatedAt = [oil.latestDate, gas.latestDate].sort().at(-1) ?? new Date().toISOString().slice(0, 10);

  return {
    id: `driver-${commodity}-${config.key}`,
    label: config.label,
    direction,
    scoreLabel: signedPct(score),
    statusText: `${config.label} 綜合分數 ${signedPct(score)}，對 ${commodityProfiles[commodity].zhName} 判讀為${
      direction === "positive" ? "偏正向" : "偏負向"
    }。`,
    rationale: [
      `學理依據：${config.theory}`,
      `WTI（20d）：${signedPct(oil.change20d)}，權重 ${Math.round(config.oilWeight * 100)}%`,
      `Henry Hub（20d）：${signedPct(gas.change20d)}，權重 ${Math.round(config.gasWeight * 100)}%`,
      "解讀：冶煉/加工能耗上升通常抬升邊際成本，對金屬期貨偏多。",
    ],
    updatedAt: new Date(`${updatedAt}T00:00:00.000Z`).toISOString(),
    sourceNote: config.sourceNote,
    sourceLinks: [
      { label: "FRED DCOILWTICO", href: "https://fred.stlouisfed.org/series/DCOILWTICO" },
      { label: "FRED DHHNGSP", href: "https://fred.stlouisfed.org/series/DHHNGSP" },
    ],
  };
}

async function buildRealYieldDriver(
  commodity: CommodityKey,
  config: { key: string; label: string; theory: string; sourceNote: string },
): Promise<DriverSignal> {
  const [nominal10y, breakeven10y] = await Promise.all([
    fetchFredMetric("DGS10", "美國 10 年期公債殖利率", "pct"),
    fetchFredMetric("T10YIE", "美國 10 年期通膨預期（Breakeven）", "pct"),
  ]);

  const nominalPrev = nominal10y.latest / (1 + nominal10y.change20d / 100);
  const breakevenPrev = breakeven10y.latest / (1 + breakeven10y.change20d / 100);
  const realYieldLatest = nominal10y.latest - breakeven10y.latest;
  const realYieldPrev = nominalPrev - breakevenPrev;
  const realYieldDeltaPctPoint = realYieldLatest - realYieldPrev;
  const scoreBps = -realYieldDeltaPctPoint * 100;
  const direction: DriverDirection = scoreBps >= 0 ? "positive" : "negative";
  const updatedAt = [nominal10y.latestDate, breakeven10y.latestDate].sort().at(-1) ?? new Date().toISOString().slice(0, 10);

  return {
    id: `driver-${commodity}-${config.key}`,
    label: config.label,
    direction,
    scoreLabel: signedBps(scoreBps),
    statusText: `10Y 實質殖利率（名目-通膨預期）20 日變化 ${signedBps(
      realYieldDeltaPctPoint * 100,
    )}，對 ${commodityProfiles[commodity].zhName} 判讀為${direction === "positive" ? "偏正向" : "偏負向"}。`,
    rationale: [
      `學理依據：${config.theory}`,
      `最新名目殖利率：${formatValue(nominal10y.latest, "pct")}`,
      `最新通膨預期：${formatValue(breakeven10y.latest, "pct")}`,
      `最新實質殖利率：約 ${realYieldLatest.toFixed(2)}%`,
      "解讀：實質殖利率上升會提高持有無息資產的機會成本，通常壓抑金銀價格。",
    ],
    updatedAt: new Date(`${updatedAt}T00:00:00.000Z`).toISOString(),
    sourceNote: config.sourceNote,
    sourceLinks: [
      { label: "FRED DGS10", href: "https://fred.stlouisfed.org/series/DGS10" },
      { label: "FRED T10YIE", href: "https://fred.stlouisfed.org/series/T10YIE" },
    ],
  };
}

function metalPlanWithNoStableApi(
  key: string,
  label: string,
  theory: string,
  sourceHint: string,
  sourceLinks: Array<{ label: string; href: string }>,
): FactorPlan {
  return {
    key,
    label,
    theory,
    sourceHint,
    sourceLinks,
    task: async () => {
      throw new Error("no stable free API yet");
    },
  };
}

function getMetalFactorPlans(commodity: CommodityKey): FactorPlan[] {
  if (commodity === "aluminum") {
    return [
      {
        key: "industrial-demand",
        label: "製造業需求（工業生產代理）",
        theory: "鋁需求高度連動製造業、運輸與建築週期。",
        sourceHint: "FRED INDPRO",
        sourceLinks: [{ label: "FRED INDPRO", href: "https://fred.stlouisfed.org/series/INDPRO" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "industrial-demand",
            label: "製造業需求（工業生產代理）",
            seriesId: "INDPRO",
            metricName: "美國工業生產指數",
            unit: "index",
            bullishWhen: "up",
            theory: "鋁廣泛用於運輸、包材與建築，景氣擴張通常帶動需求。",
            sourceNote: "FRED industrial demand proxy",
          }),
      },
      {
        key: "smelting-energy-cost",
        label: "冶煉能源成本",
        theory: "鋁冶煉高度耗能，電力/能源成本會影響邊際供給價格。",
        sourceHint: "FRED WTI + Henry Hub",
        sourceLinks: [
          { label: "FRED DCOILWTICO", href: "https://fred.stlouisfed.org/series/DCOILWTICO" },
          { label: "FRED DHHNGSP", href: "https://fred.stlouisfed.org/series/DHHNGSP" },
        ],
        task: () =>
          buildEnergyCostDriver(commodity, {
            key: "smelting-energy-cost",
            label: "冶煉能源成本",
            theory: "鋁冶煉成本受能源價格牽動，成本上升常推升鋁價底部。",
            oilWeight: 0.35,
            gasWeight: 0.65,
            sourceNote: "FRED smelting-energy composite",
          }),
      },
      metalPlanWithNoStableApi(
        "bauxite-supply",
        "鋁土礦/氧化鋁供應擾動",
        "上游礦石與氧化鋁供給中斷會傳導到鋁錠供需平衡。",
        "USGS / 國別礦業統計（多為報告型資料）",
        [
          { label: "USGS Bauxite Statistics", href: "https://www.usgs.gov/centers/national-minerals-information-center/bauxite-and-alumina-statistics-and-information" },
        ],
      ),
      metalPlanWithNoStableApi(
        "china-capacity-policy",
        "中國產能/限電政策",
        "鋁冶煉產能集中，中國政策與限電常造成全球平衡快速變化。",
        "政策公告（尚無穩定免費 API）",
        [{ label: "NBS China", href: "https://www.stats.gov.cn/english/" }],
      ),
      {
        key: "trade-demand",
        label: "國際貿易需求（OEC）",
        theory: "貿易金額與集中度變化反映終端需求與區域供應鏈韌性。",
        sourceHint: "OEC BACI",
        sourceLinks: [{ label: "OEC API", href: "https://api-v2.oec.world/" }],
        task: () => buildTradeDemandDriver(commodity),
      },
    ];
  }

  if (commodity === "copper") {
    return [
      {
        key: "industrial-demand",
        label: "工業/電網需求（工業生產代理）",
        theory: "銅對工業週期與電力基建需求高度敏感。",
        sourceHint: "FRED INDPRO",
        sourceLinks: [{ label: "FRED INDPRO", href: "https://fred.stlouisfed.org/series/INDPRO" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "industrial-demand",
            label: "工業/電網需求（工業生產代理）",
            seriesId: "INDPRO",
            metricName: "美國工業生產指數",
            unit: "index",
            bullishWhen: "up",
            theory: "工業擴張與電網投資增加時，銅需求通常同步走強。",
            sourceNote: "FRED copper demand proxy",
          }),
      },
      {
        key: "energy-cost",
        label: "礦冶能源成本",
        theory: "採礦、冶煉與運輸成本上升，會提高銅邊際供給成本。",
        sourceHint: "FRED WTI + Henry Hub",
        sourceLinks: [
          { label: "FRED DCOILWTICO", href: "https://fred.stlouisfed.org/series/DCOILWTICO" },
          { label: "FRED DHHNGSP", href: "https://fred.stlouisfed.org/series/DHHNGSP" },
        ],
        task: () =>
          buildEnergyCostDriver(commodity, {
            key: "energy-cost",
            label: "礦冶能源成本",
            theory: "能源價格影響礦端與冶煉端成本，常透過供給曲線反映到銅價。",
            oilWeight: 0.5,
            gasWeight: 0.5,
            sourceNote: "FRED copper mining/smelting cost composite",
          }),
      },
      metalPlanWithNoStableApi(
        "mine-disruption",
        "礦山供給中斷（智利/秘魯）",
        "銅礦集中於少數國家，罷工、品位與天候中斷會快速影響供給。",
        "礦商揭露與行業報告（尚無穩定免費 API）",
        [
          { label: "USGS Copper", href: "https://www.usgs.gov/centers/national-minerals-information-center/copper-statistics-and-information" },
        ],
      ),
      metalPlanWithNoStableApi(
        "tc-rc",
        "精煉加工費（TC/RC）",
        "TC/RC 代表精礦緊俏程度，是銅供需的重要先行訊號。",
        "Fastmarkets/行業資料（多為付費）",
        [{ label: "ICSG", href: "https://www.icsg.org/" }],
      ),
      {
        key: "trade-demand",
        label: "國際貿易需求（OEC）",
        theory: "進出口總量與集中度變化，反映銅終端需求與供應鏈配置。",
        sourceHint: "OEC BACI",
        sourceLinks: [{ label: "OEC API", href: "https://api-v2.oec.world/" }],
        task: () => buildTradeDemandDriver(commodity),
      },
    ];
  }

  if (commodity === "nickel") {
    return [
      {
        key: "stainless-demand",
        label: "不鏽鋼需求代理（工業生產）",
        theory: "鎳需求主要由不鏽鋼鏈條驅動，景氣循環影響顯著。",
        sourceHint: "FRED INDPRO",
        sourceLinks: [{ label: "FRED INDPRO", href: "https://fred.stlouisfed.org/series/INDPRO" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "stainless-demand",
            label: "不鏽鋼需求代理（工業生產）",
            seriesId: "INDPRO",
            metricName: "美國工業生產指數",
            unit: "index",
            bullishWhen: "up",
            theory: "工業循環上行時，不鏽鋼鏈需求通常增加，帶動鎳價。",
            sourceNote: "FRED nickel demand proxy",
          }),
      },
      {
        key: "energy-cost",
        label: "高壓酸浸與冶煉成本",
        theory: "鎳中間品加工能耗高，能源價格會影響供給成本曲線。",
        sourceHint: "FRED WTI + Henry Hub",
        sourceLinks: [
          { label: "FRED DCOILWTICO", href: "https://fred.stlouisfed.org/series/DCOILWTICO" },
          { label: "FRED DHHNGSP", href: "https://fred.stlouisfed.org/series/DHHNGSP" },
        ],
        task: () =>
          buildEnergyCostDriver(commodity, {
            key: "energy-cost",
            label: "高壓酸浸與冶煉成本",
            theory: "鎳礦加工（含 HPAL）對能源與燃料價格敏感。",
            oilWeight: 0.55,
            gasWeight: 0.45,
            sourceNote: "FRED nickel processing cost composite",
          }),
      },
      metalPlanWithNoStableApi(
        "indonesia-policy",
        "印尼礦政策/出口節奏",
        "印尼政策（礦石出口、冶煉配套）是鎳供給結構核心變數。",
        "政策公告（尚無穩定免費 API）",
        [{ label: "Indonesia MEMR", href: "https://www.esdm.go.id/en" }],
      ),
      metalPlanWithNoStableApi(
        "battery-demand",
        "電池需求（EV 三元材料）",
        "電池級鎳需求受 EV 產銷、電池化學體系轉換影響。",
        "EV/電池資料（來源分散）",
        [{ label: "IEA EV Data", href: "https://www.iea.org/data-and-statistics/data-tools/global-ev-data-explorer" }],
      ),
      {
        key: "trade-demand",
        label: "國際貿易需求（OEC）",
        theory: "鎳貿易流向變化可反映供應鏈重組與需求韌性。",
        sourceHint: "OEC BACI",
        sourceLinks: [{ label: "OEC API", href: "https://api-v2.oec.world/" }],
        task: () => buildTradeDemandDriver(commodity),
      },
    ];
  }

  if (commodity === "zinc") {
    return [
      {
        key: "galvanized-demand",
        label: "鍍鋅鋼需求代理（工業生產）",
        theory: "鋅需求高度連動鍍鋅鋼與基礎建設周期。",
        sourceHint: "FRED INDPRO",
        sourceLinks: [{ label: "FRED INDPRO", href: "https://fred.stlouisfed.org/series/INDPRO" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "galvanized-demand",
            label: "鍍鋅鋼需求代理（工業生產）",
            seriesId: "INDPRO",
            metricName: "美國工業生產指數",
            unit: "index",
            bullishWhen: "up",
            theory: "製造與建設需求擴張時，鍍鋅鋼鏈通常拉動鋅需求。",
            sourceNote: "FRED zinc demand proxy",
          }),
      },
      {
        key: "smelter-energy-cost",
        label: "冶煉能源成本",
        theory: "鋅冶煉對電力與燃料敏感，成本端波動會影響價格底部。",
        sourceHint: "FRED WTI + Henry Hub",
        sourceLinks: [
          { label: "FRED DCOILWTICO", href: "https://fred.stlouisfed.org/series/DCOILWTICO" },
          { label: "FRED DHHNGSP", href: "https://fred.stlouisfed.org/series/DHHNGSP" },
        ],
        task: () =>
          buildEnergyCostDriver(commodity, {
            key: "smelter-energy-cost",
            label: "冶煉能源成本",
            theory: "鋅冶煉成本受電價與燃料價格影響，常傳導到現貨升貼水。",
            oilWeight: 0.4,
            gasWeight: 0.6,
            sourceNote: "FRED zinc smelting-energy composite",
          }),
      },
      metalPlanWithNoStableApi(
        "mine-supply",
        "礦端供給中斷",
        "鋅礦供給集中且受地緣與勞資事件影響，會改變精礦可得性。",
        "礦商公告（尚無穩定免費 API）",
        [{ label: "USGS Zinc", href: "https://www.usgs.gov/centers/national-minerals-information-center/zinc-statistics-and-information" }],
      ),
      metalPlanWithNoStableApi(
        "tc-benchmark",
        "冶煉加工費（Benchmark TC）",
        "TC 高低反映精礦鬆緊，常是鋅市場供需先行指標。",
        "行業價格服務（多為付費）",
        [{ label: "ILZSG", href: "https://www.ilzsg.org/" }],
      ),
      {
        key: "trade-demand",
        label: "國際貿易需求（OEC）",
        theory: "鋅的跨國流向可反映鍍鋅鋼鏈需求區域變化。",
        sourceHint: "OEC BACI",
        sourceLinks: [{ label: "OEC API", href: "https://api-v2.oec.world/" }],
        task: () => buildTradeDemandDriver(commodity),
      },
    ];
  }

  if (commodity === "lead") {
    return [
      {
        key: "industrial-demand",
        label: "工業與電池需求代理（工業生產）",
        theory: "鉛需求與電池替換周期、工業活動連動。",
        sourceHint: "FRED INDPRO",
        sourceLinks: [{ label: "FRED INDPRO", href: "https://fred.stlouisfed.org/series/INDPRO" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "industrial-demand",
            label: "工業與電池需求代理（工業生產）",
            seriesId: "INDPRO",
            metricName: "美國工業生產指數",
            unit: "index",
            bullishWhen: "up",
            theory: "鉛酸電池替換需求與工業活動變化，會影響鉛消費強度。",
            sourceNote: "FRED lead demand proxy",
          }),
      },
      {
        key: "smelter-energy-cost",
        label: "冶煉與回收成本",
        theory: "鉛冶煉與再生鉛處理成本受能源價格牽動。",
        sourceHint: "FRED WTI + Henry Hub",
        sourceLinks: [
          { label: "FRED DCOILWTICO", href: "https://fred.stlouisfed.org/series/DCOILWTICO" },
          { label: "FRED DHHNGSP", href: "https://fred.stlouisfed.org/series/DHHNGSP" },
        ],
        task: () =>
          buildEnergyCostDriver(commodity, {
            key: "smelter-energy-cost",
            label: "冶煉與回收成本",
            theory: "能源成本上升通常提高再生鉛與精煉鉛邊際成本，支撐價格底部。",
            oilWeight: 0.45,
            gasWeight: 0.55,
            sourceNote: "FRED lead smelting/recycling cost composite",
          }),
      },
      metalPlanWithNoStableApi(
        "recycling-supply",
        "再生鉛供應比重",
        "鉛具有高回收比率，再生鉛供應變化可平抑或放大價格波動。",
        "國際再生金屬報告（尚無穩定免費 API）",
        [{ label: "ILZSG", href: "https://www.ilzsg.org/" }],
      ),
      metalPlanWithNoStableApi(
        "mine-supply-policy",
        "礦山供給與環保政策",
        "礦山停產、環保整治與政策調整會改變精礦供應。",
        "礦業公告/統計（尚無穩定免費 API）",
        [{ label: "USGS Lead", href: "https://www.usgs.gov/centers/national-minerals-information-center/lead-statistics-and-information" }],
      ),
      {
        key: "trade-demand",
        label: "國際貿易需求（OEC）",
        theory: "跨國流向與進口集中度可反映鉛終端需求韌性。",
        sourceHint: "OEC BACI",
        sourceLinks: [{ label: "OEC API", href: "https://api-v2.oec.world/" }],
        task: () => buildTradeDemandDriver(commodity),
      },
    ];
  }

  if (commodity === "tin") {
    return [
      {
        key: "industrial-demand",
        label: "電子焊料需求代理（工業生產）",
        theory: "錫需求高度連動電子製造與焊料消費週期。",
        sourceHint: "FRED INDPRO",
        sourceLinks: [{ label: "FRED INDPRO", href: "https://fred.stlouisfed.org/series/INDPRO" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "industrial-demand",
            label: "電子焊料需求代理（工業生產）",
            seriesId: "INDPRO",
            metricName: "美國工業生產指數",
            unit: "index",
            bullishWhen: "up",
            theory: "電子與工業需求上升時，焊料用錫需求通常同步改善。",
            sourceNote: "FRED tin demand proxy",
          }),
      },
      {
        key: "energy-cost",
        label: "冶煉能源成本",
        theory: "錫冶煉成本受燃料與電力價格影響。",
        sourceHint: "FRED WTI + Henry Hub",
        sourceLinks: [
          { label: "FRED DCOILWTICO", href: "https://fred.stlouisfed.org/series/DCOILWTICO" },
          { label: "FRED DHHNGSP", href: "https://fred.stlouisfed.org/series/DHHNGSP" },
        ],
        task: () =>
          buildEnergyCostDriver(commodity, {
            key: "energy-cost",
            label: "冶煉能源成本",
            theory: "能源價格上行會抬升冶煉成本，影響現貨升貼水與期貨估值。",
            oilWeight: 0.5,
            gasWeight: 0.5,
            sourceNote: "FRED tin smelting cost composite",
          }),
      },
      metalPlanWithNoStableApi(
        "indonesia-myanmar-supply",
        "印尼/緬甸供給政策",
        "錫礦供應集中度高，產地政策與許可會改變供給節奏。",
        "政策公告（尚無穩定免費 API）",
        [{ label: "ITRI Tin", href: "https://www.internationaltin.org/" }],
      ),
      metalPlanWithNoStableApi(
        "exchange-inventory",
        "交易所與現貨庫存",
        "低庫存環境下，錫價對供應中斷與需求回升更敏感。",
        "庫存資料來源分散",
        [{ label: "LME Tin", href: "https://www.lme.com/en/Metals/Non-ferrous/LME-Tin" }],
      ),
      {
        key: "trade-demand",
        label: "國際貿易需求（OEC）",
        theory: "貿易總量與集中度可反映電子供應鏈景氣。",
        sourceHint: "OEC BACI",
        sourceLinks: [{ label: "OEC API", href: "https://api-v2.oec.world/" }],
        task: () => buildTradeDemandDriver(commodity),
      },
    ];
  }

  if (commodity === "cobalt") {
    return [
      {
        key: "industrial-demand",
        label: "工業需求代理（工業生產）",
        theory: "鈷需求與電池與高溫合金景氣循環相關。",
        sourceHint: "FRED INDPRO",
        sourceLinks: [{ label: "FRED INDPRO", href: "https://fred.stlouisfed.org/series/INDPRO" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "industrial-demand",
            label: "工業需求代理（工業生產）",
            seriesId: "INDPRO",
            metricName: "美國工業生產指數",
            unit: "index",
            bullishWhen: "up",
            theory: "工業活動擴張時，鈷在合金與材料端需求通常偏強。",
            sourceNote: "FRED cobalt demand proxy",
          }),
      },
      {
        key: "energy-cost",
        label: "精煉加工能源成本",
        theory: "鈷中間品與精煉加工成本受能源價格波動影響。",
        sourceHint: "FRED WTI + Henry Hub",
        sourceLinks: [
          { label: "FRED DCOILWTICO", href: "https://fred.stlouisfed.org/series/DCOILWTICO" },
          { label: "FRED DHHNGSP", href: "https://fred.stlouisfed.org/series/DHHNGSP" },
        ],
        task: () =>
          buildEnergyCostDriver(commodity, {
            key: "energy-cost",
            label: "精煉加工能源成本",
            theory: "能源成本上行會推高鈷材料轉換成本，提升價格支撐。",
            oilWeight: 0.55,
            gasWeight: 0.45,
            sourceNote: "FRED cobalt processing cost composite",
          }),
      },
      metalPlanWithNoStableApi(
        "drc-supply-risk",
        "DR Congo 供給風險",
        "鈷礦供給集中於 DR Congo，地緣與物流風險會放大價格波動。",
        "礦業公告（尚無穩定免費 API）",
        [{ label: "USGS Cobalt", href: "https://www.usgs.gov/centers/national-minerals-information-center/cobalt-statistics-and-information" }],
      ),
      metalPlanWithNoStableApi(
        "battery-chemistry-shift",
        "電池化學配方轉換",
        "高鎳低鈷或磷酸鐵鋰配方變化會改變中長期鈷需求。",
        "行業研究資料（尚無統一 API）",
        [{ label: "IEA Batteries", href: "https://www.iea.org/reports/global-ev-outlook-2025" }],
      ),
      {
        key: "trade-demand",
        label: "國際貿易需求（OEC）",
        theory: "鈷材料跨國流向反映電池供應鏈景氣與配置變化。",
        sourceHint: "OEC BACI",
        sourceLinks: [{ label: "OEC API", href: "https://api-v2.oec.world/" }],
        task: () => buildTradeDemandDriver(commodity),
      },
    ];
  }

  if (commodity === "lithium") {
    return [
      {
        key: "industrial-demand",
        label: "電池需求代理（工業生產）",
        theory: "鋰需求與電池鏈景氣高度連動，工業活動可作為短期代理訊號。",
        sourceHint: "FRED INDPRO",
        sourceLinks: [{ label: "FRED INDPRO", href: "https://fred.stlouisfed.org/series/INDPRO" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "industrial-demand",
            label: "電池需求代理（工業生產）",
            seriesId: "INDPRO",
            metricName: "美國工業生產指數",
            unit: "index",
            bullishWhen: "up",
            theory: "工業活動與新能源鏈需求回升，通常改善鋰材料採購動能。",
            sourceNote: "FRED lithium demand proxy",
          }),
      },
      {
        key: "energy-cost",
        label: "精煉能源成本",
        theory: "碳酸鋰與氫氧化鋰精煉成本受能源與化工成本影響。",
        sourceHint: "FRED WTI + Henry Hub",
        sourceLinks: [
          { label: "FRED DCOILWTICO", href: "https://fred.stlouisfed.org/series/DCOILWTICO" },
          { label: "FRED DHHNGSP", href: "https://fred.stlouisfed.org/series/DHHNGSP" },
        ],
        task: () =>
          buildEnergyCostDriver(commodity, {
            key: "energy-cost",
            label: "精煉能源成本",
            theory: "能源成本上行通常抬升鋰鹽加工邊際成本。",
            oilWeight: 0.5,
            gasWeight: 0.5,
            sourceNote: "FRED lithium refining cost composite",
          }),
      },
      metalPlanWithNoStableApi(
        "mine-project-pipeline",
        "新增礦山/鹽湖投產進度",
        "鋰市場常由新增產能時程決定中長期供給斜率。",
        "項目資料分散（尚無穩定免費 API）",
        [{ label: "USGS Lithium", href: "https://www.usgs.gov/centers/national-minerals-information-center/lithium-statistics-and-information" }],
      ),
      metalPlanWithNoStableApi(
        "ev-policy-demand",
        "EV 政策與補貼需求",
        "補貼與法規調整會改變終端銷售與鋰鹽需求預期。",
        "政策資料分散（尚無統一 API）",
        [{ label: "IEA EV Outlook", href: "https://www.iea.org/reports/global-ev-outlook-2025" }],
      ),
      {
        key: "trade-demand",
        label: "國際貿易需求（OEC）",
        theory: "鋰材料跨國流向可反映電池供應鏈的去庫存與再補庫節奏。",
        sourceHint: "OEC BACI",
        sourceLinks: [{ label: "OEC API", href: "https://api-v2.oec.world/" }],
        task: () => buildTradeDemandDriver(commodity),
      },
    ];
  }

  if (commodity === "gallium") {
    return [
      {
        key: "industrial-demand",
        label: "半導體需求代理（工業生產）",
        theory: "鎵需求與功率半導體、射頻元件景氣循環連動。",
        sourceHint: "FRED INDPRO",
        sourceLinks: [{ label: "FRED INDPRO", href: "https://fred.stlouisfed.org/series/INDPRO" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "industrial-demand",
            label: "半導體需求代理（工業生產）",
            seriesId: "INDPRO",
            metricName: "美國工業生產指數",
            unit: "index",
            bullishWhen: "up",
            theory: "工業與電子景氣改善時，GaAs/GaN 材料需求通常上升。",
            sourceNote: "FRED gallium demand proxy",
          }),
      },
      {
        key: "energy-cost",
        label: "精煉成本",
        theory: "鎵精煉與提純成本受能源與化工成本影響。",
        sourceHint: "FRED WTI + Henry Hub",
        sourceLinks: [
          { label: "FRED DCOILWTICO", href: "https://fred.stlouisfed.org/series/DCOILWTICO" },
          { label: "FRED DHHNGSP", href: "https://fred.stlouisfed.org/series/DHHNGSP" },
        ],
        task: () =>
          buildEnergyCostDriver(commodity, {
            key: "energy-cost",
            label: "精煉成本",
            theory: "能源成本走高通常抬升高純鎵邊際加工成本。",
            oilWeight: 0.45,
            gasWeight: 0.55,
            sourceNote: "FRED gallium refining cost composite",
          }),
      },
      metalPlanWithNoStableApi(
        "export-policy",
        "出口政策與管制",
        "鎵屬於戰略材料，出口管制與許可制度會直接影響供給可得性。",
        "政策公告（尚無穩定免費 API）",
        [{ label: "China MOFCOM", href: "http://english.mofcom.gov.cn/" }],
      ),
      metalPlanWithNoStableApi(
        "gaas-gan-cycle",
        "GaAs/GaN 終端需求循環",
        "通訊、電源與軍工應用景氣會改變中長期鎵材料需求斜率。",
        "行業資料來源分散",
        [{ label: "SEMI", href: "https://www.semi.org/en" }],
      ),
      {
        key: "trade-demand",
        label: "國際貿易需求（OEC）",
        theory: "跨國流向與集中度可反映半導體材料供需緊張程度。",
        sourceHint: "OEC BACI",
        sourceLinks: [{ label: "OEC API", href: "https://api-v2.oec.world/" }],
        task: () => buildTradeDemandDriver(commodity),
      },
    ];
  }

  if (commodity === "germanium") {
    return [
      {
        key: "industrial-demand",
        label: "光學需求代理（工業生產）",
        theory: "鍺需求與光纖、紅外元件、工業與防務周期連動。",
        sourceHint: "FRED INDPRO",
        sourceLinks: [{ label: "FRED INDPRO", href: "https://fred.stlouisfed.org/series/INDPRO" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "industrial-demand",
            label: "光學需求代理（工業生產）",
            seriesId: "INDPRO",
            metricName: "美國工業生產指數",
            unit: "index",
            bullishWhen: "up",
            theory: "工業與通訊景氣提升時，鍺在光學材料端需求通常改善。",
            sourceNote: "FRED germanium demand proxy",
          }),
      },
      {
        key: "energy-cost",
        label: "精煉成本",
        theory: "鍺提純與加工成本受能源價格影響。",
        sourceHint: "FRED WTI + Henry Hub",
        sourceLinks: [
          { label: "FRED DCOILWTICO", href: "https://fred.stlouisfed.org/series/DCOILWTICO" },
          { label: "FRED DHHNGSP", href: "https://fred.stlouisfed.org/series/DHHNGSP" },
        ],
        task: () =>
          buildEnergyCostDriver(commodity, {
            key: "energy-cost",
            label: "精煉成本",
            theory: "能源成本上升通常推高高純鍺精煉成本。",
            oilWeight: 0.5,
            gasWeight: 0.5,
            sourceNote: "FRED germanium refining cost composite",
          }),
      },
      metalPlanWithNoStableApi(
        "export-policy",
        "出口政策與許可制度",
        "鍺屬戰略材料，出口限制或許可制度會放大供應風險。",
        "政策公告（尚無穩定免費 API）",
        [{ label: "China MOFCOM", href: "http://english.mofcom.gov.cn/" }],
      ),
      metalPlanWithNoStableApi(
        "optics-defense-demand",
        "光學與防務需求",
        "光纖、紅外與防務需求變化會改變鍺中長期需求曲線。",
        "產業資料來源分散",
        [{ label: "OECD Strategic Materials", href: "https://www.oecd.org/en/topics/sub-issues/critical-minerals.html" }],
      ),
      {
        key: "trade-demand",
        label: "國際貿易需求（OEC）",
        theory: "貿易流量與集中度可反映鍺材料供應鏈韌性。",
        sourceHint: "OEC BACI",
        sourceLinks: [{ label: "OEC API", href: "https://api-v2.oec.world/" }],
        task: () => buildTradeDemandDriver(commodity),
      },
    ];
  }

  if (commodity === "gold") {
    return [
      {
        key: "real-yield",
        label: "實質利率（機會成本）",
        theory: "黃金為無息資產，實質利率上升通常壓抑金價。",
        sourceHint: "FRED DGS10 + T10YIE",
        sourceLinks: [
          { label: "FRED DGS10", href: "https://fred.stlouisfed.org/series/DGS10" },
          { label: "FRED T10YIE", href: "https://fred.stlouisfed.org/series/T10YIE" },
        ],
        task: () =>
          buildRealYieldDriver(commodity, {
            key: "real-yield",
            label: "實質利率（機會成本）",
            theory: "實質殖利率下降時，持有黃金的相對機會成本降低。",
            sourceNote: "FRED real-yield proxy",
          }),
      },
      {
        key: "usd-strength",
        label: "美元強弱",
        theory: "黃金以美元計價，美元走弱通常對金價偏多。",
        sourceHint: "FRED DTWEXBGS",
        sourceLinks: [{ label: "FRED DTWEXBGS", href: "https://fred.stlouisfed.org/series/DTWEXBGS" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "usd-strength",
            label: "美元強弱",
            seriesId: "DTWEXBGS",
            metricName: "美元指數（Broad）",
            unit: "index",
            bullishWhen: "down",
            theory: "美元走弱通常提升非美元買盤購買力，支持金價。",
            sourceNote: "FRED USD driver",
          }),
      },
      {
        key: "risk-aversion",
        label: "避險情緒（VIX）",
        theory: "市場風險偏好下降時，避險資產需求通常上升。",
        sourceHint: "FRED VIXCLS",
        sourceLinks: [{ label: "FRED VIXCLS", href: "https://fred.stlouisfed.org/series/VIXCLS" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "risk-aversion",
            label: "避險情緒（VIX）",
            seriesId: "VIXCLS",
            metricName: "VIX 風險指數",
            unit: "index",
            bullishWhen: "up",
            theory: "風險事件升溫時，黃金常受避險買盤支撐。",
            sourceNote: "FRED risk-aversion driver",
          }),
      },
      metalPlanWithNoStableApi(
        "central-bank-demand",
        "央行購金需求",
        "央行淨購金改變結構性需求，對中長期金價有支撐作用。",
        "WGC / IMF 統計（更新頻率不一致）",
        [
          { label: "World Gold Council Data", href: "https://www.gold.org/goldhub/data" },
          { label: "IMF IFS", href: "https://data.imf.org/" },
        ],
      ),
      metalPlanWithNoStableApi(
        "etf-holdings",
        "黃金 ETF 持倉",
        "ETF 持倉增減反映金融資金對黃金的配置強弱。",
        "ETF 發行商資料（來源分散）",
        [{ label: "SPDR Gold Shares", href: "https://www.spdrgoldshares.com/" }],
      ),
    ];
  }

  if (commodity === "silver") {
    return [
      {
        key: "industrial-demand",
        label: "工業需求（製造循環代理）",
        theory: "白銀兼具工業與貴金屬屬性，工業需求是重要下檔支撐。",
        sourceHint: "FRED INDPRO",
        sourceLinks: [{ label: "FRED INDPRO", href: "https://fred.stlouisfed.org/series/INDPRO" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "industrial-demand",
            label: "工業需求（製造循環代理）",
            seriesId: "INDPRO",
            metricName: "美國工業生產指數",
            unit: "index",
            bullishWhen: "up",
            theory: "工業活動走強時，白銀工業需求通常增加。",
            sourceNote: "FRED silver industrial-demand proxy",
          }),
      },
      {
        key: "real-yield",
        label: "實質利率（機會成本）",
        theory: "白銀亦受無息資產機會成本影響，實質利率上升通常偏空。",
        sourceHint: "FRED DGS10 + T10YIE",
        sourceLinks: [
          { label: "FRED DGS10", href: "https://fred.stlouisfed.org/series/DGS10" },
          { label: "FRED T10YIE", href: "https://fred.stlouisfed.org/series/T10YIE" },
        ],
        task: () =>
          buildRealYieldDriver(commodity, {
            key: "real-yield",
            label: "實質利率（機會成本）",
            theory: "實質殖利率下降時，白銀作為貴金屬配置的吸引力提升。",
            sourceNote: "FRED real-yield proxy",
          }),
      },
      {
        key: "usd-strength",
        label: "美元強弱",
        theory: "白銀以美元計價，美元走弱通常對銀價偏多。",
        sourceHint: "FRED DTWEXBGS",
        sourceLinks: [{ label: "FRED DTWEXBGS", href: "https://fred.stlouisfed.org/series/DTWEXBGS" }],
        task: () =>
          buildSingleFredDriver(commodity, {
            key: "usd-strength",
            label: "美元強弱",
            seriesId: "DTWEXBGS",
            metricName: "美元指數（Broad）",
            unit: "index",
            bullishWhen: "down",
            theory: "美元轉弱常帶動貴金屬資產吸引力。",
            sourceNote: "FRED USD driver",
          }),
      },
      metalPlanWithNoStableApi(
        "solar-demand",
        "太陽能需求",
        "光伏用銀量是白銀需求結構中的長期增量來源。",
        "IEA / 行業報告（未形成統一日頻 API）",
        [{ label: "IEA Renewables", href: "https://www.iea.org/reports/renewables-2025" }],
      ),
      metalPlanWithNoStableApi(
        "mine-supply",
        "礦端供給（副產品屬性）",
        "白銀供給常作為鉛鋅銅金副產物，主金屬景氣會反向影響供給。",
        "USGS / 礦商報告（尚無穩定免費 API）",
        [{ label: "USGS Silver", href: "https://www.usgs.gov/centers/national-minerals-information-center/silver-statistics-and-information" }],
      ),
      {
        key: "trade-demand",
        label: "國際貿易需求（OEC）",
        theory: "白銀跨國流向變化可反映投資與工業需求分布。",
        sourceHint: "OEC BACI",
        sourceLinks: [{ label: "OEC API", href: "https://api-v2.oec.world/" }],
        task: () => buildTradeDemandDriver(commodity),
      },
    ];
  }

  return [];
}

function getFactorPlans(commodity: CommodityKey): FactorPlan[] {
  if (METAL_COMMODITIES.has(commodity)) {
    const metalPlans = getMetalFactorPlans(commodity).map((plan) => ({
      ...plan,
      horizon: inferMetalPlanHorizon(plan.key),
    }));
    metalPlans.push({
      key: "news-flow",
      label: "新聞事件流（7日）",
      horizon: "short",
      theory: "重大政策、供給衝擊與需求轉折會先反映在新聞流，影響短線風險溢價。",
      sourceHint: "GDELT DOC",
      sourceLinks: [{ label: "GDELT DOC API", href: "https://api.gdeltproject.org/api/v2/doc/doc" }],
      task: () => buildNewsDriver(commodity),
    });
    return metalPlans;
  }

  const plans: FactorPlan[] = [
    {
      key: "macro",
      label: "總體經濟環境（獨立）",
      horizon: "short",
      theory: "美元、利率、風險偏好會影響商品估值與風險溢價。",
      sourceHint: "FRED",
      sourceLinks: [
        { label: "FRED DTWEXBGS", href: "https://fred.stlouisfed.org/series/DTWEXBGS" },
        { label: "FRED DGS10", href: "https://fred.stlouisfed.org/series/DGS10" },
        { label: "FRED VIXCLS", href: "https://fred.stlouisfed.org/series/VIXCLS" },
      ],
      task: () => buildMacroDriver(commodity),
    },
  ];

  if (AGRI_COMMODITIES.has(commodity)) {
    plans.push({
      key: "weather",
      label: "收成天候（主產區）",
      horizon: "short",
      theory: "作物供給首先受主產區降雨與極端天候影響，會先反映到收成預期。",
      sourceHint: "Open-Meteo",
      sourceLinks: [{ label: "Open-Meteo Archive", href: "https://archive-api.open-meteo.com/" }],
      task: async () => {
        const signal = await buildAgriWeatherDriver(commodity);
        if (!signal) throw new Error("weather driver not applicable");
        return signal;
      },
    });
  } else {
    plans.push({
      key: "supply-policy",
      label: "供給政策/地緣風險",
      horizon: "long",
      theory: "能源與金屬常受政策配額、礦山中斷與地緣事件影響供給彈性。",
      sourceHint: "Manual research (no stable API)",
      sourceLinks: [],
      task: async () => {
        throw new Error("no stable API yet");
      },
    });
  }

  plans.push({
    key: "cost-demand",
    label: COST_DEMAND_PROFILES[commodity].label,
    horizon: "short",
    theory: "不同商品有不同邊際成本與終端需求彈性，需按商品特性加權。",
    sourceHint: "FRED",
    sourceLinks: COST_DEMAND_PROFILES[commodity].components.map((item) => ({
      label: `FRED ${item.seriesId}`,
      href: `https://fred.stlouisfed.org/series/${item.seriesId}`,
    })),
    task: () => buildInputCostDriver(commodity),
  });

  plans.push({
    key: "trade-demand",
    label: "國際貿易需求（OEC）",
    horizon: "long",
    theory: "貿易總量與集中度變化反映實體需求強弱與流向風險。",
    sourceHint: "OEC BACI",
    sourceLinks: [{ label: "OEC API", href: "https://api-v2.oec.world/" }],
    task: () => buildTradeDemandDriver(commodity),
  });

  plans.push({
    key: "news-flow",
    label: "新聞事件流（7日）",
    horizon: "short",
    theory: "重大政策、供給衝擊與需求轉折會先反映在新聞流，影響短線風險溢價。",
    sourceHint: "GDELT DOC",
    sourceLinks: [{ label: "GDELT DOC API", href: "https://api.gdeltproject.org/api/v2/doc/doc" }],
    task: () => buildNewsDriver(commodity),
  });

  return plans;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const commodity = searchParams.get("commodity") ?? "";
  if (!isCommodityKey(commodity)) {
    return NextResponse.json({ ok: false, error: "Invalid commodity" }, { status: 400 });
  }

  const cacheKey = `drivers_v7_${commodity}`;
  const now = Date.now();
  const cached = driverCache.get(cacheKey);
  if (cached && now - cached.updatedAt <= CACHE_TTL_MS) {
    let refreshedSnapshot = cached.newsSnapshot;
    if (!refreshedSnapshot) {
      try {
        refreshedSnapshot = await buildNewsSnapshot(commodity, getFactorPlans(commodity));
        driverCache.set(cacheKey, { ...cached, newsSnapshot: refreshedSnapshot });
      } catch {
        refreshedSnapshot = cached.newsSnapshot;
      }
    }
    return NextResponse.json({
      ok: true,
      commodity,
      source: "cache",
      signals: cached.signals,
      newsSnapshot: refreshedSnapshot,
      updatedAt: new Date(cached.updatedAt).toISOString(),
      stale: false,
    });
  }

  const plans = getFactorPlans(commodity);
  let newsSnapshot: CommodityNewsSnapshot | null = null;
  try {
    newsSnapshot = await buildNewsSnapshot(commodity, plans);
  } catch {
    newsSnapshot = null;
  }
  const settled = await Promise.allSettled(plans.map((plan) => plan.task()));
  const signals: DriverSignal[] = [];
  const errors: string[] = [];
  for (let index = 0; index < settled.length; index += 1) {
    const item = settled[index];
    const plan = plans[index];
    if (item.status === "fulfilled" && item.value) {
      signals.push({
        ...item.value,
        horizon: plan.horizon ?? "short",
      });
      continue;
    }
    const reason =
      item.status === "rejected"
        ? item.reason instanceof Error
          ? item.reason.message
          : "driver request failed"
        : "driver returned null";
    const isNoStableApi = reason.includes("no stable API");
    if (isNoStableApi) {
      try {
        const newsFallback = await buildNewsBackedFactorSignal(commodity, plan);
        if (newsFallback) {
          signals.push(newsFallback);
          errors.push(`${plan.key}: no stable API -> substituted by news-backed proxy`);
          continue;
        }
      } catch (newsError) {
        const fallbackReason =
          newsError instanceof Error ? newsError.message : "news fallback failed";
        errors.push(`${plan.key}: ${reason}; news fallback failed (${fallbackReason})`);
        signals.push(unavailableSignal(commodity, plan, `${reason}; news fallback failed`));
        continue;
      }
    }
    errors.push(`${plan.key}: ${reason}`);
    signals.push(unavailableSignal(commodity, plan, reason));
  }

  const hasAnyLiveData = signals.some((signal) => signal.scoreLabel !== "--");
  if (hasAnyLiveData) {
    driverCache.set(cacheKey, { signals, newsSnapshot, updatedAt: now });
  } else if (cached && now - cached.updatedAt <= STALE_MAX_MS) {
    return NextResponse.json({
      ok: true,
      commodity,
      source: "cache-stale",
      stale: true,
      warning: "即時來源暫時不可用，已顯示最近快取資料。",
      details: errors,
      signals: cached.signals,
      newsSnapshot: cached.newsSnapshot,
      updatedAt: new Date(cached.updatedAt).toISOString(),
    });
  }

  return NextResponse.json(
    {
      ok: true,
      commodity,
      source: hasAnyLiveData ? "drivers-v6" : "drivers-v6-no-live",
      partial: errors.length > 0,
      stale: !hasAnyLiveData,
      warning: errors.length > 0 ? "部分因子目前無可用 API，已保留因子並顯示可得資訊。" : undefined,
      details: errors.length > 0 ? errors : undefined,
      signals,
      newsSnapshot,
      updatedAt: new Date(now).toISOString(),
    },
    { status: 200 },
  );
}
