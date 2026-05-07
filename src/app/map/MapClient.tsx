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

type TaiwanIndustryMapping = {
  affectedIndustries: string[];
  transmission: string[];
  financeDeskFocus: string[];
  earlySignals: string[];
};

type TaiwanCompanyExposure = {
  company: string;
  ticker?: string;
  homepage: string;
  exposureLevel: "High" | "Medium" | "Low";
  sector: string;
  summary: string;
  impactPath: string;
  sensitivity: string;
  watchItems: string[];
};

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
  sourceUrl: string;
  updatedAt: string;
  stale?: boolean;
  warning?: string;
};

type MarketSnapshotApiResponse = {
  ok?: boolean;
  source?: string;
  upstreamSource?: string;
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

const PRICE_SCALE_BY_COMMODITY: Partial<Record<CommodityKey, number>> = {
  soybean: 100,
  wheat: 100,
  corn: 100,
  coffee: 100,
  copper: 100,
  sugar: 100,
  cotton: 100,
  soybeanOil: 100,
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

const TAIWAN_INDUSTRY_MAPPING: Record<CommodityKey, TaiwanIndustryMapping> = {
  soybean: {
    affectedIndustries: ["飼料", "畜牧", "食品加工", "油脂", "餐飲"],
    transmission: ["黃豆進口成本", "豆粕與飼料價格", "肉品與蛋品成本", "食用油與餐飲毛利"],
    financeDeskFocus: ["食品廠採購週期", "畜牧業毛利壓力", "庫存天數", "民生通膨與報價轉嫁"],
    earlySignals: ["巴西/美國收成", "中國採購節奏", "CBOT 豆粕與豆油價差", "海運與匯率"],
  },
  wheat: {
    affectedIndustries: ["麵粉", "烘焙", "食品加工", "餐飲", "零售通路"],
    transmission: ["小麥進口成本", "麵粉報價", "麵包/麵食成本", "食品通路售價"],
    financeDeskFocus: ["食品通路漲價壓力", "採購合約", "庫存天數", "消費需求彈性"],
    earlySignals: ["黑海出口", "澳洲/北美天氣", "出口國政策", "USD/TWD"],
  },
  corn: {
    affectedIndustries: ["飼料", "畜牧", "食品加工", "澱粉糖", "餐飲"],
    transmission: ["玉米進口成本", "飼料配方成本", "肉品供應鏈", "加工食品原料"],
    financeDeskFocus: ["飼料廠採購", "畜牧客戶現金流", "替代原料比例", "報價調整能力"],
    earlySignals: ["美國單產", "巴西二期作", "乙醇需求", "運費與匯率"],
  },
  coffee: {
    affectedIndustries: ["咖啡連鎖", "食品飲料", "零售通路", "餐飲"],
    transmission: ["咖啡豆進口成本", "烘焙與包材成本", "門市售價", "品牌毛利"],
    financeDeskFocus: ["連鎖餐飲毛利", "庫存採購時點", "品牌漲價空間", "消費需求彈性"],
    earlySignals: ["巴西霜害/乾旱", "越南 Robusta 供給", "ICE 咖啡價差", "航運成本"],
  },
  oil: {
    affectedIndustries: ["塑化", "航運", "航空", "陸運", "能源密集製造"],
    transmission: ["石化原料", "燃油成本", "運輸成本", "通膨預期", "庫存評價"],
    financeDeskFocus: ["客戶採購成本", "燃料避險需求", "毛利壓力", "運價與報價調整"],
    earlySignals: ["OPEC+ 產量", "庫存週報", "中東風險", "美元與裂解價差"],
  },
  brent: {
    affectedIndustries: ["塑化", "航運", "航空", "能源貿易", "運輸"],
    transmission: ["全球油價基準", "燃油與運費", "煉油價差", "進口能源帳單"],
    financeDeskFocus: ["燃料避險", "客戶營運成本", "匯率曝險", "長約/現貨採購差異"],
    earlySignals: ["北海/中東供給", "海運 chokepoint", "Brent-WTI spread", "地緣政治新聞"],
  },
  naturalGas: {
    affectedIndustries: ["電力", "半導體", "鋼鐵", "水泥", "造紙", "能源密集製造"],
    transmission: ["LNG 進口成本", "發電成本", "電價政策", "工業用電成本", "供電穩定性"],
    financeDeskFocus: ["電價調整風險", "台電政策", "用電大戶成本壓力", "長約與現貨曝險"],
    earlySignals: ["JKM/LNG 價格", "油氣長約", "台電燃料成本", "夏季尖峰用電"],
  },
  aluminum: {
    affectedIndustries: ["機械", "汽車零件", "包材", "航太", "自行車", "電子外殼"],
    transmission: ["鋁錠價格", "加工費", "輕量化材料需求", "包材與零組件成本"],
    financeDeskFocus: ["加工廠毛利", "長短料採購", "客戶轉嫁能力", "替代材料效應"],
    earlySignals: ["中國冶煉產能", "電力成本", "LME 庫存", "汽車/包材需求"],
  },
  copper: {
    affectedIndustries: ["電線電纜", "電子零組件", "電力設備", "AI 電力基建", "營建"],
    transmission: ["銅價與線纜成本", "電氣化投資", "資料中心用電設備", "營建材料成本"],
    financeDeskFocus: ["補庫需求", "報價轉嫁能力", "庫存評價", "美元採購成本"],
    earlySignals: ["中國需求", "礦山干擾", "LME/COMEX 庫存", "AI 電網投資"],
  },
  gold: {
    affectedIndustries: ["金融投資", "珠寶", "資產配置", "保險/投信", "財富管理"],
    transmission: ["避險需求", "美元走勢", "實質利率", "央行買盤", "ETF 資金流"],
    financeDeskFocus: ["客戶避險需求", "資產配置建議", "ETF/基金需求", "美元與利率敏感度"],
    earlySignals: ["美國實質利率", "美元指數", "VIX/地緣風險", "央行購金"],
  },
  silver: {
    affectedIndustries: ["電子", "太陽能", "投資商品", "精密材料"],
    transmission: ["工業需求", "太陽能銀漿", "貴金屬投資需求", "庫存變化"],
    financeDeskFocus: ["電子材料成本", "太陽能需求", "金銀比", "貴金屬避險需求"],
    earlySignals: ["PV 裝機需求", "金銀比", "美元與利率", "工業景氣"],
  },
  nickel: {
    affectedIndustries: ["不鏽鋼", "電池材料", "特殊鋼", "電動車供應鏈"],
    transmission: ["鎳鐵/精煉鎳成本", "不鏽鋼報價", "電池前驅物成本", "庫存評價"],
    financeDeskFocus: ["不鏽鋼客戶毛利", "電池材料採購", "印尼政策", "報價轉嫁"],
    earlySignals: ["印尼 NPI", "LME 庫存", "不鏽鋼需求", "EV 電池化學體系"],
  },
  zinc: {
    affectedIndustries: ["鍍鋅鋼材", "建材", "汽車零件", "五金"],
    transmission: ["鋅錠價格", "鍍鋅加工成本", "建材報價", "營建需求"],
    financeDeskFocus: ["鋼材加工毛利", "營建景氣", "庫存與採購", "報價轉嫁"],
    earlySignals: ["LME 庫存", "冶煉費", "中國建築需求", "歐洲能源成本"],
  },
  lead: {
    affectedIndustries: ["鉛酸電池", "汽機車維修", "儲能", "回收金屬"],
    transmission: ["鉛價", "電池成本", "替換市場需求", "回收料供給"],
    financeDeskFocus: ["電池廠毛利", "回收料價差", "車市售後需求", "庫存評價"],
    earlySignals: ["汽車維修需求", "回收供給", "LME 庫存", "電池出口"],
  },
  tin: {
    affectedIndustries: ["電子焊料", "PCB", "半導體封裝", "化工材料"],
    transmission: ["錫價", "焊料成本", "電子組裝成本", "庫存調整"],
    financeDeskFocus: ["電子代工成本", "封裝材料採購", "庫存週期", "報價轉嫁"],
    earlySignals: ["緬甸/印尼供給", "半導體景氣", "LME 庫存", "電子出口訂單"],
  },
  lithium: {
    affectedIndustries: ["電池材料", "儲能", "電動車", "正極材料"],
    transmission: ["碳酸鋰/氫氧化鋰", "正極材料成本", "電池 cell 報價", "EV/儲能需求"],
    financeDeskFocus: ["電池材料客戶庫存", "長約重議價", "毛利與跌價損失", "需求復甦節奏"],
    earlySignals: ["中國電池價格", "EV 銷量", "鹽湖/硬岩供給", "庫存去化"],
  },
  cobalt: {
    affectedIndustries: ["電池材料", "特殊合金", "電子材料", "航太"],
    transmission: ["鈷中間品", "前驅物成本", "高溫合金材料", "供應鏈集中風險"],
    financeDeskFocus: ["材料廠採購", "DRC 供應風險", "ESG/合規", "庫存評價"],
    earlySignals: ["DRC 出口", "中國冶煉", "LFP 替代", "電池需求"],
  },
  gallium: {
    affectedIndustries: ["GaN 功率元件", "通訊", "化合物半導體", "軍工/航太"],
    transmission: ["高純鎵供給", "GaAs/GaN 晶圓", "功率元件成本", "出口管制風險"],
    financeDeskFocus: ["半導體材料採購", "供應安全庫存", "替代供應商", "政策風險"],
    earlySignals: ["中國出口管制", "GaN 需求", "庫存水位", "晶圓廠擴產"],
  },
  germanium: {
    affectedIndustries: ["光纖", "紅外光學", "太陽能", "航太防務"],
    transmission: ["高純鍺材料", "光纖/紅外元件", "防務需求", "出口管制風險"],
    financeDeskFocus: ["材料安全庫存", "長約採購", "國防/通訊需求", "替代材料評估"],
    earlySignals: ["中國出口政策", "光纖需求", "紅外設備訂單", "庫存水位"],
  },
  cocoa: {
    affectedIndustries: ["巧克力", "食品加工", "烘焙", "零售"],
    transmission: ["可可豆成本", "研磨加工", "品牌售價", "食品毛利"],
    financeDeskFocus: ["食品品牌毛利", "漲價接受度", "庫存採購", "節慶需求"],
    earlySignals: ["西非天氣", "病蟲害", "ICE 可可", "消費需求"],
  },
  sugar: {
    affectedIndustries: ["食品飲料", "烘焙", "餐飲", "加工食品"],
    transmission: ["糖價", "甜味劑成本", "飲料與食品配方", "零售價格"],
    financeDeskFocus: ["食品飲料毛利", "替代甜味劑", "採購合約", "通膨壓力"],
    earlySignals: ["巴西甘蔗", "印度出口政策", "乙醇需求", "天氣風險"],
  },
  cotton: {
    affectedIndustries: ["紡織", "成衣", "零售", "機能布料"],
    transmission: ["棉價", "紗線成本", "布料報價", "成衣零售庫存"],
    financeDeskFocus: ["紡織客戶毛利", "品牌訂單", "庫存週期", "匯率與運費"],
    earlySignals: ["美國/印度天氣", "中國紡織需求", "服飾庫存", "ICE 棉花"],
  },
  soybeanOil: {
    affectedIndustries: ["食品油脂", "餐飲", "生質燃料", "食品加工"],
    transmission: ["豆油價格", "食用油成本", "餐飲毛利", "生質燃料摻配需求"],
    financeDeskFocus: ["油脂採購", "餐飲成本", "豆粕豆油價差", "庫存週期"],
    earlySignals: ["黃豆壓榨利潤", "能源價格", "生質燃料政策", "東南亞棕櫚油"],
  },
};

const ENERGY_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "台塑石化",
    ticker: "6505 TW",
    homepage: "https://www.fpcc.com.tw/",
    exposureLevel: "High",
    sector: "煉油 / 石化原料",
    summary: "原油是煉油與石化料源核心，油價與裂解價差會直接影響庫存評價與煉油毛利。",
    impactPath: "原油價格 -> 進料成本 -> 汽柴油/石化品售價 -> 裂解價差與庫存損益。",
    sensitivity: "屬於高曝險，但不是單純油價漲就一定受惠；關鍵在成品油、石化品報價是否同步轉嫁，以及庫存重估方向。",
    watchItems: ["Brent-WTI spread", "亞洲煉油裂解價差", "石化品報價", "庫存評價損益"],
  },
  {
    company: "台灣中油",
    homepage: "https://www.cpc.com.tw/",
    exposureLevel: "High",
    sector: "能源進口 / 煉油 / 天然氣",
    summary: "同時承擔原油與 LNG 進口，商品價格會傳導到國內油氣成本與能源政策。",
    impactPath: "國際油氣價格 -> 進口成本 -> 國內油氣售價與政策吸收 -> 營運資金需求。",
    sensitivity: "高曝險但政策性很強，價格影響常被油價公式、補貼、凍漲或吸收機制延後反映。",
    watchItems: ["國內油價公式", "LNG 長約/現貨價", "政府能源政策", "台幣匯率"],
  },
  {
    company: "長榮航空",
    ticker: "2618 TW",
    homepage: "https://www.evaair.com/",
    exposureLevel: "High",
    sector: "航空運輸",
    summary: "航空燃油通常是航空公司最大變動成本之一，油價變動會牽動票價、燃油附加費與避險需求。",
    impactPath: "原油/航油價格 -> 燃油成本 -> 營業成本 -> 票價與燃油附加費。",
    sensitivity: "高曝險，短期取決於燃油避險部位與燃油附加費調整；中期看載客率與票價能否吸收成本。",
    watchItems: ["Jet fuel crack spread", "燃油附加費", "載客率", "避險損益"],
  },
  {
    company: "陽明海運",
    ticker: "2609 TW",
    homepage: "https://www.yangming.com/",
    exposureLevel: "Medium",
    sector: "貨櫃航運",
    summary: "燃油價格會影響航運成本，但運價、船隊調度與旺淡季通常更能決定短期獲利。",
    impactPath: "燃油價格 -> 船舶燃料成本 -> 航線成本 -> 運價與燃油附加費談判。",
    sensitivity: "中高曝險；若運價低迷且燃油上升，毛利壓力較明顯，若運價強則可部分轉嫁。",
    watchItems: ["Bunker fuel", "SCFI/FBX 運價", "燃油附加費", "航線供需"],
  },
];

const NATURAL_GAS_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "台灣電力公司",
    homepage: "https://www.taipower.com.tw/",
    exposureLevel: "High",
    sector: "電力 / 發電燃料",
    summary: "天然氣與煤是台灣發電成本核心變數，燃料成本會影響台電虧損、電價政策與用電大戶成本。",
    impactPath: "LNG/煤價 -> 發電燃料成本 -> 台電成本結構 -> 電價審議與產業用電成本。",
    sensitivity: "高曝險但高度政策決定；即期燃料成本不一定立刻反映到電價，會透過政策時滯傳導。",
    watchItems: ["台電燃料成本", "電價費率審議", "JKM LNG", "夏季尖峰備轉容量"],
  },
  {
    company: "台積電",
    ticker: "2330 TW",
    homepage: "https://www.tsmc.com/",
    exposureLevel: "Medium",
    sector: "半導體 / 用電大戶",
    summary: "天然氣不直接作為主要原料，但會透過電價與供電穩定性影響晶圓廠製造成本與資本支出規劃。",
    impactPath: "燃料成本 -> 電價/供電穩定 -> 晶圓製造成本 -> 長約電力與再生能源策略。",
    sensitivity: "中度曝險；單位產品價值高，能源成本不是唯一核心，但供電穩定與電價趨勢非常重要。",
    watchItems: ["產業電價", "再生能源採購", "用電需求", "供電穩定事件"],
  },
  {
    company: "中國鋼鐵",
    ticker: "2002 TW",
    homepage: "https://www.csc.com.tw/",
    exposureLevel: "Medium",
    sector: "鋼鐵 / 能源密集製造",
    summary: "鋼鐵製程受電力、煤焦與天然氣等能源成本影響，能源價格也會影響下游客戶景氣。",
    impactPath: "能源/煤價 -> 製造成本 -> 鋼品報價 -> 下游接單與毛利。",
    sensitivity: "中高曝險；能源成本與鐵礦砂、鋼價週期需一起觀察，不能只看單一燃料。",
    watchItems: ["鋼價盤價", "煤焦價格", "電價", "下游庫存"],
  },
  {
    company: "台灣水泥",
    ticker: "1101 TW",
    homepage: "https://www.taiwancement.com/",
    exposureLevel: "Medium",
    sector: "水泥 / 儲能",
    summary: "水泥是能源密集產業，煤電與替代燃料成本會影響熟料製造；同時也受儲能與能源轉型題材牽動。",
    impactPath: "燃料/電價 -> 熟料成本 -> 水泥報價與毛利 -> 儲能布局價值。",
    sensitivity: "中度曝險；需求端的營建景氣與中國水泥供需仍是重要變數。",
    watchItems: ["煤價", "電價", "水泥報價", "儲能訂單"],
  },
];

const GRAIN_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "大成長城",
    ticker: "1210 TW",
    homepage: "https://www.dachan.com/",
    exposureLevel: "High",
    sector: "飼料 / 肉品 / 食品",
    summary: "黃豆、玉米與小麥會透過飼料與食品原料直接影響成本，是台灣農糧商品傳導最直接的代表公司之一。",
    impactPath: "穀物價格 -> 飼料成本 -> 畜禽養殖成本 -> 肉品與食品毛利。",
    sensitivity: "高曝險；若產品報價可調且庫存成本較低，壓力可延後或部分轉嫁。",
    watchItems: ["CBOT 穀物", "豆粕/玉米價差", "飼料報價", "肉品價格"],
  },
  {
    company: "卜蜂",
    ticker: "1215 TW",
    homepage: "https://www.cptwn.com.tw/",
    exposureLevel: "High",
    sector: "飼料 / 畜牧 / 食品",
    summary: "飼料原料成本是營運核心變數，黃豆與玉米價格會影響養殖端與食品加工端毛利。",
    impactPath: "黃豆/玉米 -> 飼料配方成本 -> 肉雞/豬肉成本 -> 食品售價。",
    sensitivity: "高曝險；需看飼料配方調整、庫存採購與終端價格轉嫁速度。",
    watchItems: ["飼料價格", "肉雞價格", "豆粕", "玉米進口成本"],
  },
  {
    company: "統一企業",
    ticker: "1216 TW",
    homepage: "https://www.uni-president.com.tw/",
    exposureLevel: "Medium",
    sector: "食品 / 飲料 / 通路",
    summary: "受小麥、黃豆油、糖、咖啡等多種原料影響，但品牌與通路能力讓成本轉嫁能力較一般代工廠佳。",
    impactPath: "食品原料 -> 製造成本 -> 通路售價 -> 毛利率與促銷策略。",
    sensitivity: "中度曝險；單一商品影響會被產品組合分散，需看整體食品原料籃子。",
    watchItems: ["食品 CPI", "通路促銷", "原料採購合約", "毛利率"],
  },
  {
    company: "大統益",
    ticker: "1232 TW",
    homepage: "https://www.ttet.com.tw/",
    exposureLevel: "High",
    sector: "黃豆壓榨 / 食用油 / 豆粕",
    summary: "黃豆與豆油、豆粕價差直接影響壓榨利潤，是觀察黃豆油與飼料鏈的重要公司。",
    impactPath: "黃豆進口成本 -> 壓榨 -> 豆油/豆粕售價 -> crush margin。",
    sensitivity: "高曝險；重點不是黃豆價格單邊，而是豆油、豆粕與黃豆之間的壓榨價差。",
    watchItems: ["Crush spread", "豆油價格", "豆粕價格", "黃豆進口到港成本"],
  },
];

const WHEAT_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "聯華實業",
    ticker: "1229 TW",
    homepage: "https://www.lhic.com.tw/",
    exposureLevel: "High",
    sector: "麵粉 / 食品原料",
    summary: "小麥是麵粉加工核心原料，國際小麥與匯率會影響麵粉報價與食品客戶成本。",
    impactPath: "小麥價格 -> 進口成本 -> 麵粉報價 -> 烘焙與食品加工成本。",
    sensitivity: "高曝險；若採購合約與庫存天數較長，價格變化會有時間差。",
    watchItems: ["CBOT/MATIF 小麥", "USD/TWD", "麵粉報價", "黑海出口"],
  },
  ...GRAIN_EXPOSURES.slice(0, 3),
];

const SOFT_COMMODITY_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "統一超商",
    ticker: "2912 TW",
    homepage: "https://www.7-11.com.tw/",
    exposureLevel: "Medium",
    sector: "咖啡 / 鮮食 / 通路",
    summary: "咖啡、糖、可可與乳品等原料會影響鮮食與飲品毛利，但通路規模與定價能力可分散衝擊。",
    impactPath: "軟性商品價格 -> 飲品/甜點成本 -> 門市售價與促銷 -> 通路毛利。",
    sensitivity: "中度曝險；單一商品成本通常不是決定性，需搭配人事、租金與促銷策略。",
    watchItems: ["咖啡豆價格", "糖價", "鮮食毛利", "促銷頻率"],
  },
  {
    company: "南僑",
    ticker: "1702 TW",
    homepage: "https://www.namchow.com.tw/",
    exposureLevel: "Medium",
    sector: "油脂 / 烘焙 / 餐飲食品",
    summary: "油脂、小麥、糖與可可等食品原料會影響烘焙、冷凍麵糰與餐飲相關產品成本。",
    impactPath: "食品原料 -> 加工成本 -> 餐飲/烘焙客戶報價 -> 毛利率。",
    sensitivity: "中度曝險；產品組合多元，成本壓力通常透過報價與產品結構逐步反映。",
    watchItems: ["糖價", "油脂價格", "麵粉價格", "餐飲需求"],
  },
  {
    company: "宏亞食品",
    ticker: "1236 TW",
    homepage: "https://www.hunya.com.tw/",
    exposureLevel: "Medium",
    sector: "巧克力 / 休閒食品",
    summary: "可可與糖是巧克力及甜食成本的重要來源，商品價格上升會壓縮促銷與毛利空間。",
    impactPath: "可可/糖價 -> 原料成本 -> 巧克力與甜食售價 -> 毛利與促銷。",
    sensitivity: "中高曝險；品牌與節慶需求可提供部分轉嫁，但可可急漲時壓力明顯。",
    watchItems: ["ICE cocoa", "糖價", "節慶銷售", "通路促銷"],
  },
];

const COPPER_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "華新麗華",
    ticker: "1605 TW",
    homepage: "https://www.walsin.com/",
    exposureLevel: "High",
    sector: "電線電纜 / 銅材",
    summary: "銅是電線電纜核心原料，價格會直接影響存貨評價、接單報價與工程客戶成本。",
    impactPath: "銅價 -> 銅線/銅桿成本 -> 電線電纜報價 -> 電力與營建工程成本。",
    sensitivity: "高曝險；通常具報價轉嫁機制，但庫存成本與報價時差會造成短期毛利波動。",
    watchItems: ["LME/COMEX 銅", "台電強韌電網標案", "銅庫存", "美元匯率"],
  },
  {
    company: "大亞電線電纜",
    ticker: "1609 TW",
    homepage: "https://www.taya.com.tw/",
    exposureLevel: "High",
    sector: "電線電纜 / 電力基建",
    summary: "電力基建、再生能源與資料中心用電需求會放大銅材需求，銅價影響成本與接單毛利。",
    impactPath: "銅價 -> 線纜成本 -> 電網/綠電工程報價 -> 毛利與營運資金。",
    sensitivity: "高曝險；若台灣電網投資持續，需求面可抵消部分成本壓力。",
    watchItems: ["電網標案", "再生能源建置", "銅價", "在手訂單"],
  },
  {
    company: "士林電機",
    ticker: "1503 TW",
    homepage: "https://www.seec.com.tw/",
    exposureLevel: "Medium",
    sector: "電力設備 / 變壓器",
    summary: "變壓器、開關設備與電力設備會使用銅與鋼材，受電網投資與材料成本雙重影響。",
    impactPath: "銅價 -> 電力設備材料成本 -> 標案報價 -> 毛利率。",
    sensitivity: "中度曝險；需求端的台電投資與資料中心建置也會推升訂單。",
    watchItems: ["台電強韌電網", "銅價", "設備交期", "工程標案"],
  },
  {
    company: "台達電子",
    ticker: "2308 TW",
    homepage: "https://www.deltaww.com/",
    exposureLevel: "Low",
    sector: "電源管理 / AI 電力基建",
    summary: "銅價不是台達核心變數，但 AI 伺服器、資料中心與電力電子需求會與銅需求同向。",
    impactPath: "AI 電力需求 -> 電源/散熱/基建訂單 -> 間接受惠銅需求主題。",
    sensitivity: "低直接曝險、高主題連動；台達更偏需求受惠，不宜把它視為銅成本敏感公司。",
    watchItems: ["AI 電源訂單", "資料中心 capex", "電力效率需求", "銅價趨勢"],
  },
];

const ALUMINUM_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "巧新科技",
    ticker: "1563 TW",
    homepage: "https://www.superalloy.tw/",
    exposureLevel: "Medium",
    sector: "鋁合金輪圈 / 汽車零件",
    summary: "鋁合金是汽車輪圈與輕量化零件重要材料，鋁價會影響材料成本與客戶報價。",
    impactPath: "鋁價 -> 鋁合金材料成本 -> 汽車零件報價 -> 毛利率。",
    sensitivity: "中高曝險；高階汽車零件通常有技術與客戶認證門檻，成本轉嫁能力優於一般加工廠。",
    watchItems: ["LME 鋁", "汽車銷量", "高階車款訂單", "客戶報價調整"],
  },
  {
    company: "和大工業",
    ticker: "1536 TW",
    homepage: "https://www.hota.com.tw/",
    exposureLevel: "Medium",
    sector: "汽車傳動 / 電動車零件",
    summary: "鋁價影響車用零件輕量化材料成本，但公司更主要受汽車與 EV 供應鏈需求驅動。",
    impactPath: "鋁/鋼材成本 -> 汽車零件成本 -> 車廠供應鏈報價。",
    sensitivity: "中度曝險；材料只是成本一環，實際影響需搭配車廠訂單與產品組合。",
    watchItems: ["EV 銷量", "鋁價", "車廠訂單", "匯率"],
  },
  {
    company: "南亞塑膠",
    ticker: "1303 TW",
    homepage: "https://www.npc.com.tw/",
    exposureLevel: "Low",
    sector: "包材 / 塑化 / 電子材料",
    summary: "鋁本身不是主要原料，但包材與電子材料鏈會同時受原物料、能源與終端需求影響。",
    impactPath: "包材需求 -> 原料成本 -> 客戶報價與產品組合。",
    sensitivity: "低直接曝險；較適合當作包材與工業材料景氣觀察，而非鋁價純敏感標的。",
    watchItems: ["包材需求", "能源成本", "塑化價差", "電子材料景氣"],
  },
];

const PRECIOUS_METAL_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "台灣銀行",
    homepage: "https://www.bot.com.tw/",
    exposureLevel: "Medium",
    sector: "黃金存摺 / 貴金屬通路",
    summary: "提供黃金相關交易與投資服務，金價與避險需求會影響投資人交易熱度。",
    impactPath: "金價/避險需求 -> 黃金交易與存摺需求 -> 財富管理與通路服務。",
    sensitivity: "中度曝險；較偏交易量與客戶需求，不是持有大量金價方向性曝險。",
    watchItems: ["金價", "美元", "實質利率", "避險交易量"],
  },
  {
    company: "元大投信",
    homepage: "https://www.yuantafunds.com/",
    exposureLevel: "Medium",
    sector: "ETF / 投資商品",
    summary: "貴金屬行情會帶動相關 ETF、基金與資產配置需求，是觀察投資商品需求的窗口。",
    impactPath: "金銀價格 -> ETF/基金需求 -> 管理資產規模與交易熱度。",
    sensitivity: "中度曝險；主要反映在產品需求與 AUM，而非商品成本。",
    watchItems: ["ETF 流量", "金銀比", "美元指數", "實質利率"],
  },
  {
    company: "國泰投信",
    homepage: "https://www.cathaysite.com.tw/",
    exposureLevel: "Medium",
    sector: "ETF / 資產配置",
    summary: "金價與避險情緒會影響投資人對商品型與避險型資產的配置意願。",
    impactPath: "市場風險/利率 -> 黃金需求 -> ETF 與基金配置需求。",
    sensitivity: "中度曝險；適合看作金融商品需求連動，不宜解讀為金價成本敏感。",
    watchItems: ["ETF 申贖", "VIX", "實質利率", "美元"],
  },
];

const STAINLESS_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "燁聯鋼鐵",
    homepage: "https://www.yusco.com.tw/",
    exposureLevel: "High",
    sector: "不鏽鋼",
    summary: "鎳是 300 系不鏽鋼重要成本，鎳價會影響不鏽鋼盤價、庫存評價與接單毛利。",
    impactPath: "鎳價 -> 不鏽鋼原料成本 -> 盤價 -> 下游客戶補庫。",
    sensitivity: "高曝險；但需同時看鉻鐵、廢鋼與不鏽鋼需求，不能只看鎳價。",
    watchItems: ["LME 鎳", "不鏽鋼盤價", "中國/印尼供給", "庫存水位"],
  },
  {
    company: "唐榮",
    ticker: "2035 TW",
    homepage: "https://www.tangeng.com.tw/",
    exposureLevel: "High",
    sector: "不鏽鋼",
    summary: "不鏽鋼產品受鎳價與鋼市需求牽動，原料價格波動會影響存貨與報價節奏。",
    impactPath: "鎳/鉻/廢鋼 -> 不鏽鋼成本 -> 盤價與接單。",
    sensitivity: "高曝險；若下游需求弱，原料上漲較難完整轉嫁。",
    watchItems: ["鎳價", "不鏽鋼庫存", "盤價", "外銷接單"],
  },
  {
    company: "中國鋼鐵",
    ticker: "2002 TW",
    homepage: "https://www.csc.com.tw/",
    exposureLevel: "Medium",
    sector: "鋼鐵 / 特殊鋼",
    summary: "鎳、鋅、煤焦與鐵礦砂等會共同影響鋼鐵成本與產品報價。",
    impactPath: "金屬/能源成本 -> 鋼品成本 -> 盤價與下游需求。",
    sensitivity: "中度曝險；是整體金屬與製造景氣指標，不是單一金屬純敏感公司。",
    watchItems: ["鋼價盤價", "原料成本", "營建需求", "製造業景氣"],
  },
];

const ELECTRONICS_METAL_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "日月光投控",
    ticker: "3711 TW",
    homepage: "https://www.aseglobal.com/",
    exposureLevel: "Low",
    sector: "半導體封測",
    summary: "錫、銀與特殊金屬會進入焊料、封裝與材料鏈，但對封測公司通常不是最大成本項。",
    impactPath: "電子金屬價格 -> 焊料/封裝材料 -> 封測成本與供應安全。",
    sensitivity: "低直接曝險；更重要的是終端半導體需求與客戶稼動率。",
    watchItems: ["半導體景氣", "錫價", "銀價", "材料交期"],
  },
  {
    company: "欣興電子",
    ticker: "3037 TW",
    homepage: "https://www.unimicron.com/",
    exposureLevel: "Medium",
    sector: "PCB / IC 載板",
    summary: "銅箔、錫焊料與貴金屬材料影響 PCB/載板成本，但高階產品需求更是毛利關鍵。",
    impactPath: "銅/錫/貴金屬 -> PCB 材料成本 -> 客戶報價與毛利。",
    sensitivity: "中度曝險；材料價格與 ABF/HDI 需求週期需一起看。",
    watchItems: ["銅箔報價", "錫價", "ABF 載板需求", "AI 伺服器"],
  },
  {
    company: "南亞電路板",
    ticker: "8046 TW",
    homepage: "https://www.nanyapcb.com.tw/",
    exposureLevel: "Medium",
    sector: "PCB / 載板",
    summary: "電子金屬與銅箔價格會影響材料成本，但產品組合與稼動率通常更主導獲利。",
    impactPath: "金屬材料 -> 載板/PCB 成本 -> 報價與毛利。",
    sensitivity: "中度曝險；若 AI 需求強，材料上漲比較容易被高階產品吸收。",
    watchItems: ["銅箔", "錫價", "載板報價", "稼動率"],
  },
];

const BATTERY_CRITICAL_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "台灣水泥",
    ticker: "1101 TW",
    homepage: "https://www.taiwancement.com/",
    exposureLevel: "Medium",
    sector: "儲能 / 電池布局",
    summary: "鋰、鈷、鎳價格會影響電池材料與儲能系統成本，也關係到能源轉型投資回收。",
    impactPath: "電池金屬 -> cell/儲能系統成本 -> 儲能案場報價與毛利。",
    sensitivity: "中度曝險；公司不是單純礦商，商品價格更多是儲能成本與投資節奏變數。",
    watchItems: ["碳酸鋰", "電池 cell 價格", "儲能標案", "電價制度"],
  },
  {
    company: "康普材料",
    ticker: "4739 TW",
    homepage: "https://www.coremaxcorp.com/",
    exposureLevel: "Medium",
    sector: "電池材料 / 特用化學",
    summary: "與電池材料鏈連動，鎳鈷錳等金屬價格會影響材料成本與客戶採購節奏。",
    impactPath: "鎳/鈷/鋰 -> 電池材料成本 -> 客戶採購與庫存調整。",
    sensitivity: "中度曝險；需看產品組合、長約價格與下游客戶需求，不能只用金屬現貨價推估。",
    watchItems: ["鎳鈷價格", "電池需求", "客戶庫存", "材料報價"],
  },
  {
    company: "台達電子",
    ticker: "2308 TW",
    homepage: "https://www.deltaww.com/",
    exposureLevel: "Low",
    sector: "電源 / 儲能系統",
    summary: "鋰電池成本會影響儲能系統，但台達更偏電力電子與系統整合需求受惠。",
    impactPath: "電池成本下降 -> 儲能滲透率 -> 電源與系統整合需求。",
    sensitivity: "低直接曝險；商品價格下降反而可能刺激儲能與電源管理需求。",
    watchItems: ["儲能案場", "電池價格", "資料中心電源", "電網投資"],
  },
];

const COMPOUND_SEMI_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "穩懋半導體",
    ticker: "3105 TW",
    homepage: "https://www.winfoundry.com/",
    exposureLevel: "Medium",
    sector: "GaAs / 化合物半導體",
    summary: "鎵與鍺相關材料屬於化合物半導體供應鏈關鍵投入，出口管制與供給緊縮會影響安全庫存。",
    impactPath: "鎵/鍺材料 -> 化合物半導體晶圓 -> RF/通訊元件供應。",
    sensitivity: "中度曝險；材料成本不是唯一變數，但供應安全與交期風險很關鍵。",
    watchItems: ["中國出口管制", "GaAs/GaN 需求", "材料交期", "客戶庫存"],
  },
  {
    company: "宏捷科",
    ticker: "8086 TW",
    homepage: "https://www.awsc.com.tw/",
    exposureLevel: "Medium",
    sector: "化合物半導體",
    summary: "化合物半導體製程與鎵系材料連動，需關注材料供應、通訊需求與客戶庫存。",
    impactPath: "鎵材料 -> 晶圓代工成本與供應 -> RF 元件需求。",
    sensitivity: "中度曝險；需求週期通常比材料價格更大，但材料斷供會造成營運風險。",
    watchItems: ["RF 需求", "鎵出口量", "材料庫存", "智慧手機/通訊訂單"],
  },
  {
    company: "漢磊",
    ticker: "3707 TW",
    homepage: "https://www.epi.episil.com/",
    exposureLevel: "Medium",
    sector: "功率半導體 / 磊晶",
    summary: "GaN/功率半導體題材與鎵材料供應相關，材料可得性會影響擴產與供應鏈安全。",
    impactPath: "鎵材料 -> GaN/功率元件 -> 電源、車用與工業應用。",
    sensitivity: "中度曝險；應區分材料成本與產業需求，不能把鎵價視為公司獲利唯一驅動。",
    watchItems: ["GaN 需求", "功率半導體景氣", "材料供應", "出口管制"],
  },
];

const TEXTILE_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "遠東新世紀",
    ticker: "1402 TW",
    homepage: "https://www.fenc.com/",
    exposureLevel: "Medium",
    sector: "紡織 / 聚酯 / 成衣材料",
    summary: "棉花價格會影響天然纖維競爭與成衣原料籃子，也會與聚酯替代需求互相拉扯。",
    impactPath: "棉價 -> 紗線/布料成本 -> 聚酯替代效應 -> 品牌訂單。",
    sensitivity: "中度曝險；遠東新更偏聚酯與垂直整合，棉價是相對價格與需求替代變數。",
    watchItems: ["棉價", "聚酯價差", "品牌庫存", "成衣訂單"],
  },
  {
    company: "儒鴻",
    ticker: "1476 TW",
    homepage: "https://www.eclat.com.tw/",
    exposureLevel: "Medium",
    sector: "機能布料 / 成衣",
    summary: "棉花與化纖價格影響布料成本，但高階機能布料更受品牌訂單與產品 mix 影響。",
    impactPath: "纖維價格 -> 布料成本 -> 品牌報價 -> 毛利率。",
    sensitivity: "中度曝險；原料可轉嫁程度與品牌訂單強弱比棉價本身更重要。",
    watchItems: ["品牌庫存", "棉價", "化纖價格", "接單能見度"],
  },
  {
    company: "聚陽實業",
    ticker: "1477 TW",
    homepage: "https://www.makalot.com.tw/",
    exposureLevel: "Medium",
    sector: "成衣代工",
    summary: "棉花與布料成本會影響成衣代工報價，但主要仍看客戶訂單、庫存循環與產品組合。",
    impactPath: "棉價/布料 -> 成衣成本 -> 客戶報價 -> 毛利與訂單。",
    sensitivity: "中度曝險；若品牌庫存去化順利，原料壓力較容易被吸收。",
    watchItems: ["美國零售庫存", "品牌訂單", "棉價", "匯率"],
  },
];

const ZINC_LEAD_EXPOSURES: TaiwanCompanyExposure[] = [
  {
    company: "燁輝企業",
    ticker: "2023 TW",
    homepage: "https://www.yiehphui.com.tw/",
    exposureLevel: "Medium",
    sector: "鍍鋅鋼材",
    summary: "鋅是鍍鋅鋼材重要投入，鋅價會影響鍍鋅加工成本與鋼材報價。",
    impactPath: "鋅價 -> 鍍鋅成本 -> 鋼材報價 -> 建材與家電需求。",
    sensitivity: "中高曝險；需搭配鋼價、營建與家電需求一起判斷。",
    watchItems: ["LME 鋅", "鋼價", "鍍鋅加工費", "營建需求"],
  },
  {
    company: "廣隆光電",
    ticker: "1537 TW",
    homepage: "https://www.klb.com.tw/",
    exposureLevel: "High",
    sector: "鉛酸電池",
    summary: "鉛是鉛酸電池核心原料，鉛價與回收鉛供給會直接影響電池成本與毛利。",
    impactPath: "鉛價 -> 電池極板成本 -> 電池售價 -> 毛利率。",
    sensitivity: "高曝險；若回收料供給緊或鉛價急漲，成本壓力會較明顯。",
    watchItems: ["LME 鉛", "回收鉛價", "汽車替換需求", "匯率"],
  },
  {
    company: "中國鋼鐵",
    ticker: "2002 TW",
    homepage: "https://www.csc.com.tw/",
    exposureLevel: "Low",
    sector: "鋼鐵 / 下游材料",
    summary: "鋅對中鋼不是主要原料，但鋅價與鍍鋅鋼需求可作為下游建材與製造景氣觀察。",
    impactPath: "鋅/鍍鋅需求 -> 下游建材景氣 -> 鋼品需求。",
    sensitivity: "低直接曝險；比較適合作為景氣輔助訊號。",
    watchItems: ["鋼價盤價", "鍍鋅需求", "營建景氣", "製造業 PMI"],
  },
];

const TAIWAN_COMPANY_EXPOSURES: Record<CommodityKey, TaiwanCompanyExposure[]> = {
  soybean: GRAIN_EXPOSURES,
  wheat: WHEAT_EXPOSURES,
  corn: GRAIN_EXPOSURES,
  coffee: SOFT_COMMODITY_EXPOSURES,
  cocoa: SOFT_COMMODITY_EXPOSURES,
  sugar: SOFT_COMMODITY_EXPOSURES,
  soybeanOil: GRAIN_EXPOSURES,
  cotton: TEXTILE_EXPOSURES,
  oil: ENERGY_EXPOSURES,
  brent: ENERGY_EXPOSURES,
  naturalGas: NATURAL_GAS_EXPOSURES,
  copper: COPPER_EXPOSURES,
  aluminum: ALUMINUM_EXPOSURES,
  gold: PRECIOUS_METAL_EXPOSURES,
  silver: [...PRECIOUS_METAL_EXPOSURES, ...ELECTRONICS_METAL_EXPOSURES.slice(0, 2)],
  nickel: STAINLESS_EXPOSURES,
  zinc: ZINC_LEAD_EXPOSURES,
  lead: ZINC_LEAD_EXPOSURES,
  tin: ELECTRONICS_METAL_EXPOSURES,
  lithium: BATTERY_CRITICAL_EXPOSURES,
  cobalt: BATTERY_CRITICAL_EXPOSURES,
  gallium: COMPOUND_SEMI_EXPOSURES,
  germanium: COMPOUND_SEMI_EXPOSURES,
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
  const scaledValue = value / (PRICE_SCALE_BY_COMMODITY[commodity] ?? 1);
  const decimals = Math.abs(scaledValue) >= 1000 ? 0 : Math.abs(scaledValue) >= 100 ? 2 : 3;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: Math.abs(scaledValue) >= 1000 ? 0 : 2,
  }).format(scaledValue);
  return `US$ ${formatted} / ${unit}`;
}

function getSnapshotSource(source: string | undefined, upstreamSource: string | undefined, symbol: string) {
  const resolved = source === "cache" || source === "cache-stale" ? upstreamSource : source;
  if (resolved === "stooq") {
    return {
      label: source === "cache" || source === "cache-stale" ? "Stooq historical quotes (cached)" : "Stooq historical quotes",
      url: `https://stooq.com/q/d/?s=${encodeURIComponent(symbol.toLowerCase())}`,
    };
  }

  return {
    label:
      source === "cache" || source === "cache-stale"
        ? "Yahoo Finance Chart API (cached)"
        : "Yahoo Finance Chart API",
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/history?p=${encodeURIComponent(symbol)}`,
  };
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
  const symbol = payload.symbol ?? profile.futuresSymbols[0] ?? "N/A";
  const source = getSnapshotSource(payload.source, payload.upstreamSource, symbol);

  return {
    benchmark: profile.benchmark,
    latest: formatSnapshotPrice(commodity, latestCandle.close),
    ytd: formatSignedPercent(ytd),
    volatility: volatility === null ? "--" : `${volatility.toFixed(1)}%`,
    symbol,
    source: source.label,
    sourceUrl: source.url,
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
  const currentTaiwanMapping = TAIWAN_INDUSTRY_MAPPING[themeKey];
  const currentCompanyExposures = TAIWAN_COMPANY_EXPOSURES[themeKey];
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
  const currentCommoditySection = commoditySections.find((section) => section.keys.includes(themeKey))?.id ?? "agri";
  const productionSource =
    currentCommoditySection === "metals"
      ? {
          label: "USGS Mineral Commodity Summaries",
          href: "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries",
          cadence: "年度更新；MapHouse 依最新公開年報整理",
        }
      : currentCommoditySection === "energy"
        ? {
            label: "EIA International Energy Statistics",
            href: "https://www.eia.gov/international/data/world",
            cadence: "官方資料不定期更新；MapHouse profile 定期校正",
          }
        : {
            label: "FAOSTAT Crops and livestock products",
            href: "https://www.fao.org/faostat/en/#data/QCL",
            cadence: "年度更新；MapHouse 依最新公開年資料整理",
          };
  const tradeListSourceUrl = buildOecTradeSourceUrl(hs4Id, 65000);
  const tradeFlowSourceUrl = buildOecTradeSourceUrl(hs4Id, 65000);
  const yahooSymbol = currentProfile.futuresSymbols[0];
  const klineYahooSourceUrl = yahooSymbol
    ? `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbol)}/history?p=${encodeURIComponent(yahooSymbol)}`
    : "https://finance.yahoo.com/markets/commodities/";
  const displayedFlowYear = tradeFlowYear ?? selectedFlowYear;
  const sourceRows = [
    {
      data: "產量面量圖 / Top producer share",
      source: productionSource.label,
      href: productionSource.href,
      detail: productionSource.cadence,
    },
    {
      data: "進出口泡泡圖",
      source: `OEC BACI API · HS4 ${hs4Id}`,
      href: tradeListSourceUrl,
      detail: `年度雙邊貿易資料；目前顯示 ${displayedFlowYear}；網站快取 6 小時`,
    },
    {
      data: "Trade Flow Map 弧線",
      source: `OEC BACI API · HS4 ${hs4Id}`,
      href: tradeFlowSourceUrl,
      detail: `Exporter → Importer trade value；目前顯示 ${displayedFlowYear}；網站快取 6 小時`,
    },
    {
      data: "OEC 底層資料說明",
      source: "CEPII BACI / UN Comtrade methodology",
      href: "https://www.cepii.fr/DATA_DOWNLOAD/baci/doc/FAQ_BACI.html",
      detail: "BACI 為年度貿易資料，通常不是即時訂單或即時船運資料",
    },
    {
      data: "礦區 / 產區 / 油氣田點位",
      source: currentCommoditySection === "energy" ? "EIA + public operator disclosures" : "USGS MCS + public operator disclosures",
      href:
        currentCommoditySection === "energy"
          ? "https://www.eia.gov/international/analysis/special-topics/WorldOilTransitChokepoints"
          : "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries",
      detail: "MapHouse 手動整理公開資訊；非即時自動更新",
    },
    {
      data: "Pipeline / chokepoint layer",
      source: "EIA World Oil Transit Chokepoints",
      href: "https://www.eia.gov/international/analysis/special-topics/WorldOilTransitChokepoints",
      detail: "MapHouse 手動整理路線與風險事件；非即時自動更新",
    },
    {
      data: "市場價格 / K-line / Snapshot",
      source: "Yahoo Finance / Stooq / TradingView",
      href: marketSnapshot?.sourceUrl ?? klineYahooSourceUrl,
      detail: "價格 API 約 3 分鐘快取；若 Yahoo 限流則切換 Stooq 備援",
    },
    {
      data: "Price Drivers / News signals",
      source: "FRED / GDELT / Google News RSS / Open-Meteo / OEC",
      href: "https://fred.stlouisfed.org/",
      detail: "依各 API 可用性更新；新聞與總經指標為輔助判讀，不等於交易建議",
    },
  ];

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
                <span>
                  市場資料：
                  <a
                    href={marketSnapshot.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {marketSnapshot.source}
                  </a>
                </span>
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
                  {marketSnapshot ? (
                    <>
                      市場資料：
                      <a href={marketSnapshot.sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                        {marketSnapshot.source}
                      </a>
                      {` · ${marketSnapshot.symbol} · ${new Date(marketSnapshot.updatedAt).toLocaleString("zh-TW")}`}
                    </>
                  ) : (
                    `市場資料：${marketSnapshotError ?? "讀取中"}`
                  )}
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
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-3xl text-[var(--brand-ink)]">
                  {currentProfile.zhName} 產業鏈與台灣傳導
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  從全球供應鏈往下追到台灣產業、成本路徑與法金客戶關注點。
                </p>
              </div>
              <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                Taiwan lens
              </span>
            </div>
            <ol className="mt-3 space-y-2">
              {currentProfile.supplyChain.map((step, index) => (
                <li
                  key={step}
                  className="group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-white/68 px-4 py-3 text-sm text-[var(--muted)]"
                >
                  <span className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,var(--olive),var(--wheat))] opacity-70" />
                  <span className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
                    Step {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="mt-4 rounded-2xl border border-[rgb(126_149_110_/_42%)] bg-[linear-gradient(135deg,rgb(238_244_231_/_82%),rgb(255_255_255_/_66%))] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Taiwan Industry Mapping</p>
                  <h4 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">商品價格如何傳導到台灣產業</h4>
                </div>
                <span className="rounded-full bg-[rgb(10_21_38_/_8%)] px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--brand-ink)]">
                  banking view
                </span>
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">主要影響產業</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentTaiwanMapping.affectedIndustries.map((industry) => (
                    <span
                      key={industry}
                      className="rounded-full border border-[rgb(126_149_110_/_38%)] bg-white/78 px-3 py-1 text-xs text-[var(--foreground)]"
                    >
                      {industry}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="rounded-2xl border border-[var(--line)] bg-white/72 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">傳導路徑</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--muted)]">
                    {currentTaiwanMapping.transmission.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--olive)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white/72 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">法金/交易室關注</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--muted)]">
                    {currentTaiwanMapping.financeDeskFocus.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--wheat)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white/72 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">早期觀察訊號</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--muted)]">
                    {currentTaiwanMapping.earlySignals.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sea)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[rgb(174_133_83_/_28%)] bg-[linear-gradient(135deg,rgb(255_250_239_/_84%),rgb(247_251_242_/_72%))] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Taiwan Company Exposure</p>
                  <h4 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">受{currentProfile.zhName}影響的台灣企業</h4>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    以公開業務定位與產業鏈傳導判斷曝險，不硬估沒有可靠基礎的價格彈性。
                  </p>
                </div>
                <span className="rounded-full bg-[rgb(174_133_83_/_14%)] px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--brand-ink)]">
                  equity lens
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {currentCompanyExposures.map((company) => (
                  <details
                    key={`${themeKey}-${company.company}`}
                    className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white/78 shadow-[0_14px_30px_rgb(31_47_31_/_5%)]"
                  >
                    <summary className="cursor-pointer list-none p-4 marker:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-base font-semibold text-[var(--foreground)]">{company.company}</h5>
                            {company.ticker ? (
                              <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] tracking-[0.12em] text-[var(--muted)]">
                                {company.ticker}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{company.sector}</p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            company.exposureLevel === "High"
                              ? "bg-[#8b3f32] text-white"
                              : company.exposureLevel === "Medium"
                                ? "bg-[var(--wheat)] text-white"
                                : "bg-[rgb(126_149_110_/_16%)] text-[var(--brand-ink)]"
                          }`}
                        >
                          {company.exposureLevel}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{company.summary}</p>
                      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                        <span>點開看完整研究</span>
                        <span className="transition group-open:rotate-45">+</span>
                      </div>
                    </summary>

                    <div className="border-t border-[var(--line)] bg-[rgb(247_251_242_/_72%)] p-4">
                      <div className="grid gap-3 text-xs leading-5 text-[var(--muted)] md:grid-cols-2">
                        <div className="rounded-xl border border-[var(--line)] bg-white/70 p-3">
                          <p className="font-semibold uppercase tracking-[0.14em] text-[var(--brand-ink)]">影響路徑</p>
                          <p className="mt-2">{company.impactPath}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--line)] bg-white/70 p-3">
                          <p className="font-semibold uppercase tracking-[0.14em] text-[var(--brand-ink)]">敏感度判斷</p>
                          <p className="mt-2">{company.sensitivity}</p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/70 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-ink)]">觀察指標</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {company.watchItems.map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-[rgb(126_149_110_/_30%)] bg-white px-2.5 py-1 text-[11px] text-[var(--muted)]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      <a
                        href={company.homepage}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--brand-ink)] transition hover:border-[var(--olive)] hover:bg-[#eef3e6]"
                      >
                        前往公司首頁
                      </a>
                    </div>
                  </details>
                ))}
              </div>
            </div>
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

        <footer className="paper-card px-5 py-5 md:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Data Traceability</p>
              <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
                每個圖層的資料來源
              </h3>
            </div>
            <p className="max-w-xl text-[11px] leading-5 text-[var(--muted)]">
              Flow map 使用年度貿易資料，不代表即時訂單；若 OEC 暫無可用資料，系統會改用 MapHouse profile
              估算並在 API 回傳 warning。
            </p>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-white/60">
            <div className="hidden grid-cols-[1.05fr_1fr_1.45fr] border-b border-[var(--line)] bg-[rgb(238_244_231_/_75%)] px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] md:grid">
              <span>Data Layer</span>
              <span>Source</span>
              <span>Update / Notes</span>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {sourceRows.map((row) => (
                <div
                  key={row.data}
                  className="grid gap-1 px-4 py-3 text-[11px] leading-5 text-[var(--muted)] md:grid-cols-[1.05fr_1fr_1.45fr] md:items-center"
                >
                  <p className="font-semibold text-[var(--brand-ink)]">{row.data}</p>
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-[var(--line)] underline-offset-2 transition hover:text-[var(--brand-ink)]"
                  >
                    {row.source}
                  </a>
                  <p>{row.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
