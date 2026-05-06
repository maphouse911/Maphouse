import type { CommodityKey } from "@/app/data";

export type PipelineRiskType = "sanction" | "war" | "accident";
export type PipelineTimelineStatus = "planned" | "active" | "disrupted" | "retired";

export type PipelineDisruption = {
  startYear: number;
  endYear?: number;
  type: PipelineRiskType;
  reason: string;
};

export type PipelineRoute = {
  id: string;
  name: string;
  type: "oil" | "gas";
  from: string;
  to: string;
  commissionedYear: number;
  decommissionedYear?: number;
  disruptions?: PipelineDisruption[];
  lengthKm: number;
  capacity: string;
  sourceUrl: string;
  points: Array<{ lat: number; lon: number }>;
};

export type PipelineRiskEvent = {
  id: string;
  title: string;
  type: PipelineRiskType;
  year: number;
  endYear?: number;
  routeIds: string[];
  lat: number;
  lon: number;
  impact: "high" | "medium" | "low";
  note: string;
  sourceUrl: string;
};

const EMPTY_ROUTES: PipelineRoute[] = [];
const EMPTY_EVENTS: PipelineRiskEvent[] = [];

const OIL_ROUTES: PipelineRoute[] = [
  {
    id: "pipe-druzhba",
    name: "Druzhba Pipeline",
    type: "oil",
    from: "Russia (Samara)",
    to: "Central Europe",
    commissionedYear: 1964,
    disruptions: [{ startYear: 2022, type: "sanction", reason: "EU embargo / rerouting stress" }],
    lengthKm: 4000,
    capacity: "up to ~1.2 mb/d",
    sourceUrl: "https://www.eia.gov/international/analysis/special-topics/WorldOilTransitChokepoints",
    points: [
      { lat: 53.2, lon: 50.1 },
      { lat: 52.1, lon: 30.4 },
      { lat: 52.2, lon: 21.0 },
      { lat: 51.1, lon: 17.0 },
    ],
  },
  {
    id: "pipe-espo",
    name: "ESPO",
    type: "oil",
    from: "Taishet",
    to: "Kozmino / China",
    commissionedYear: 2009,
    lengthKm: 4735,
    capacity: "~1.6 mb/d",
    sourceUrl: "https://www.eia.gov/international/",
    points: [
      { lat: 55.9, lon: 98.0 },
      { lat: 54.7, lon: 123.0 },
      { lat: 53.9, lon: 124.2 },
      { lat: 42.7, lon: 133.0 },
    ],
  },
  {
    id: "pipe-btc",
    name: "Baku-Tbilisi-Ceyhan (BTC)",
    type: "oil",
    from: "Baku",
    to: "Ceyhan",
    commissionedYear: 2006,
    lengthKm: 1768,
    capacity: "1.0-1.2 mb/d",
    sourceUrl: "https://www.bp.com/en_az/azerbaijan/home/who-we-are/operationsprojects/pipelines/btc.html",
    points: [
      { lat: 40.3, lon: 49.9 },
      { lat: 41.7, lon: 44.8 },
      { lat: 37.0, lon: 35.3 },
    ],
  },
  {
    id: "pipe-cpc",
    name: "Caspian Pipeline Consortium (CPC)",
    type: "oil",
    from: "Kazakhstan (Tengiz)",
    to: "Novorossiysk",
    commissionedYear: 2001,
    disruptions: [{ startYear: 2022, endYear: 2023, type: "sanction", reason: "Insurance / sanctions stress" }],
    lengthKm: 1511,
    capacity: "~1.4 mb/d",
    sourceUrl: "https://www.cpc.ru/en/",
    points: [
      { lat: 46.1, lon: 52.7 },
      { lat: 45.2, lon: 47.6 },
      { lat: 44.7, lon: 37.8 },
    ],
  },
  {
    id: "pipe-east-west-saudi",
    name: "East-West (Petroline)",
    type: "oil",
    from: "Abqaiq",
    to: "Yanbu",
    commissionedYear: 1981,
    disruptions: [{ startYear: 2019, type: "war", reason: "Drone attack disruption risk" }],
    lengthKm: 1200,
    capacity: "~5 mb/d",
    sourceUrl: "https://www.eia.gov/international/analysis/country/SAU",
    points: [
      { lat: 25.9, lon: 49.7 },
      { lat: 24.0, lon: 43.0 },
      { lat: 24.1, lon: 38.1 },
    ],
  },
  {
    id: "pipe-keystone",
    name: "Keystone System",
    type: "oil",
    from: "Alberta",
    to: "US Midwest/Gulf",
    commissionedYear: 2010,
    disruptions: [{ startYear: 2022, endYear: 2022, type: "accident", reason: "Kansas segment spill" }],
    lengthKm: 4300,
    capacity: "~0.62 mb/d",
    sourceUrl: "https://www.eia.gov/todayinenergy/detail.php?id=34432",
    points: [
      { lat: 53.5, lon: -113.5 },
      { lat: 49.0, lon: -101.4 },
      { lat: 40.8, lon: -96.7 },
      { lat: 29.7, lon: -95.4 },
    ],
  },
  {
    id: "pipe-enbridge-mainline",
    name: "Enbridge Mainline",
    type: "oil",
    from: "Alberta",
    to: "US Midwest",
    commissionedYear: 1950,
    lengthKm: 4900,
    capacity: "~3.0 mb/d",
    sourceUrl: "https://www.enbridge.com/projects-and-infrastructure/public-awareness-and-education/mainline-system",
    points: [
      { lat: 53.5, lon: -113.5 },
      { lat: 50.5, lon: -97.0 },
      { lat: 45.4, lon: -93.2 },
      { lat: 41.8, lon: -87.6 },
    ],
  },
  {
    id: "pipe-tm",
    name: "Trans Mountain",
    type: "oil",
    from: "Edmonton",
    to: "Vancouver",
    commissionedYear: 1953,
    disruptions: [{ startYear: 2021, endYear: 2021, type: "accident", reason: "BC flood-driven outage risk" }],
    lengthKm: 1150,
    capacity: "~0.89 mb/d (expanded)",
    sourceUrl: "https://www.transmountain.com/",
    points: [
      { lat: 53.5, lon: -113.5 },
      { lat: 51.0, lon: -120.0 },
      { lat: 49.3, lon: -123.1 },
    ],
  },
  {
    id: "pipe-dapl",
    name: "Dakota Access",
    type: "oil",
    from: "Bakken",
    to: "Patoka",
    commissionedYear: 2017,
    lengthKm: 1886,
    capacity: "~0.75 mb/d",
    sourceUrl: "https://www.eia.gov/todayinenergy/detail.php?id=27232",
    points: [
      { lat: 47.5, lon: -103.4 },
      { lat: 46.0, lon: -99.0 },
      { lat: 42.3, lon: -96.0 },
      { lat: 38.5, lon: -89.1 },
    ],
  },
  {
    id: "pipe-kirkuk-ceyhan",
    name: "Kirkuk-Ceyhan",
    type: "oil",
    from: "Kirkuk",
    to: "Ceyhan",
    commissionedYear: 1977,
    disruptions: [{ startYear: 2023, type: "sanction", reason: "Arbitration and export halt episodes" }],
    lengthKm: 970,
    capacity: "~0.5 mb/d effective",
    sourceUrl: "https://www.eia.gov/international/analysis/country/IRQ",
    points: [
      { lat: 35.5, lon: 44.4 },
      { lat: 36.8, lon: 40.2 },
      { lat: 37.0, lon: 35.3 },
    ],
  },
  {
    id: "pipe-sumed",
    name: "SUMED",
    type: "oil",
    from: "Ain Sokhna",
    to: "Sidi Kerir",
    commissionedYear: 1977,
    lengthKm: 320,
    capacity: "~2.5 mb/d",
    sourceUrl: "https://www.eia.gov/international/analysis/special-topics/WorldOilTransitChokepoints",
    points: [
      { lat: 29.6, lon: 32.3 },
      { lat: 30.8, lon: 31.0 },
      { lat: 31.1, lon: 29.8 },
    ],
  },
  {
    id: "pipe-trans-alaska",
    name: "Trans-Alaska Pipeline (TAPS)",
    type: "oil",
    from: "Prudhoe Bay",
    to: "Valdez",
    commissionedYear: 1977,
    lengthKm: 1287,
    capacity: "~0.5 mb/d current throughput",
    sourceUrl: "https://www.alyeska-pipe.com/",
    points: [
      { lat: 70.2, lon: -148.5 },
      { lat: 66.5, lon: -150.0 },
      { lat: 61.1, lon: -146.4 },
    ],
  },
  {
    id: "pipe-colonial",
    name: "Colonial Pipeline",
    type: "oil",
    from: "US Gulf Coast",
    to: "New York Harbor",
    commissionedYear: 1962,
    disruptions: [{ startYear: 2021, endYear: 2021, type: "accident", reason: "Cyber attack shutdown" }],
    lengthKm: 8850,
    capacity: "~2.5 mb/d refined products",
    sourceUrl: "https://www.eia.gov/todayinenergy/detail.php?id=47896",
    points: [
      { lat: 29.7, lon: -95.3 },
      { lat: 33.7, lon: -84.4 },
      { lat: 35.8, lon: -78.6 },
      { lat: 40.7, lon: -74.0 },
    ],
  },
  {
    id: "pipe-tapline",
    name: "Trans-Arabian (Tapline, historical)",
    type: "oil",
    from: "Qaisumah",
    to: "Sidon",
    commissionedYear: 1950,
    decommissionedYear: 1990,
    lengthKm: 1720,
    capacity: "~0.5 mb/d (historical max)",
    sourceUrl: "https://www.britannica.com/topic/Trans-Arabian-Pipeline",
    points: [
      { lat: 28.2, lon: 46.1 },
      { lat: 31.0, lon: 38.3 },
      { lat: 33.4, lon: 36.2 },
      { lat: 33.6, lon: 35.4 },
    ],
  },
];

const GAS_ROUTES: PipelineRoute[] = [
  {
    id: "pipe-power-of-siberia",
    name: "Power of Siberia",
    type: "gas",
    from: "Chayanda/Kovykta",
    to: "Blagoveshchensk-China",
    commissionedYear: 2019,
    lengthKm: 3968,
    capacity: "up to 38 bcm/y",
    sourceUrl: "https://www.gazprom.com/projects/power-of-siberia/",
    points: [
      { lat: 62.1, lon: 112.9 },
      { lat: 58.5, lon: 124.0 },
      { lat: 53.7, lon: 127.9 },
      { lat: 49.9, lon: 127.5 },
    ],
  },
  {
    id: "pipe-nord-stream",
    name: "Nord Stream",
    type: "gas",
    from: "Vyborg",
    to: "Greifswald",
    commissionedYear: 2011,
    disruptions: [{ startYear: 2022, type: "accident", reason: "Baltic sabotage damage" }],
    lengthKm: 1224,
    capacity: "55 bcm/y design",
    sourceUrl: "https://www.eia.gov/todayinenergy/detail.php?id=53759",
    points: [
      { lat: 60.7, lon: 28.7 },
      { lat: 58.3, lon: 20.0 },
      { lat: 54.1, lon: 13.4 },
    ],
  },
  {
    id: "pipe-yamal-europe",
    name: "Yamal-Europe",
    type: "gas",
    from: "Torzhok",
    to: "Germany",
    commissionedYear: 1999,
    disruptions: [{ startYear: 2022, type: "sanction", reason: "Sanctions and reverse-flow pressure" }],
    lengthKm: 4107,
    capacity: "33 bcm/y design",
    sourceUrl: "https://www.eia.gov/international/",
    points: [
      { lat: 57.0, lon: 35.0 },
      { lat: 53.9, lon: 27.6 },
      { lat: 52.1, lon: 19.4 },
      { lat: 52.4, lon: 14.5 },
    ],
  },
  {
    id: "pipe-tanap-tap",
    name: "TANAP-TAP Corridor",
    type: "gas",
    from: "Azerbaijan",
    to: "Italy",
    commissionedYear: 2018,
    lengthKm: 3500,
    capacity: "16+ bcm/y",
    sourceUrl: "https://www.sgc.az/en",
    points: [
      { lat: 40.3, lon: 49.9 },
      { lat: 39.9, lon: 32.9 },
      { lat: 40.6, lon: 22.9 },
      { lat: 40.5, lon: 17.2 },
    ],
  },
  {
    id: "pipe-magreb-europe",
    name: "Maghreb-Europe",
    type: "gas",
    from: "Algeria",
    to: "Spain",
    commissionedYear: 1996,
    disruptions: [{ startYear: 2021, type: "war", reason: "Algeria-Morocco diplomatic disruption" }],
    lengthKm: 1620,
    capacity: "~12 bcm/y design",
    sourceUrl: "https://www.eia.gov/international/analysis/country/DZA",
    points: [
      { lat: 31.5, lon: -2.0 },
      { lat: 35.9, lon: -5.6 },
      { lat: 36.3, lon: -5.0 },
      { lat: 37.6, lon: -0.9 },
    ],
  },
  {
    id: "pipe-transmed",
    name: "TransMed (Enrico Mattei)",
    type: "gas",
    from: "Hassi R'Mel",
    to: "Italy",
    commissionedYear: 1983,
    lengthKm: 2475,
    capacity: "~30 bcm/y",
    sourceUrl: "https://www.eia.gov/international/analysis/country/DZA",
    points: [
      { lat: 32.9, lon: 3.3 },
      { lat: 36.8, lon: 10.2 },
      { lat: 37.5, lon: 12.5 },
      { lat: 38.2, lon: 15.5 },
    ],
  },
  {
    id: "pipe-greenstream",
    name: "Greenstream",
    type: "gas",
    from: "Mellitah",
    to: "Sicily",
    commissionedYear: 2004,
    disruptions: [{ startYear: 2011, endYear: 2013, type: "war", reason: "Libyan civil war outages" }],
    lengthKm: 540,
    capacity: "~11 bcm/y",
    sourceUrl: "https://www.eia.gov/international/analysis/country/LYB",
    points: [
      { lat: 32.9, lon: 12.1 },
      { lat: 35.5, lon: 14.3 },
      { lat: 37.1, lon: 15.2 },
    ],
  },
  {
    id: "pipe-turkstream",
    name: "TurkStream",
    type: "gas",
    from: "Anapa",
    to: "Turkey / Balkans",
    commissionedYear: 2020,
    lengthKm: 930,
    capacity: "31.5 bcm/y",
    sourceUrl: "https://www.gazprom.com/projects/turk-stream/",
    points: [
      { lat: 44.9, lon: 37.3 },
      { lat: 42.2, lon: 30.0 },
      { lat: 41.0, lon: 28.4 },
      { lat: 42.8, lon: 23.3 },
    ],
  },
  {
    id: "pipe-blue-stream",
    name: "Blue Stream",
    type: "gas",
    from: "Russia",
    to: "Turkey",
    commissionedYear: 2003,
    lengthKm: 1213,
    capacity: "16 bcm/y",
    sourceUrl: "https://www.gazprom.com/projects/blue-stream/",
    points: [
      { lat: 44.7, lon: 37.8 },
      { lat: 42.7, lon: 35.0 },
      { lat: 41.3, lon: 36.3 },
      { lat: 41.0, lon: 29.0 },
    ],
  },
  {
    id: "pipe-brotherhood",
    name: "Brotherhood (Urengoy-Pomary-Uzhhorod)",
    type: "gas",
    from: "Western Siberia",
    to: "Central Europe",
    commissionedYear: 1984,
    disruptions: [{ startYear: 2022, type: "war", reason: "Russia-Ukraine transit disruptions" }],
    lengthKm: 4451,
    capacity: "~100 bcm/y historical design",
    sourceUrl: "https://www.eia.gov/international/",
    points: [
      { lat: 57.5, lon: 65.0 },
      { lat: 51.0, lon: 35.0 },
      { lat: 49.0, lon: 31.0 },
      { lat: 48.6, lon: 22.3 },
    ],
  },
  {
    id: "pipe-central-asia-china",
    name: "Central Asia-China Gas Pipeline",
    type: "gas",
    from: "Turkmenistan",
    to: "Xinjiang",
    commissionedYear: 2009,
    lengthKm: 1833,
    capacity: "~55 bcm/y",
    sourceUrl: "https://www.eia.gov/international/analysis/country/TKM",
    points: [
      { lat: 39.2, lon: 63.6 },
      { lat: 42.9, lon: 67.2 },
      { lat: 43.2, lon: 76.9 },
      { lat: 44.0, lon: 87.6 },
    ],
  },
  {
    id: "pipe-west-east-china",
    name: "West-East Gas Pipeline",
    type: "gas",
    from: "Xinjiang",
    to: "Shanghai",
    commissionedYear: 2004,
    lengthKm: 4000,
    capacity: "~30 bcm/y (Line I)",
    sourceUrl: "https://www.cnpc.com.cn/en/",
    points: [
      { lat: 41.8, lon: 86.1 },
      { lat: 38.0, lon: 103.8 },
      { lat: 34.3, lon: 108.9 },
      { lat: 31.2, lon: 121.5 },
    ],
  },
  {
    id: "pipe-eastmed",
    name: "EastMed (planned)",
    type: "gas",
    from: "Levant Basin",
    to: "Greece / Italy",
    commissionedYear: 2030,
    lengthKm: 1900,
    capacity: "planned ~10-20 bcm/y",
    sourceUrl: "https://energy.ec.europa.eu/topics/infrastructure-and-energy-networking/projects-common-interest_en",
    points: [
      { lat: 32.3, lon: 34.9 },
      { lat: 34.3, lon: 27.8 },
      { lat: 35.4, lon: 21.2 },
      { lat: 37.9, lon: 23.7 },
    ],
  },
];

const OIL_RISK_EVENTS: PipelineRiskEvent[] = [
  {
    id: "oil-sanction-druzhba-2022",
    title: "EU embargo pressure on Druzhba flows",
    type: "sanction",
    year: 2022,
    routeIds: ["pipe-druzhba"],
    lat: 52.0,
    lon: 24.0,
    impact: "high",
    note: "Refinery sourcing and route mix shifted after EU sanctions.",
    sourceUrl: "https://www.eia.gov/international/analysis/country/RUS",
  },
  {
    id: "oil-attack-petroline-2019",
    title: "Saudi East-West corridor drone attack risk",
    type: "war",
    year: 2019,
    routeIds: ["pipe-east-west-saudi"],
    lat: 24.5,
    lon: 42.0,
    impact: "high",
    note: "Security incidents highlighted infrastructure vulnerability.",
    sourceUrl: "https://www.eia.gov/international/analysis/country/SAU",
  },
  {
    id: "oil-cyber-colonial-2021",
    title: "Colonial cyberattack shutdown",
    type: "accident",
    year: 2021,
    routeIds: ["pipe-colonial"],
    lat: 33.7,
    lon: -84.4,
    impact: "high",
    note: "Temporary shutdown disrupted US East Coast fuels logistics.",
    sourceUrl: "https://www.eia.gov/todayinenergy/detail.php?id=47896",
  },
  {
    id: "oil-keystone-spill-2022",
    title: "Keystone Kansas spill event",
    type: "accident",
    year: 2022,
    routeIds: ["pipe-keystone"],
    lat: 39.6,
    lon: -97.6,
    impact: "medium",
    note: "Large spill temporarily interrupted segment operations.",
    sourceUrl: "https://www.eia.gov/todayinenergy/detail.php?id=56820",
  },
  {
    id: "oil-kirkuk-halt-2023",
    title: "Kirkuk-Ceyhan arbitration halt",
    type: "sanction",
    year: 2023,
    routeIds: ["pipe-kirkuk-ceyhan"],
    lat: 36.4,
    lon: 40.6,
    impact: "high",
    note: "Exports paused amid legal and policy disputes.",
    sourceUrl: "https://www.eia.gov/international/analysis/country/IRQ",
  },
];

const GAS_RISK_EVENTS: PipelineRiskEvent[] = [
  {
    id: "gas-nordstream-2022",
    title: "Nord Stream sabotage",
    type: "accident",
    year: 2022,
    routeIds: ["pipe-nord-stream"],
    lat: 55.5,
    lon: 15.6,
    impact: "high",
    note: "Explosions in Baltic Sea disabled key offshore sections.",
    sourceUrl: "https://www.eia.gov/todayinenergy/detail.php?id=53759",
  },
  {
    id: "gas-yamal-sanction-2022",
    title: "Yamal sanctions and reverse-flow stress",
    type: "sanction",
    year: 2022,
    routeIds: ["pipe-yamal-europe"],
    lat: 52.7,
    lon: 20.6,
    impact: "high",
    note: "Sanctions shifted gas direction and reduced contracted throughput.",
    sourceUrl: "https://www.eia.gov/international/",
  },
  {
    id: "gas-brotherhood-war-2022",
    title: "Ukraine transit war risk",
    type: "war",
    year: 2022,
    routeIds: ["pipe-brotherhood"],
    lat: 49.2,
    lon: 31.0,
    impact: "high",
    note: "War operations and policy risk reduced route reliability.",
    sourceUrl: "https://www.eia.gov/international/",
  },
  {
    id: "gas-maghreb-2021",
    title: "Maghreb-Europe diplomatic disruption",
    type: "war",
    year: 2021,
    routeIds: ["pipe-magreb-europe"],
    lat: 35.9,
    lon: -5.6,
    impact: "medium",
    note: "Transit route faced shutdown after regional diplomatic breakdown.",
    sourceUrl: "https://www.eia.gov/international/analysis/country/DZA",
  },
  {
    id: "gas-libya-greenstream-2011",
    title: "Libya conflict hits Greenstream",
    type: "war",
    year: 2011,
    routeIds: ["pipe-greenstream"],
    lat: 34.8,
    lon: 13.8,
    impact: "medium",
    note: "Conflict-driven interruptions affected Mediterranean gas flows.",
    sourceUrl: "https://www.eia.gov/international/analysis/country/LYB",
  },
];

export function getPipelineStatusAtYear(route: PipelineRoute, year: number): PipelineTimelineStatus {
  if (year < route.commissionedYear) return "planned";
  if (route.decommissionedYear && year > route.decommissionedYear) return "retired";

  const disrupted = (route.disruptions ?? []).some((event) => {
    const endYear = event.endYear ?? event.startYear;
    return year >= event.startYear && year <= endYear;
  });
  if (disrupted) return "disrupted";
  return "active";
}

export function getPipelineYearExtent(routes: PipelineRoute[], events: PipelineRiskEvent[] = []) {
  const yearPool: number[] = [];

  routes.forEach((route) => {
    yearPool.push(route.commissionedYear);
    if (route.decommissionedYear) yearPool.push(route.decommissionedYear);
    (route.disruptions ?? []).forEach((disruption) => {
      yearPool.push(disruption.startYear);
      if (disruption.endYear) yearPool.push(disruption.endYear);
    });
  });

  events.forEach((event) => {
    yearPool.push(event.year);
    if (event.endYear) yearPool.push(event.endYear);
  });

  const fallbackNow = new Date().getFullYear();
  if (!yearPool.length) return { minYear: fallbackNow - 5, maxYear: fallbackNow };
  return {
    minYear: Math.min(...yearPool),
    maxYear: Math.max(...yearPool, fallbackNow),
  };
}

export const pipelineRoutesByCommodity: Record<CommodityKey, PipelineRoute[]> = {
  soybean: EMPTY_ROUTES,
  wheat: EMPTY_ROUTES,
  corn: EMPTY_ROUTES,
  coffee: EMPTY_ROUTES,
  cocoa: EMPTY_ROUTES,
  sugar: EMPTY_ROUTES,
  cotton: EMPTY_ROUTES,
  soybeanOil: EMPTY_ROUTES,
  aluminum: EMPTY_ROUTES,
  copper: EMPTY_ROUTES,
  nickel: EMPTY_ROUTES,
  zinc: EMPTY_ROUTES,
  lead: EMPTY_ROUTES,
  tin: EMPTY_ROUTES,
  cobalt: EMPTY_ROUTES,
  lithium: EMPTY_ROUTES,
  gallium: EMPTY_ROUTES,
  germanium: EMPTY_ROUTES,
  gold: EMPTY_ROUTES,
  silver: EMPTY_ROUTES,
  oil: OIL_ROUTES,
  brent: OIL_ROUTES,
  naturalGas: GAS_ROUTES,
};

export const pipelineRiskEventsByCommodity: Record<CommodityKey, PipelineRiskEvent[]> = {
  soybean: EMPTY_EVENTS,
  wheat: EMPTY_EVENTS,
  corn: EMPTY_EVENTS,
  coffee: EMPTY_EVENTS,
  cocoa: EMPTY_EVENTS,
  sugar: EMPTY_EVENTS,
  cotton: EMPTY_EVENTS,
  soybeanOil: EMPTY_EVENTS,
  aluminum: EMPTY_EVENTS,
  copper: EMPTY_EVENTS,
  nickel: EMPTY_EVENTS,
  zinc: EMPTY_EVENTS,
  lead: EMPTY_EVENTS,
  tin: EMPTY_EVENTS,
  cobalt: EMPTY_EVENTS,
  lithium: EMPTY_EVENTS,
  gallium: EMPTY_EVENTS,
  germanium: EMPTY_EVENTS,
  gold: EMPTY_EVENTS,
  silver: EMPTY_EVENTS,
  oil: OIL_RISK_EVENTS,
  brent: OIL_RISK_EVENTS,
  naturalGas: GAS_RISK_EVENTS,
};
