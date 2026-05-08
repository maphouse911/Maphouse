"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import CommodityWorldMap from "@/components/CommodityWorldMap";
import {
  globalVesselSamples,
  vesselMapSourceSummary,
  vesselTypeColors,
  vesselTypeLabels,
  vesselWatchZones,
} from "@/lib/vesselMap";
import type { CommodityVesselPoint, CommodityVesselType } from "@/lib/commodityVessels";

const vesselTypeOrder: CommodityVesselType[] = [
  "crude_tanker",
  "product_tanker",
  "lng_tanker",
  "bulk_carrier",
  "container_ship",
  "general_cargo",
];

const sourceLinks = [
  { label: "Spire Maritime AIS", href: "https://spire.com/maritime/" },
  { label: "MarineTraffic AIS", href: "https://www.marinetraffic.com/" },
  { label: "VesselFinder AIS", href: "https://www.vesselfinder.com/" },
  { label: "AISHub", href: "https://www.aishub.net/" },
];

function formatCoordinate(value: number, axis: "lat" | "lon") {
  const direction = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(2)}°${direction}`;
}

function typeCount(vessels: CommodityVesselPoint[], type: CommodityVesselType) {
  return vessels.filter((vessel) => vessel.vesselType === type).length;
}

export default function VesselMapClient() {
  const [activeVesselId, setActiveVesselId] = useState(globalVesselSamples[0]?.id ?? "");
  const [activeTypes, setActiveTypes] = useState<Record<CommodityVesselType, boolean>>({
    crude_tanker: true,
    product_tanker: true,
    lng_tanker: true,
    bulk_carrier: true,
    container_ship: true,
    general_cargo: true,
  });

  const visibleVessels = useMemo(
    () => globalVesselSamples.filter((vessel) => activeTypes[vessel.vesselType]),
    [activeTypes],
  );

  const activeVessel = visibleVessels.find((vessel) => vessel.id === activeVesselId) ?? visibleVessels[0] ?? null;
  const averageSpeed = visibleVessels.length
    ? visibleVessels.reduce((sum, vessel) => sum + vessel.speedKnots, 0) / visibleVessels.length
    : 0;

  function toggleType(type: CommodityVesselType) {
    setActiveTypes((previous) => {
      const next = { ...previous, [type]: !previous[type] };
      const nextVisible = globalVesselSamples.filter((vessel) => next[vessel.vesselType]);
      if (!nextVisible.some((vessel) => vessel.id === activeVesselId)) {
        setActiveVesselId(nextVisible[0]?.id ?? "");
      }
      return next;
    });
  }

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
          <nav className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
            <Link href="/" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2 hover:bg-white">
              Home
            </Link>
            <Link href="/map" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2 hover:bg-white">
              Commodity Map
            </Link>
            <Link href="/topics" className="rounded-full border border-[var(--line)] bg-white/65 px-4 py-2 hover:bg-white">
              Topics
            </Link>
          </nav>
        </header>

        <section className="paper-card p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Vessel Map / AIS Intelligence</p>
          <div className="mt-2 grid gap-4 lg:grid-cols-[1fr,320px]">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight md:text-5xl">全球船舶觀察地圖</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                這一頁獨立於大宗商品地圖，專門用來展示船舶點位、船型、航速、目的港、ETA 與航線推估。現在是 AIS-ready sample
                模式；接上 AIS provider 後，就可以替換成目前全球船舶位置。
              </p>
            </div>
            <div className="rounded-2xl border border-[rgb(47_123_143_/_24%)] bg-[rgb(47_123_143_/_8%)] p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#245d6d]">Data Status</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--brand-ink)]">{vesselMapSourceSummary.mode}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{vesselMapSourceSummary.coverage}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Visible Samples", value: visibleVessels.length.toString(), note: "目前畫面顯示點位" },
            { label: "Vessel Types", value: vesselTypeOrder.filter((type) => activeTypes[type]).length.toString(), note: "啟用船型篩選" },
            { label: "Avg Speed", value: `${averageSpeed.toFixed(1)} kn`, note: "樣本平均航速" },
            { label: "Live AIS", value: "Not connected", note: "需外部 AIS API key" },
          ].map((card) => (
            <article key={card.label} className="paper-card px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{card.label}</p>
              <p className="mt-2 text-xl font-semibold text-[var(--brand-ink)]">{card.value}</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">{card.note}</p>
            </article>
          ))}
        </section>

        <section className="paper-card p-4 md:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Global Vessel Layer</p>
              <p className="mt-1 text-sm text-[var(--muted)]">點擊地圖上的船舶箭頭，可以查看該船的 MMSI、IMO、航速、目的港與貨物推估限制。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {vesselTypeOrder.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                    activeTypes[type] ? "text-white" : "border-[var(--line)] bg-white/75 text-[var(--muted)] hover:bg-white"
                  }`}
                  style={
                    activeTypes[type]
                      ? {
                          borderColor: vesselTypeColors[type],
                          backgroundColor: vesselTypeColors[type],
                        }
                      : undefined
                  }
                >
                  {vesselTypeLabels[type]} {typeCount(globalVesselSamples, type)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),320px]">
            <CommodityWorldMap
              className="min-h-[360px] bg-[#eef3e6]"
              showVesselLayer
              vesselPoints={visibleVessels}
              vesselWatchZones={vesselWatchZones}
              activeVesselId={activeVessel?.id}
              onSelectVessel={setActiveVesselId}
            />

            <aside className="rounded-2xl border border-[var(--line)] bg-white/78 p-4">
              {activeVessel ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Selected Vessel</p>
                      <h2 className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{activeVessel.name}</h2>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: vesselTypeColors[activeVessel.vesselType] }}
                    >
                      {vesselTypeLabels[activeVessel.vesselType]}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    {[
                      ["MMSI", activeVessel.mmsi],
                      ["IMO", activeVessel.imo ?? "N/A"],
                      ["Speed", `${activeVessel.speedKnots.toFixed(1)} kn`],
                      ["Course", `${activeVessel.course}°`],
                      ["Lat", formatCoordinate(activeVessel.lat, "lat")],
                      ["Lon", formatCoordinate(activeVessel.lon, "lon")],
                      ["Destination", activeVessel.destination],
                      ["ETA", activeVessel.eta],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-[var(--line)] bg-[rgb(247_251_242_/_74%)] px-3 py-2">
                        <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</dt>
                        <dd className="mt-1 font-semibold text-[var(--brand-ink)]">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-3 rounded-xl border border-[rgb(47_123_143_/_22%)] bg-[rgb(47_123_143_/_8%)] p-3 text-xs leading-5 text-[var(--muted)]">
                    <p className="font-semibold text-[#245d6d]">Route Hint</p>
                    <p className="mt-1">{activeVessel.routeHint}</p>
                  </div>
                  <div className="mt-3 rounded-xl border border-[rgb(207_111_63_/_24%)] bg-[rgb(207_111_63_/_7%)] p-3 text-xs leading-5 text-[var(--muted)]">
                    <p className="font-semibold text-[#8a4b0e]">Cargo Inference</p>
                    <p className="mt-1">{activeVessel.commodityHint}</p>
                  </div>
                  <p className="mt-3 rounded-xl border border-[var(--line)] bg-white/80 p-3 text-[11px] leading-5 text-[var(--muted)]">
                    注意：AIS 通常能看到船位、船型、航速、目的港與 ETA，但不一定能直接知道船上裝的是哪個商品。要精準 cargo
                    需要提單、海關、港口或 Kpler/Vortexa 這類 cargo intelligence。
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--muted)]">目前沒有符合篩選的船舶點位。</p>
              )}
            </aside>
          </div>
        </section>

        <section className="paper-card p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Live Data Upgrade Path</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-white/72 p-4">
              <p className="font-semibold text-[var(--brand-ink)]">1. 接 AIS Provider</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{vesselMapSourceSummary.liveRequirement}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white/72 p-4">
              <p className="font-semibold text-[var(--brand-ink)]">2. 設定更新頻率</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{vesselMapSourceSummary.updateFrequency}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white/72 p-4">
              <p className="font-semibold text-[var(--brand-ink)]">3. 加 Cargo Intelligence</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">再用提單、海關、港口靠泊或商業資料推估船上真正商品。</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
            {sourceLinks.map((source) => (
              <a
                key={source.href}
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[var(--line)] bg-white/75 px-3 py-1.5 underline-offset-2 hover:bg-white hover:underline"
              >
                {source.label}
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
