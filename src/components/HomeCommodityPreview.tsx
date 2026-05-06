"use client";

import { useState } from "react";
import { commodityProfiles, commoditySections, type CommodityKey } from "@/app/data";
import CommodityWorldMap from "@/components/CommodityWorldMap";

const SECTION_HEADER_STYLES: Record<
  "agri" | "energy" | "metals",
  { from: string; to: string; border: string; shadow: string }
> = {
  agri: { from: "#7b9264", to: "#5f754b", border: "#5a7047", shadow: "rgba(64, 85, 49, 0.26)" },
  energy: { from: "#4e808a", to: "#365f67", border: "#325760", shadow: "rgba(35, 72, 82, 0.25)" },
  metals: { from: "#ae8553", to: "#876741", border: "#7a5c3b", shadow: "rgba(110, 79, 45, 0.24)" },
};

export default function HomeCommodityPreview() {
  const [selectedKey, setSelectedKey] = useState<CommodityKey>("soybean");
  const selectedProfile = commodityProfiles[selectedKey];

  return (
    <div>
      <div className="space-y-2">
        {commoditySections.map((section) => (
          <div key={section.id} className="flex flex-wrap items-center gap-2">
            {(() => {
              const style = SECTION_HEADER_STYLES[section.id];
              return (
                <span
                  className="rounded-[10px] border px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-white"
                  style={{
                    borderColor: style.border,
                    backgroundImage: `linear-gradient(135deg, ${style.from} 0%, ${style.to} 100%)`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 12px ${style.shadow}`,
                  }}
                >
                  {section.label}
                </span>
              );
            })()}
            {section.keys.map((key) => {
              const isActive = key === selectedKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`rounded-full border px-3 py-1.5 text-xs tracking-[0.08em] transition ${
                    isActive
                      ? "border-[var(--brand-ink)] bg-[var(--brand-ink)] text-white"
                      : "border-[var(--line)] bg-white/80 text-[var(--muted)] hover:bg-white"
                  }`}
                >
                  {commodityProfiles[key].zhName}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 min-h-[260px]">
        <CommodityWorldMap
          compact
          className="h-full"
          showProductionLayer
          showTradeLayer
          productionData={selectedProfile.productionShares}
          activeProductionCode={String(selectedProfile.productionShares[0]?.countryCode ?? "")}
          tradeBubbles={selectedProfile.tradeBubbles}
          activeTradeBubbleId={selectedProfile.tradeBubbles[0]?.id}
        />
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">
        目前預覽：{selectedProfile.zhName} · {selectedProfile.enName}
      </p>
    </div>
  );
}
