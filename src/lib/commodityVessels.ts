import type { CommodityKey } from "@/app/data";

export type CommodityVesselType =
  | "crude_tanker"
  | "product_tanker"
  | "lng_tanker"
  | "bulk_carrier"
  | "container_ship"
  | "general_cargo";

export type CommodityVesselPoint = {
  id: string;
  name: string;
  mmsi: string;
  imo?: string;
  vesselType: CommodityVesselType;
  lat: number;
  lon: number;
  speedKnots: number;
  course: number;
  destination: string;
  eta: string;
  observedAt: string;
  routeHint: string;
  commodityHint: string;
  relevance: "high" | "medium" | "watch";
  source: "sample_ais_ready";
};

export type VesselWatchZone = {
  id: string;
  name: string;
  kind: "taiwan_port" | "chokepoint";
  lat: number;
  lon: number;
  note: string;
};

export const vesselLayerSourceNote =
  "V1 uses AIS-ready sample vessel points. Connect a commercial AIS feed such as Spire, MarineTraffic, VesselFinder, or AISHub to replace these points with live positions.";

const BULK_COMMODITIES: CommodityKey[] = [
  "soybean",
  "wheat",
  "corn",
  "coffee",
  "cocoa",
  "sugar",
  "cotton",
  "soybeanOil",
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
];

export const commodityVesselTypes: Record<CommodityKey, CommodityVesselType[]> = {
  soybean: ["bulk_carrier"],
  wheat: ["bulk_carrier"],
  corn: ["bulk_carrier"],
  coffee: ["container_ship", "general_cargo"],
  cocoa: ["container_ship", "general_cargo"],
  sugar: ["bulk_carrier", "general_cargo"],
  cotton: ["container_ship"],
  soybeanOil: ["product_tanker", "bulk_carrier"],
  oil: ["crude_tanker", "product_tanker"],
  brent: ["crude_tanker", "product_tanker"],
  naturalGas: ["lng_tanker"],
  aluminum: ["bulk_carrier", "general_cargo"],
  copper: ["bulk_carrier", "container_ship", "general_cargo"],
  gold: ["general_cargo", "container_ship"],
  silver: ["general_cargo", "container_ship"],
  nickel: ["bulk_carrier", "general_cargo"],
  zinc: ["bulk_carrier", "general_cargo"],
  lead: ["bulk_carrier", "general_cargo"],
  tin: ["container_ship", "general_cargo"],
  cobalt: ["container_ship", "general_cargo"],
  lithium: ["container_ship", "general_cargo"],
  gallium: ["container_ship", "general_cargo"],
  germanium: ["container_ship", "general_cargo"],
};

export const vesselWatchZones: VesselWatchZone[] = [
  {
    id: "kaohsiung-port",
    name: "Kaohsiung Port",
    kind: "taiwan_port",
    lat: 22.55,
    lon: 120.27,
    note: "Container, bulk, petrochemical, and industrial cargo gateway for southern Taiwan.",
  },
  {
    id: "taichung-port",
    name: "Taichung Port",
    kind: "taiwan_port",
    lat: 24.29,
    lon: 120.49,
    note: "Bulk cargo, energy, grain, and manufacturing supply chain gateway.",
  },
  {
    id: "mailiao-port",
    name: "Mailiao Industrial Port",
    kind: "taiwan_port",
    lat: 23.79,
    lon: 120.16,
    note: "Petrochemical and energy-linked industrial port.",
  },
  {
    id: "yongan-lng",
    name: "Yongan LNG Terminal",
    kind: "taiwan_port",
    lat: 22.82,
    lon: 120.20,
    note: "Key LNG import terminal for Taiwan's power and industrial fuel chain.",
  },
  {
    id: "malacca",
    name: "Strait of Malacca",
    kind: "chokepoint",
    lat: 2.5,
    lon: 101.0,
    note: "Critical Asia-bound crude, LNG, bulk, and container route.",
  },
  {
    id: "hormuz",
    name: "Strait of Hormuz",
    kind: "chokepoint",
    lat: 26.6,
    lon: 56.2,
    note: "Critical oil and LNG chokepoint linking the Persian Gulf to Asian buyers.",
  },
  {
    id: "suez",
    name: "Suez Canal",
    kind: "chokepoint",
    lat: 30.3,
    lon: 32.5,
    note: "Europe-Asia energy, grain, and container corridor.",
  },
  {
    id: "panama",
    name: "Panama Canal",
    kind: "chokepoint",
    lat: 9.1,
    lon: -79.7,
    note: "Americas-to-Asia grain, LNG, and container route.",
  },
];

export const commodityVesselPoints: CommodityVesselPoint[] = [
  {
    id: "v-crude-hormuz-1",
    name: "Gulf Horizon",
    mmsi: "636018442",
    imo: "9784211",
    vesselType: "crude_tanker",
    lat: 25.7,
    lon: 57.2,
    speedKnots: 13.2,
    course: 111,
    destination: "Singapore",
    eta: "2026-05-13 08:00 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Persian Gulf -> Malacca -> Northeast Asia",
    commodityHint: "Middle East crude / condensate",
    relevance: "high",
    source: "sample_ais_ready",
  },
  {
    id: "v-crude-malacca-1",
    name: "Ocean Laurel",
    mmsi: "538009118",
    imo: "9836727",
    vesselType: "crude_tanker",
    lat: 2.3,
    lon: 101.4,
    speedKnots: 11.8,
    course: 132,
    destination: "Ningbo",
    eta: "2026-05-11 21:30 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Arabian Sea -> Malacca -> China coast",
    commodityHint: "Crude oil tanker lane",
    relevance: "high",
    source: "sample_ais_ready",
  },
  {
    id: "v-product-tw-1",
    name: "Formosa Trader",
    mmsi: "416005882",
    imo: "9690020",
    vesselType: "product_tanker",
    lat: 23.65,
    lon: 120.07,
    speedKnots: 7.4,
    course: 18,
    destination: "Mailiao",
    eta: "2026-05-08 03:20 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Taiwan Strait coastal product tanker",
    commodityHint: "Refined products / petrochemical feedstock",
    relevance: "high",
    source: "sample_ais_ready",
  },
  {
    id: "v-lng-qatar-1",
    name: "Al Wakrah LNG",
    mmsi: "431402000",
    imo: "9331234",
    vesselType: "lng_tanker",
    lat: 24.9,
    lon: 51.8,
    speedKnots: 14.6,
    course: 104,
    destination: "Yongan LNG",
    eta: "2026-05-16 14:00 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Qatar -> Hormuz -> Malacca -> Taiwan",
    commodityHint: "LNG cargo for power and industrial demand",
    relevance: "high",
    source: "sample_ais_ready",
  },
  {
    id: "v-lng-tw-1",
    name: "Pacific Energy",
    mmsi: "431721000",
    imo: "9441594",
    vesselType: "lng_tanker",
    lat: 22.63,
    lon: 120.14,
    speedKnots: 5.8,
    course: 348,
    destination: "Yongan LNG",
    eta: "2026-05-07 23:40 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Approaching southern Taiwan LNG terminal",
    commodityHint: "LNG import watch",
    relevance: "high",
    source: "sample_ais_ready",
  },
  {
    id: "v-bulk-brazil-soy",
    name: "Cerrado Star",
    mmsi: "563802000",
    imo: "9701128",
    vesselType: "bulk_carrier",
    lat: -23.9,
    lon: -45.4,
    speedKnots: 12.1,
    course: 82,
    destination: "Kaohsiung",
    eta: "2026-06-02 10:00 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Santos/Paranagua -> Cape route -> Taiwan",
    commodityHint: "Soybean / corn bulk lane",
    relevance: "high",
    source: "sample_ais_ready",
  },
  {
    id: "v-bulk-us-grain",
    name: "Prairie Bulk",
    mmsi: "367501120",
    imo: "9587247",
    vesselType: "bulk_carrier",
    lat: 29.1,
    lon: -89.6,
    speedKnots: 10.2,
    course: 158,
    destination: "Taichung",
    eta: "2026-06-07 04:00 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "US Gulf -> Panama -> Taiwan",
    commodityHint: "Corn / soybean / wheat bulk lane",
    relevance: "high",
    source: "sample_ais_ready",
  },
  {
    id: "v-bulk-aus-coal",
    name: "Hunter Cape",
    mmsi: "503716000",
    imo: "9754022",
    vesselType: "bulk_carrier",
    lat: -23.2,
    lon: 151.4,
    speedKnots: 12.8,
    course: 334,
    destination: "Taichung",
    eta: "2026-05-21 18:00 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Australia east coast -> Taiwan",
    commodityHint: "Coal / bulk energy lane",
    relevance: "high",
    source: "sample_ais_ready",
  },
  {
    id: "v-bulk-metal-chile",
    name: "Andes Ore",
    mmsi: "725003220",
    imo: "9618278",
    vesselType: "bulk_carrier",
    lat: -23.4,
    lon: -70.5,
    speedKnots: 9.6,
    course: 296,
    destination: "East Asia",
    eta: "2026-06-01 12:00 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Chile west coast -> Pacific Asia",
    commodityHint: "Copper concentrate / metal ore lane",
    relevance: "medium",
    source: "sample_ais_ready",
  },
  {
    id: "v-bulk-guinea-bauxite",
    name: "Bauxite Bridge",
    mmsi: "538008811",
    imo: "9781100",
    vesselType: "bulk_carrier",
    lat: 10.4,
    lon: -15.2,
    speedKnots: 11.4,
    course: 145,
    destination: "Qingdao",
    eta: "2026-06-05 16:00 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Guinea bauxite ports -> China alumina chain",
    commodityHint: "Bauxite / aluminum feedstock",
    relevance: "medium",
    source: "sample_ais_ready",
  },
  {
    id: "v-container-asia-1",
    name: "Ever Metro",
    mmsi: "416770000",
    imo: "9860013",
    vesselType: "container_ship",
    lat: 22.4,
    lon: 120.08,
    speedKnots: 16.2,
    course: 314,
    destination: "Kaohsiung",
    eta: "2026-05-07 19:50 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Southeast Asia -> Kaohsiung",
    commodityHint: "Containerized coffee, cocoa, cotton, electronics metals",
    relevance: "watch",
    source: "sample_ais_ready",
  },
  {
    id: "v-container-malacca",
    name: "Asia Ribbon",
    mmsi: "563019700",
    imo: "9834119",
    vesselType: "container_ship",
    lat: 1.6,
    lon: 103.2,
    speedKnots: 17.8,
    course: 72,
    destination: "Kaohsiung",
    eta: "2026-05-12 06:00 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Malacca -> South China Sea -> Taiwan",
    commodityHint: "Containerized soft commodities and specialty metals",
    relevance: "medium",
    source: "sample_ais_ready",
  },
  {
    id: "v-general-metal-1",
    name: "Mineral Link",
    mmsi: "477391200",
    imo: "9645556",
    vesselType: "general_cargo",
    lat: 24.7,
    lon: 121.9,
    speedKnots: 8.7,
    course: 214,
    destination: "Taichung",
    eta: "2026-05-08 11:00 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Northeast Asia -> Taiwan industrial ports",
    commodityHint: "Metal products / minor metals cargo watch",
    relevance: "medium",
    source: "sample_ais_ready",
  },
];

export function getCommodityVessels(commodity: CommodityKey) {
  const allowedTypes = commodityVesselTypes[commodity];
  return commodityVesselPoints.filter((point) => {
    if (commodity === "oil" || commodity === "brent") {
      return point.vesselType === "crude_tanker" || point.vesselType === "product_tanker";
    }
    if (commodity === "naturalGas") return point.vesselType === "lng_tanker";
    if (BULK_COMMODITIES.includes(commodity)) return allowedTypes.includes(point.vesselType);
    return allowedTypes.includes(point.vesselType);
  });
}
