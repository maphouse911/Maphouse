"use client";

import { useMemo } from "react";
import { geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";

export type CommodityMapHotspot = {
  id: string;
  label: string;
  role: string;
  share: string;
  note: string;
  x: number;
  y: number;
};

export type CommodityProductionDatum = {
  countryCode: string;
  country: string;
  share: number;
};

export type CommodityTradeBubble = {
  id: string;
  country: string;
  countryCode?: string;
  type: "import" | "export";
  share: number;
  x: number;
  y: number;
};

export type CommodityTradeFlow = {
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

export type CommoditySitePoint = {
  id: string;
  name: string;
  country: string;
  kind: "mine" | "field" | "belt" | "basin" | "terminal";
  lat: number;
  lon: number;
  note?: string;
};

export type CommodityPipelineRoute = {
  id: string;
  name: string;
  type: "oil" | "gas";
  from: string;
  to: string;
  commissionedYear: number;
  decommissionedYear?: number;
  lengthKm: number;
  capacity: string;
  sourceUrl: string;
  points: Array<{ lat: number; lon: number }>;
};

export type CommodityPipelineRiskEvent = {
  id: string;
  title: string;
  type: "sanction" | "war" | "accident";
  year: number;
  endYear?: number;
  lat: number;
  lon: number;
  impact: "high" | "medium" | "low";
  routeIds: string[];
};

export type CommodityVesselPoint = {
  id: string;
  name: string;
  mmsi: string;
  imo?: string;
  vesselType: "crude_tanker" | "product_tanker" | "lng_tanker" | "bulk_carrier" | "container_ship" | "general_cargo";
  lat: number;
  lon: number;
  speedKnots: number;
  course: number;
  destination: string;
  eta: string;
  routeHint: string;
  commodityHint: string;
  relevance: "high" | "medium" | "watch";
};

export type CommodityVesselWatchZone = {
  id: string;
  name: string;
  kind: "taiwan_port" | "chokepoint";
  lat: number;
  lon: number;
  note: string;
};

export type CommodityMapMode = "hotspot" | "production" | "trade";

type Props = {
  hotspots?: CommodityMapHotspot[];
  activeHotspotId?: string;
  onSelectHotspot?: (id: string) => void;
  mode?: CommodityMapMode;
  showProductionLayer?: boolean;
  showTradeLayer?: boolean;
  productionData?: CommodityProductionDatum[];
  activeProductionCode?: string;
  onSelectProductionCountry?: (countryCode: string) => void;
  onCountryClick?: (countryCode: string, countryName?: string) => void;
  tradeBubbles?: CommodityTradeBubble[];
  activeTradeBubbleId?: string;
  onSelectTradeBubble?: (id: string) => void;
  tradeFlows?: CommodityTradeFlow[];
  activeTradeFlowId?: string;
  onSelectTradeFlow?: (id: string) => void;
  showSiteLayer?: boolean;
  sitePoints?: CommoditySitePoint[];
  activeSiteId?: string;
  onSelectSite?: (id: string) => void;
  showPipelineLayer?: boolean;
  pipelineRoutes?: CommodityPipelineRoute[];
  pipelineStatusById?: Record<string, "planned" | "active" | "disrupted" | "retired">;
  activePipelineId?: string;
  onSelectPipeline?: (id: string) => void;
  pipelineRiskEvents?: CommodityPipelineRiskEvent[];
  activePipelineRiskEventId?: string;
  onSelectPipelineRiskEvent?: (id: string) => void;
  showVesselLayer?: boolean;
  vesselPoints?: CommodityVesselPoint[];
  vesselWatchZones?: CommodityVesselWatchZone[];
  activeVesselId?: string;
  onSelectVessel?: (id: string) => void;
  compact?: boolean;
  className?: string;
};

const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 600;
const TRADE_COUNTRY_CODE_BY_NAME: Record<string, string> = {
  Algeria: "12",
  Argentina: "32",
  Australia: "36",
  Bahrain: "48",
  Bangladesh: "50",
  Brazil: "76",
  Canada: "124",
  Chile: "152",
  China: "156",
  Colombia: "170",
  "DR Congo": "180",
  Egypt: "818",
  Ethiopia: "231",
  France: "250",
  Germany: "276",
  Guatemala: "320",
  Honduras: "340",
  Iceland: "352",
  India: "356",
  Indonesia: "360",
  Iran: "364",
  Iraq: "368",
  Italy: "380",
  Japan: "392",
  Kazakhstan: "398",
  Kuwait: "414",
  Mexico: "484",
  Netherlands: "528",
  Nigeria: "566",
  Norway: "578",
  Pakistan: "586",
  Paraguay: "600",
  Peru: "604",
  Philippines: "608",
  Qatar: "634",
  Romania: "642",
  Russia: "643",
  "Saudi Arabia": "682",
  Serbia: "688",
  Singapore: "702",
  "South Africa": "710",
  "South Korea": "410",
  Spain: "724",
  Taiwan: "158",
  Thailand: "764",
  Turkey: "792",
  Uganda: "800",
  Ukraine: "804",
  UAE: "784",
  UK: "826",
  Uruguay: "858",
  "United States": "840",
  Vietnam: "704",
  Zambia: "894",
};
const COUNTRY_NAME_BY_CODE: Record<string, string> = Object.entries(TRADE_COUNTRY_CODE_BY_NAME).reduce<Record<string, string>>(
  (acc, [name, code]) => {
    if (!acc[code]) acc[code] = name;
    return acc;
  },
  {}
);

function normalizeCountryCode(code: string | number | undefined) {
  if (code === undefined) return "";
  const asNumber = Number(code);
  return Number.isFinite(asNumber) ? String(asNumber) : String(code);
}

function normalizeCountryName(name: string | undefined) {
  if (!name) return "";
  return name.toLowerCase().replace(/[().]/g, "").replace(/\s+/g, " ").trim();
}

function toSafeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function interpolateRgb(start: [number, number, number], end: [number, number, number], ratio: number) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const mix = (from: number, to: number) => Math.round(from + (to - from) * clamped);
  return `rgb(${mix(start[0], end[0])} ${mix(start[1], end[1])} ${mix(start[2], end[2])})`;
}

function buildMapShapes(compact: boolean) {
  const topology = worldAtlas as unknown as {
    objects: {
      countries: unknown;
    };
  };

  const countriesCollection = feature(topology as never, topology.objects.countries as never) as {
    features?: unknown[];
  };

  const rawFeatures = countriesCollection.features ?? [];
  const filteredFeatures = rawFeatures.filter((country) => {
    const countryId = (country as { id?: string | number }).id;
    return Number(countryId) !== 10; // Exclude Antarctica (ISO numeric 010)
  });

  const projection = geoEquirectangular();
  projection.fitExtent(
    [
      [18, 18],
      [VIEWBOX_WIDTH - 18, VIEWBOX_HEIGHT - 24],
    ],
    {
      type: "FeatureCollection",
      features: filteredFeatures,
    } as never
  );
  projection.scale(projection.scale() * (compact ? 1.05 : 1.08));
  projection.translate([VIEWBOX_WIDTH / 2, VIEWBOX_HEIGHT / 2 + (compact ? 18 : 26)]);

  const pathGenerator = geoPath(projection);
  const centroids = new Map<string, { x: number; y: number }>();
  const countries: Array<{ id: string; countryCode: string; d: string }> = [];

  filteredFeatures.forEach((country, index) => {
    const countryCode = normalizeCountryCode((country as { id?: string | number }).id);
    const d = pathGenerator(country as never) ?? "";
    if (!d) return;
    countries.push({
      id: `country-${index}`,
      countryCode,
      d,
    });

    const [x, y] = pathGenerator.centroid(country as never);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      centroids.set(countryCode, { x, y });
    }
  });

  const project = (lon: number, lat: number) => projection([lon, lat] as [number, number]);
  return { countries, centroids, project };
}

export default function CommodityWorldMap({
  hotspots = [],
  activeHotspotId,
  onSelectHotspot,
  mode = "hotspot",
  showProductionLayer,
  showTradeLayer,
  productionData = [],
  activeProductionCode,
  onSelectProductionCountry,
  onCountryClick,
  tradeBubbles = [],
  activeTradeBubbleId,
  onSelectTradeBubble,
  tradeFlows = [],
  activeTradeFlowId,
  onSelectTradeFlow,
  showSiteLayer = false,
  sitePoints = [],
  activeSiteId,
  onSelectSite,
  showPipelineLayer = false,
  pipelineRoutes = [],
  pipelineStatusById = {},
  activePipelineId,
  onSelectPipeline,
  pipelineRiskEvents = [],
  activePipelineRiskEventId,
  onSelectPipelineRiskEvent,
  showVesselLayer = false,
  vesselPoints = [],
  vesselWatchZones = [],
  activeVesselId,
  onSelectVessel,
  compact = false,
  className = "",
}: Props) {
  const mapShapes = useMemo(() => buildMapShapes(compact), [compact]);
  const isLayerMode = showProductionLayer !== undefined || showTradeLayer !== undefined;
  const productionVisible = isLayerMode ? Boolean(showProductionLayer) : mode === "production";
  const tradeVisible = isLayerMode ? Boolean(showTradeLayer) : mode === "trade";
  const hotspotVisible = !isLayerMode && mode === "hotspot";
  const siteVisible = Boolean(showSiteLayer);
  const pipelineVisible = Boolean(showPipelineLayer);
  const vesselVisible = Boolean(showVesselLayer);

  const productionShareMap = useMemo(() => {
    return new Map(productionData.map((item) => [normalizeCountryCode(item.countryCode), item.share]));
  }, [productionData]);

  const productionRange = useMemo(() => {
    const shares = productionData.map((item) => item.share).filter((value) => Number.isFinite(value));
    if (!shares.length) return { min: 0, max: 1 };
    return { min: Math.min(...shares), max: Math.max(...shares) };
  }, [productionData]);

  const hotspotSizes = useMemo(() => {
    const values = hotspots
      .map((hotspot) => {
        const matched = hotspot.share.match(/-?\d+(\.\d+)?/);
        return matched ? Number(matched[0]) : null;
      })
      .filter((value): value is number => value !== null && Number.isFinite(value));

    const minValue = values.length ? Math.min(...values) : 0;
    const maxValue = values.length ? Math.max(...values) : 1;
    const minSize = compact ? 10 : 11;
    const maxSize = compact ? 28 : 34;
    const spread = maxSize - minSize;
    const midSize = Math.round(minSize + spread * 0.42);

    const scale = (value: number | null) => {
      if (value === null || !values.length) return midSize;
      if (maxValue === minValue) return midSize;
      const ratio = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
      const emphasizedRatio = Math.pow(ratio, 0.55);
      return Math.round(minSize + emphasizedRatio * spread);
    };

    const map = new Map<string, number>();
    hotspots.forEach((hotspot) => {
      const matched = hotspot.share.match(/-?\d+(\.\d+)?/);
      const value = matched ? Number(matched[0]) : null;
      map.set(hotspot.id, scale(value));
    });
    return map;
  }, [compact, hotspots]);

  const tradeBubbleSizes = useMemo(() => {
    const values = tradeBubbles.map((item) => item.share).filter((value) => Number.isFinite(value));
    const minValue = values.length ? Math.min(...values) : 0;
    const maxValue = values.length ? Math.max(...values) : 1;
    const minSize = compact ? 8 : 10;
    const maxSize = compact ? 40 : 74;
    const spread = maxSize - minSize;
    const baseSize = minSize + spread * 0.28;

    const sizeOf = (value: number) => {
      if (!values.length || maxValue === minValue) return Math.round(baseSize);
      const normalized = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
      const emphasized = Math.pow(normalized, 1.45);
      return Math.round(minSize + emphasized * spread);
    };

    const map = new Map<string, number>();
    tradeBubbles.forEach((item) => {
      map.set(item.id, sizeOf(item.share));
    });
    return map;
  }, [compact, tradeBubbles]);

  const tradeBubblePositions = useMemo(() => {
    const positions = new Map<string, { cx: number; cy: number }>();

    tradeBubbles.forEach((bubble) => {
      const resolvedCode = normalizeCountryCode(bubble.countryCode ?? TRADE_COUNTRY_CODE_BY_NAME[bubble.country]);
      const centroid = resolvedCode ? mapShapes.centroids.get(resolvedCode) : undefined;
      const cx = centroid?.x ?? (bubble.x / 100) * VIEWBOX_WIDTH;
      const cy = centroid?.y ?? (bubble.y / 100) * VIEWBOX_HEIGHT;
      positions.set(bubble.id, { cx, cy });
    });

    return positions;
  }, [mapShapes.centroids, tradeBubbles]);

  const tradeBubblePositionByCountry = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    tradeBubbles.forEach((bubble) => {
      const position = tradeBubblePositions.get(bubble.id);
      if (!position) return;
      const key = normalizeCountryName(bubble.country);
      if (!map.has(key)) {
        map.set(key, { x: position.cx, y: position.cy });
      }
    });
    return map;
  }, [tradeBubbles, tradeBubblePositions]);

  const tradeFlowPositions = useMemo(() => {
    const positions = new Map<string, { fromX: number; fromY: number; toX: number; toY: number }>();
    tradeFlows.forEach((flow) => {
      const fromByBubble = tradeBubblePositionByCountry.get(normalizeCountryName(flow.exporter));
      const toByBubble = tradeBubblePositionByCountry.get(normalizeCountryName(flow.importer));

      const fromCode = normalizeCountryCode(TRADE_COUNTRY_CODE_BY_NAME[flow.exporter]);
      const toCode = normalizeCountryCode(TRADE_COUNTRY_CODE_BY_NAME[flow.importer]);
      const fromByCentroid = fromCode ? mapShapes.centroids.get(fromCode) : undefined;
      const toByCentroid = toCode ? mapShapes.centroids.get(toCode) : undefined;

      const from = fromByBubble ?? fromByCentroid;
      const to = toByBubble ?? toByCentroid;

      positions.set(flow.id, {
        fromX: from?.x ?? (flow.fromX / 100) * VIEWBOX_WIDTH,
        fromY: from?.y ?? (flow.fromY / 100) * VIEWBOX_HEIGHT,
        toX: to?.x ?? (flow.toX / 100) * VIEWBOX_WIDTH,
        toY: to?.y ?? (flow.toY / 100) * VIEWBOX_HEIGHT,
      });
    });
    return positions;
  }, [mapShapes.centroids, tradeBubblePositionByCountry, tradeFlows]);

  const tradeFlowStrokeWidth = useMemo(() => {
    const values = tradeFlows.map((item) => item.valueUsd).filter((value) => Number.isFinite(value) && value > 0);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const minWidth = compact ? 0.9 : 1.1;
    const maxWidth = compact ? 8.5 : 12.5;
    const spread = maxWidth - minWidth;

    const widthBy = (value: number) => {
      if (!values.length || max === min) return minWidth + spread * 0.45;
      const ratio = (value - min) / (max - min);
      const emphasized = Math.pow(Math.max(0, Math.min(1, ratio)), 0.42);
      return minWidth + emphasized * spread;
    };

    const map = new Map<string, number>();
    tradeFlows.forEach((item) => map.set(item.id, widthBy(item.valueUsd)));
    return map;
  }, [compact, tradeFlows]);

  const sitePointPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    sitePoints.forEach((point) => {
      const projected = mapShapes.project(point.lon, point.lat);
      if (!projected) return;
      const [x, y] = projected;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      map.set(point.id, { x, y });
    });
    return map;
  }, [mapShapes, sitePoints]);

  const pipelinePathById = useMemo(() => {
    const map = new Map<string, string>();
    pipelineRoutes.forEach((route) => {
      if (route.points.length < 2) return;
      const projected = route.points
        .map((point) => mapShapes.project(point.lon, point.lat))
        .filter(
          (point): point is [number, number] =>
            point !== null && point !== undefined && Number.isFinite(point[0]) && Number.isFinite(point[1])
        );
      if (projected.length < 2) return;
      const d = projected.map((point, index) => `${index === 0 ? "M" : "L"} ${point[0]} ${point[1]}`).join(" ");
      map.set(route.id, d);
    });
    return map;
  }, [mapShapes, pipelineRoutes]);

  const pipelineRiskEventPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    pipelineRiskEvents.forEach((event) => {
      const projected = mapShapes.project(event.lon, event.lat);
      if (!projected) return;
      const [x, y] = projected;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      map.set(event.id, { x, y });
    });
    return map;
  }, [mapShapes, pipelineRiskEvents]);

  const vesselPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    vesselPoints.forEach((point) => {
      const projected = mapShapes.project(point.lon, point.lat);
      if (!projected) return;
      const [x, y] = projected;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      map.set(point.id, { x, y });
    });
    return map;
  }, [mapShapes, vesselPoints]);

  const watchZonePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    vesselWatchZones.forEach((zone) => {
      const projected = mapShapes.project(zone.lon, zone.lat);
      if (!projected) return;
      const [x, y] = projected;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      map.set(zone.id, { x, y });
    });
    return map;
  }, [mapShapes, vesselWatchZones]);

  function productionFill(countryCode: string) {
    if (!productionVisible) return "#dbe5cf";
    const value = productionShareMap.get(countryCode);
    if (value === undefined) return "#dce5d2";
    if (productionRange.max === productionRange.min) return "#6f8f66";
    const ratio = (value - productionRange.min) / (productionRange.max - productionRange.min);
    const emphasized = Math.pow(Math.max(0, Math.min(1, ratio)), 0.55);
    return interpolateRgb([210, 224, 195], [72, 113, 68], emphasized);
  }

  const mapBackground = productionVisible ? "#edf5e7" : "#eef3e6";

  return (
    <div className={`relative aspect-[2/1] w-full overflow-hidden rounded-2xl border border-[var(--line)] ${className}`}>
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <defs>
          <filter id="site-point-glow" x="-220%" y="-220%" width="440%" height="440%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
          </filter>
          <filter id="risk-event-glow" x="-240%" y="-240%" width="480%" height="480%">
            <feGaussianBlur stdDeviation="2.2" result="risk-blur" />
          </filter>
          <filter id="vessel-point-glow" x="-260%" y="-260%" width="520%" height="520%">
            <feGaussianBlur stdDeviation="2.8" result="vessel-blur" />
          </filter>
          {tradeVisible
            ? tradeFlows.map((flow) => {
                const resolved = tradeFlowPositions.get(flow.id);
                const fromX = resolved?.fromX ?? (flow.fromX / 100) * VIEWBOX_WIDTH;
                const fromY = resolved?.fromY ?? (flow.fromY / 100) * VIEWBOX_HEIGHT;
                const toX = resolved?.toX ?? (flow.toX / 100) * VIEWBOX_WIDTH;
                const toY = resolved?.toY ?? (flow.toY / 100) * VIEWBOX_HEIGHT;
                const gradientId = `trade-flow-grad-${toSafeId(flow.id)}`;
                const isActive = flow.id === activeTradeFlowId;
                return (
                  <linearGradient key={gradientId} id={gradientId} gradientUnits="userSpaceOnUse" x1={fromX} y1={fromY} x2={toX} y2={toY}>
                    <stop offset="0%" stopColor="#69b37e" stopOpacity={isActive ? 0.95 : 0.62} />
                    <stop offset="62%" stopColor="#d0a96b" stopOpacity={isActive ? 0.86 : 0.48} />
                    <stop offset="100%" stopColor="#ce6d78" stopOpacity={isActive ? 0.92 : 0.6} />
                  </linearGradient>
                );
              })
            : null}
        </defs>

        <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill={mapBackground} />

        <g>
          {mapShapes.countries.map((country) => (
            <path
              key={country.id}
              d={country.d}
              fill={productionFill(country.countryCode)}
              stroke={country.countryCode === activeProductionCode && productionVisible ? "#39582e" : "#b8c5aa"}
              strokeWidth={country.countryCode === activeProductionCode && productionVisible ? "1.8" : "0.75"}
              className={productionVisible && (onSelectProductionCountry || onCountryClick) ? "cursor-pointer" : undefined}
              onClick={() => {
                if (productionVisible && onSelectProductionCountry && productionShareMap.has(country.countryCode)) {
                  onSelectProductionCountry(country.countryCode);
                }
                if (onCountryClick) {
                  onCountryClick(country.countryCode, COUNTRY_NAME_BY_CODE[country.countryCode]);
                }
              }}
            />
          ))}
        </g>

        {tradeVisible ? (
          <g>
            {tradeFlows.map((flow, index) => {
              const resolved = tradeFlowPositions.get(flow.id);
              const fromX = resolved?.fromX ?? (flow.fromX / 100) * VIEWBOX_WIDTH;
              const fromY = resolved?.fromY ?? (flow.fromY / 100) * VIEWBOX_HEIGHT;
              const toX = resolved?.toX ?? (flow.toX / 100) * VIEWBOX_WIDTH;
              const toY = resolved?.toY ?? (flow.toY / 100) * VIEWBOX_HEIGHT;
              const horizontalDistance = Math.abs(toX - fromX);
              const lift = Math.max(14, Math.min(120, horizontalDistance * 0.24 + 10));
              const laneOffset = (index % 4) * 4;
              const controlX = (fromX + toX) / 2;
              const controlY = (fromY + toY) / 2 - lift - laneOffset;
              const d = `M ${fromX} ${fromY} Q ${controlX} ${controlY} ${toX} ${toY}`;
              const strokeWidth = tradeFlowStrokeWidth.get(flow.id) ?? 2;
              const isActive = flow.id === activeTradeFlowId;
              const gradientId = `trade-flow-grad-${toSafeId(flow.id)}`;

              return (
                <g key={flow.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke="rgb(255 255 255 / 0.38)"
                    strokeWidth={strokeWidth + 1.6}
                    strokeLinecap="round"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={isActive ? strokeWidth + 1.2 : strokeWidth}
                    strokeLinecap="round"
                    style={{ mixBlendMode: "multiply" }}
                  />
                  <circle cx={fromX} cy={fromY} r={isActive ? 2.4 : 1.7} fill="rgb(85 156 102 / 0.75)" />
                  <circle cx={toX} cy={toY} r={isActive ? 2.4 : 1.7} fill="rgb(203 103 113 / 0.78)" />
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={Math.max(10, strokeWidth + 8)}
                    className={onSelectTradeFlow ? "cursor-pointer" : undefined}
                    onClick={onSelectTradeFlow ? () => onSelectTradeFlow(flow.id) : undefined}
                  />
                </g>
              );
            })}
          </g>
        ) : null}

        {pipelineVisible ? (
          <g>
            {pipelineRoutes.map((route) => {
              const d = pipelinePathById.get(route.id);
              if (!d) return null;
              const isActive = route.id === activePipelineId;
              const status = pipelineStatusById[route.id] ?? "active";
              const statusStyle =
                status === "disrupted"
                  ? {
                      stroke: "#ff7a66",
                      glow: "rgba(255,122,102,0.34)",
                      width: isActive ? 2.15 : 1.4,
                      dashArray: "7 4",
                      opacity: 0.9,
                    }
                  : status === "retired"
                    ? {
                      stroke: "#8f9a8d",
                      glow: "rgba(143,154,141,0.2)",
                      width: isActive ? 1.5 : 1.0,
                      dashArray: "3 5",
                      opacity: 0.48,
                    }
                    : status === "planned"
                      ? {
                        stroke: "#9da998",
                        glow: "rgba(157,169,152,0.18)",
                        width: isActive ? 1.4 : 0.95,
                        dashArray: "5 5",
                        opacity: 0.42,
                      }
                      : {
                        stroke: route.type === "oil" ? "#ff9d2f" : "#65dbff",
                        glow: route.type === "oil" ? "rgba(255,157,47,0.27)" : "rgba(101,219,255,0.28)",
                        width: isActive ? 1.9 : 1.2,
                        dashArray: undefined,
                        opacity: 0.88,
                      };
              return (
                <g key={route.id}>
                  <path d={d} fill="none" stroke={statusStyle.glow} strokeWidth={statusStyle.width + 1.2} strokeLinecap="round" />
                  <path
                    d={d}
                    fill="none"
                    stroke={statusStyle.stroke}
                    strokeWidth={statusStyle.width}
                    strokeLinecap="round"
                    strokeDasharray={statusStyle.dashArray}
                    opacity={statusStyle.opacity}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={Math.max(8, statusStyle.width + 6)}
                    className={onSelectPipeline ? "cursor-pointer" : undefined}
                    onClick={onSelectPipeline ? () => onSelectPipeline(route.id) : undefined}
                  />
                </g>
              );
            })}
          </g>
        ) : null}

        {pipelineVisible && pipelineRiskEvents.length ? (
          <g>
            {pipelineRiskEvents.map((event) => {
              const position = pipelineRiskEventPositions.get(event.id);
              if (!position) return null;
              const isActive = event.id === activePipelineRiskEventId;
              const accent =
                event.type === "sanction" ? "#8d6cff" : event.type === "war" ? "#ff6f7d" : "#ff9348";
              const radius = event.impact === "high" ? 4.2 : event.impact === "medium" ? 3.5 : 2.9;
              return (
                <g key={event.id}>
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={radius + (isActive ? 5.8 : 3.8)}
                    fill={accent}
                    opacity={isActive ? 0.34 : 0.24}
                    filter="url(#risk-event-glow)"
                  />
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={radius}
                    fill="#fffef7"
                    stroke={accent}
                    strokeWidth={isActive ? 2 : 1.4}
                    className={onSelectPipelineRiskEvent ? "cursor-pointer" : undefined}
                    onClick={onSelectPipelineRiskEvent ? () => onSelectPipelineRiskEvent(event.id) : undefined}
                  />
                  {isActive ? (
                    <circle
                      cx={position.x}
                      cy={position.y}
                      r={radius + 8}
                      fill="none"
                      stroke={accent}
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      opacity={0.82}
                    />
                  ) : null}
                </g>
              );
            })}
          </g>
        ) : null}

        {tradeVisible ? (
          <g>
            {tradeBubbles.map((bubble) => {
              const radius = tradeBubbleSizes.get(bubble.id) ?? 16;
              const position = tradeBubblePositions.get(bubble.id);
              const cx = position?.cx ?? (bubble.x / 100) * VIEWBOX_WIDTH;
              const cy = position?.cy ?? (bubble.y / 100) * VIEWBOX_HEIGHT;
              const isActive = bubble.id === activeTradeBubbleId;
              const fill = bubble.type === "import" ? "rgb(207 84 78 / 0.66)" : "rgb(67 139 86 / 0.66)";
              const stroke = bubble.type === "import" ? "#b3413b" : "#2f7b47";
              const textColor = bubble.type === "import" ? "#7d231f" : "#1f5f32";
              return (
                <g
                  key={bubble.id}
                  className={onSelectTradeBubble ? "cursor-pointer" : undefined}
                  onClick={onSelectTradeBubble ? () => onSelectTradeBubble(bubble.id) : undefined}
                >
                  <circle cx={cx} cy={cy} r={radius / 2} fill={fill} stroke={stroke} strokeWidth={isActive ? 2.2 : 1.2} />
                  {isActive ? (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius / 2 + 8}
                      fill="none"
                      stroke={stroke}
                      strokeWidth="1.4"
                      strokeDasharray="5 4"
                      opacity="0.65"
                    />
                  ) : null}
                  {radius >= 22 ? (
                    <text
                      x={cx}
                      y={cy + 3}
                      textAnchor="middle"
                      fontSize={compact ? 9 : 10}
                      fontWeight={600}
                      fill={textColor}
                    >
                      {Math.round(bubble.share)}%
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        ) : null}

        {siteVisible ? (
          <g>
            {sitePoints.map((point) => {
              const position = sitePointPositions.get(point.id);
              if (!position) return null;
              const isActive = point.id === activeSiteId;
              const accentColor =
                point.kind === "mine"
                  ? "#ff9a1f"
                  : point.kind === "field"
                    ? "#55d6ff"
                    : point.kind === "terminal"
                      ? "#c39bff"
                      : point.kind === "basin"
                        ? "#53efb2"
                        : "#d3ff72";
              const coreFill = "rgba(255,255,250,0.98)";
              const coreRadius = compact ? 2.0 : isActive ? 2.9 : 2.3;
              const haloRadius = coreRadius + (compact ? 3.1 : isActive ? 5.1 : 3.9);
              return (
                <g key={point.id}>
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={haloRadius}
                    fill={accentColor}
                    opacity={isActive ? 0.58 : 0.44}
                    filter="url(#site-point-glow)"
                  />
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={haloRadius + (isActive ? 1.2 : 0.6)}
                    fill={accentColor}
                    opacity={isActive ? 0.2 : 0.12}
                  />
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={coreRadius}
                    fill={coreFill}
                    stroke={accentColor}
                    strokeWidth={isActive ? 1.6 : 1.2}
                    className={onSelectSite ? "cursor-pointer" : undefined}
                    onClick={onSelectSite ? () => onSelectSite(point.id) : undefined}
                  />
                  {isActive ? (
                    <>
                      <circle
                        cx={position.x}
                        cy={position.y}
                        r={haloRadius + 2.4}
                        fill="none"
                        stroke={accentColor}
                        strokeWidth={1.1}
                        strokeDasharray="3 3"
                        opacity="0.82"
                      />
                      <text
                        x={position.x + 8}
                        y={position.y - 8}
                        fontSize={compact ? 8 : 10}
                        fontWeight={700}
                        fill={accentColor}
                        style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.8)", strokeWidth: 3 }}
                      >
                        {point.name}
                      </text>
                    </>
                  ) : null}
                </g>
              );
            })}
          </g>
        ) : null}

        {vesselVisible ? (
          <g>
            {vesselWatchZones.map((zone) => {
              const position = watchZonePositions.get(zone.id);
              if (!position) return null;
              const color = zone.kind === "taiwan_port" ? "#2f7b47" : "#cf6f3f";
              return (
                <g key={zone.id} opacity={0.78}>
                  <circle cx={position.x} cy={position.y} r={compact ? 3.8 : 5.2} fill="rgb(255 255 255 / 0.68)" stroke={color} strokeWidth={1} />
                  <circle cx={position.x} cy={position.y} r={compact ? 1.3 : 1.8} fill={color} />
                  {!compact && zone.kind === "chokepoint" ? (
                    <text
                      x={position.x + 8}
                      y={position.y - 6}
                      fontSize={8}
                      fontWeight={700}
                      fill={color}
                      style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.82)", strokeWidth: 3 }}
                    >
                      {zone.name}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {vesselPoints.map((point) => {
              const position = vesselPositions.get(point.id);
              if (!position) return null;
              const isActive = point.id === activeVesselId;
              const isEnergy =
                point.vesselType === "crude_tanker" || point.vesselType === "product_tanker" || point.vesselType === "lng_tanker";
              const color =
                point.vesselType === "lng_tanker"
                  ? "#007fa3"
                  : point.vesselType === "crude_tanker" || point.vesselType === "product_tanker"
                    ? "#c45f18"
                    : point.vesselType === "bulk_carrier"
                      ? "#0f5f6f"
                      : "#263f7f";
              const size = compact ? 7.5 : isActive ? 15 : point.relevance === "high" ? 12.5 : 10.5;
              return (
                <g
                  key={point.id}
                  className={onSelectVessel ? "cursor-pointer" : undefined}
                  onClick={onSelectVessel ? () => onSelectVessel(point.id) : undefined}
                >
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={size + (isActive ? 12 : 8)}
                    fill={color}
                    opacity={isActive ? 0.32 : 0.24}
                    filter="url(#vessel-point-glow)"
                  />
                  <line
                    x1={position.x}
                    y1={position.y + size * 0.75}
                    x2={position.x}
                    y2={position.y + size * 1.9}
                    stroke="rgba(255,255,255,0.86)"
                    strokeWidth={isActive ? 2.6 : 1.8}
                    strokeLinecap="round"
                    transform={`rotate(${point.course} ${position.x} ${position.y})`}
                  />
                  <g transform={`translate(${position.x} ${position.y}) rotate(${point.course})`}>
                    <path
                      d={`M 0 ${-size} L ${size * 0.62} ${size * 0.74} L 0 ${size * 0.42} L ${-size * 0.62} ${size * 0.74} Z`}
                      fill={color}
                      stroke="rgba(255,255,255,0.98)"
                      strokeWidth={isActive ? 3 : 2}
                      opacity={isEnergy ? 0.98 : 0.9}
                    />
                  </g>
                  {isActive ? (
                    <>
                      <circle
                        cx={position.x}
                        cy={position.y}
                        r={size + 11}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.2}
                        strokeDasharray="4 3"
                        opacity={0.78}
                      />
                      <text
                        x={position.x + 10}
                        y={position.y - 10}
                        fontSize={compact ? 8 : 10}
                        fontWeight={800}
                        fill={color}
                        style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.86)", strokeWidth: 3 }}
                      >
                        {point.name}
                      </text>
                    </>
                  ) : !compact ? (
                    <text
                      x={position.x + 10}
                      y={position.y + 4}
                      fontSize={9}
                      fontWeight={800}
                      fill={color}
                      style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.82)", strokeWidth: 3 }}
                    >
                      {point.name}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        ) : null}
      </svg>

      {hotspotVisible ? (
        <div className="pointer-events-none absolute inset-0 z-10">
          {hotspots.map((hotspot) => {
            const isActive = hotspot.id === activeHotspotId;
            const dotSize = hotspotSizes.get(hotspot.id) ?? (compact ? 12 : 14);
            const ringSize = Math.max(10, Math.round(dotSize * 1.05));
            return (
              <div
                key={hotspot.id}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
              >
                {onSelectHotspot ? (
                  <button
                    type="button"
                    onClick={() => onSelectHotspot(hotspot.id)}
                    className={`pointer-events-auto relative flex h-4 w-4 items-center justify-center rounded-full border-2 shadow-sm transition ${
                      isActive
                        ? "border-[var(--brand-ink)] bg-[var(--brand-ink)]"
                        : "border-[var(--olive)] bg-[#f8fbf1] hover:bg-[var(--brand-gold-soft)]"
                    }`}
                    style={{
                      width: `${dotSize}px`,
                      height: `${dotSize}px`,
                      boxShadow: isActive ? `0 0 0 ${ringSize}px rgb(10 21 38 / 0.12)` : undefined,
                    }}
                    aria-label={hotspot.label}
                  />
                ) : (
                  <span
                    className="relative block h-3 w-3 rounded-full border border-[var(--olive)] bg-[var(--brand-ink)] shadow-sm"
                    style={{ width: `${dotSize}px`, height: `${dotSize}px` }}
                  />
                )}

                <div className="pointer-events-none mt-2 rounded-full border border-[var(--line)] bg-white/90 px-2.5 py-1 text-[10px] font-medium tracking-[0.06em] text-[var(--foreground)] shadow-sm">
                  {hotspot.label}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
