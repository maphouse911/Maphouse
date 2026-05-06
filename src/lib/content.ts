import type { TopicCategory } from "@/app/data";
import type { MapHouseContentPost } from "./instagram";

export type PostSource = {
  label: string;
  url: string;
};

const CATEGORY_SOURCES: Record<TopicCategory, PostSource[]> = {
  commodity: [
    { label: "FAO FAOSTAT", url: "https://www.fao.org/faostat/" },
    { label: "World Bank Commodity Markets", url: "https://www.worldbank.org/en/research/commodity-markets" },
    { label: "LME Official Data", url: "https://www.lme.com/" },
  ],
  market: [
    { label: "IMF Data", url: "https://www.imf.org/en/Data" },
    { label: "World Bank Data", url: "https://data.worldbank.org/" },
    { label: "OECD Data", url: "https://data.oecd.org/" },
  ],
  industry: [
    { label: "UNCTADstat", url: "https://unctadstat.unctad.org/" },
    { label: "OECD Industry & Trade", url: "https://www.oecd.org/en/topics/trade.html" },
    { label: "World Economic Forum Reports", url: "https://www.weforum.org/publications/" },
  ],
  taiwan: [
    { label: "國家發展委員會資料平台", url: "https://data.gov.tw/" },
    { label: "中華民國統計資訊網", url: "https://www.stat.gov.tw/" },
    { label: "交通部統計查詢網", url: "https://stat.motc.gov.tw/" },
  ],
  lifestyle: [
    { label: "Numbeo Cost of Living", url: "https://www.numbeo.com/cost-of-living/" },
    { label: "OECD Better Life Index", url: "https://www.oecdbetterlifeindex.org/" },
    { label: "World Bank Open Data", url: "https://data.worldbank.org/" },
  ],
  sports: [
    { label: "FIFA Official Data", url: "https://www.fifa.com/" },
    { label: "WBSC Data", url: "https://www.wbsc.org/" },
    { label: "Our World in Data", url: "https://ourworldindata.org/" },
  ],
  instagram: [
    { label: "MapHouse Instagram", url: "https://www.instagram.com/maphouse_/" },
    { label: "World Bank Open Data", url: "https://data.worldbank.org/" },
    { label: "Our World in Data", url: "https://ourworldindata.org/" },
  ],
};

const KEYWORD_SOURCE_MAP: Array<{ pattern: RegExp; source: PostSource }> = [
  { pattern: /黃豆|soybean|豆/i, source: { label: "USDA PSD", url: "https://apps.fas.usda.gov/psdonline/" } },
  { pattern: /小麥|wheat/i, source: { label: "IGC Grains", url: "https://www.igc.int/en/default.aspx" } },
  { pattern: /玉米|corn/i, source: { label: "USDA WASDE", url: "https://www.usda.gov/oce/commodity/wasde" } },
  { pattern: /油價|原油|brent|wti/i, source: { label: "EIA Petroleum", url: "https://www.eia.gov/petroleum/" } },
  { pattern: /鋁|aluminum|lme/i, source: { label: "LME Aluminum", url: "https://www.lme.com/metals/non-ferrous/lme-aluminium" } },
  { pattern: /匯率|利率|殖利率|bond|yield/i, source: { label: "FRED", url: "https://fred.stlouisfed.org/" } },
  { pattern: /台灣|taiwan/i, source: { label: "主計總處", url: "https://www.dgbas.gov.tw/" } },
];

function nonEmptyLines(input: string) {
  return input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function contentParagraphs(post: MapHouseContentPost) {
  const body = post.caption?.trim() || post.summary;
  const lines = nonEmptyLines(body);
  const filtered = lines.filter((line) => !line.startsWith("#"));
  const normalized = (filtered.length ? filtered : lines).map((line) => line.replace(/\s+/g, " ").trim());
  return normalized.length ? normalized : [post.summary];
}

export function keyTakeaways(post: MapHouseContentPost, limit = 3) {
  const paragraphs = contentParagraphs(post);
  const takeaways: string[] = [];

  for (const paragraph of paragraphs) {
    if (takeaways.length >= limit) break;
    if (paragraph.length < 10) continue;
    if (takeaways.includes(paragraph)) continue;
    takeaways.push(paragraph);
  }

  if (!takeaways.length) {
    takeaways.push(post.summary);
  }

  return takeaways.slice(0, limit);
}

export function estimateReadMinutes(post: MapHouseContentPost) {
  const text = `${post.title}\n${post.caption || post.summary}`.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function formatPostDate(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return "Unknown";
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function postSources(post: MapHouseContentPost): PostSource[] {
  const base = CATEGORY_SOURCES[post.category] ?? CATEGORY_SOURCES.instagram;
  const text = `${post.title}\n${post.caption}\n${post.summary}`;
  const extra = KEYWORD_SOURCE_MAP.filter((entry) => entry.pattern.test(text)).map((entry) => entry.source);

  const merged = [...extra, ...base];
  const deduped: PostSource[] = [];
  const seen = new Set<string>();

  for (const item of merged) {
    if (seen.has(item.url)) continue;
    deduped.push(item);
    seen.add(item.url);
  }

  return deduped.slice(0, 5);
}

export function relatedPosts(post: MapHouseContentPost, posts: MapHouseContentPost[], limit = 3) {
  return posts
    .filter((item) => item.id !== post.id)
    .sort((a, b) => {
      const scoreA = Number(a.category === post.category) * 4 + Number(a.region === post.region) * 2;
      const scoreB = Number(b.category === post.category) * 4 + Number(b.region === post.region) * 2;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.timestamp < b.timestamp ? 1 : -1;
    })
    .slice(0, limit);
}

export function postSeoDescription(post: MapHouseContentPost) {
  const fallback = `${post.title}｜MapHouse map-driven analysis`;
  const clean = (post.summary || post.caption || "").replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > 140 ? `${clean.slice(0, 140)}...` : clean;
}
