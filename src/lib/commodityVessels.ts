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

export type CommodityLogisticsProfile = {
  title: string;
  primaryRoutes: string[];
  keyNodes: string[];
  taiwanTransmission: string[];
  riskSignals: string[];
  cargoConfidence: string;
  aisUseCase: string;
  routeRiskScore: number;
  routeRiskLabel: "High" | "Medium" | "Low";
  freightSensitivity: string;
  cargoTraceability: "High" | "Medium" | "Low";
  dataUpgradePath: string[];
  playbook: Array<{
    trigger: string;
    implication: string;
    action: string;
  }>;
};

export type CargoSignal = {
  confidence: "High" | "Medium" | "Low";
  label: string;
  rationale: string;
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

const grainLogistics: CommodityLogisticsProfile = {
  title: "穀物與飼料原料實物流向",
  primaryRoutes: ["美灣 / 巴西港口 -> 巴拿馬或好望角 -> 東亞", "澳洲 / 黑海 -> 東亞與東南亞", "南美壓榨中心 -> 亞洲飼料與油脂鏈"],
  keyNodes: ["Panama Canal", "Santos / Paranagua", "US Gulf", "Taichung Port"],
  taiwanTransmission: ["進口到港節奏影響飼料廠庫存", "運費與匯率會放大 CBOT 價格衝擊", "到港延誤會傳導到畜牧與食品加工成本"],
  riskSignals: ["巴拿馬運河水位/通行限制", "黑海出口與戰爭風險", "南美港口排隊與收成季塞港", "颱風造成台灣港口作業延誤"],
  cargoConfidence: "AIS 可看到 bulk carrier 船型、目的港與 ETA，但通常無法直接確認船上是黃豆、小麥或玉米；需搭配出口港、目的港、季節與報關/港口資料推估。",
  aisUseCase: "用 AIS 觀察 bulk carrier 是否往台中/高雄等港口靠近，以及主要糧食航線是否出現延誤或繞道。",
  routeRiskScore: 74,
  routeRiskLabel: "High",
  freightSensitivity: "高：穀物單位價值低、體積大，海運與到港延誤會明顯影響到岸成本。",
  cargoTraceability: "Medium",
  dataUpgradePath: ["AIS positions", "port call events", "bill of lading / customs data", "grain export inspection data"],
  playbook: [
    { trigger: "巴拿馬運河或南美港口延誤", implication: "亞洲到港時間拉長，飼料廠補庫風險上升", action: "追蹤台中港 bulk carrier ETA 與 CBOT + 運費同步變化" },
    { trigger: "黑海出口受阻", implication: "小麥替代來源轉向澳洲/北美，基差可能擴大", action: "把小麥供應風險同步映射到麵粉與烘焙鏈" },
    { trigger: "台灣港口受颱風影響", implication: "短期卸貨與庫存週轉壓力上升", action: "提高飼料、畜牧、食品加工的短期成本 watch" },
  ],
};

const softLogistics: CommodityLogisticsProfile = {
  title: "軟性商品與貨櫃物流",
  primaryRoutes: ["巴西 / 越南 / 西非 -> 亞洲烘焙與食品加工", "東南亞轉運港 -> 台灣通路與食品鏈", "美洲 / 非洲產地 -> 歐亞消費市場"],
  keyNodes: ["Singapore", "Kaohsiung Port", "Suez Canal", "West Africa ports"],
  taiwanTransmission: ["貨櫃運價與交期影響咖啡、可可、棉花到岸成本", "延遲會影響食品與餐飲採購排程", "品牌端通常透過庫存與售價調整吸收短期波動"],
  riskSignals: ["紅海/蘇伊士繞道", "貨櫃運價上升", "東南亞轉運港壅塞", "產地天氣造成出口節奏不穩"],
  cargoConfidence: "AIS 對貨櫃船只能提供船舶與航線資訊，無法知道特定貨櫃內裝的是咖啡、可可或棉花；商品判斷需要提單或海關資料。",
  aisUseCase: "用 AIS 追蹤貨櫃航線壅塞與到港節奏，而不是判斷單艘船的確切貨物。",
  routeRiskScore: 58,
  routeRiskLabel: "Medium",
  freightSensitivity: "中：軟性商品多走貨櫃或雜貨，物流延誤重要，但價格仍更受產地天氣與庫存影響。",
  cargoTraceability: "Low",
  dataUpgradePath: ["container line schedule", "port congestion feed", "customs HS code data", "supplier shipment records"],
  playbook: [
    { trigger: "紅海/蘇伊士繞道", implication: "歐亞貨櫃航線時間拉長，咖啡與可可到岸成本可能上升", action: "追蹤貨櫃運價與食品飲料毛利壓力" },
    { trigger: "東南亞轉運港壅塞", implication: "台灣進口交期不穩，餐飲與通路補貨風險上升", action: "把港口壅塞列入餐飲/零售採購 watch" },
    { trigger: "產地天氣與物流同時惡化", implication: "供給衝擊可能由價格擴散到實體缺貨", action: "提高 soft commodities 的風險權重" },
  ],
};

const oilLogistics: CommodityLogisticsProfile = {
  title: "油輪航線與煉油供給風險",
  primaryRoutes: ["波斯灣 -> 荷姆茲 -> 麻六甲 -> 東亞", "美灣 -> 巴拿馬/太平洋 -> 亞洲", "北海 / 西非 -> 歐亞煉油中心"],
  keyNodes: ["Strait of Hormuz", "Strait of Malacca", "Suez Canal", "Mailiao Industrial Port"],
  taiwanTransmission: ["油輪到港與航線風險影響煉油料源安全", "保險費、運費與繞道會推升到岸成本", "燃油與石化原料成本再傳導到塑化、航空、航運"],
  riskSignals: ["中東衝突與荷姆茲風險", "油輪繞道造成航程拉長", "制裁改變俄油/中東油流向", "亞洲煉油裂解價差變化"],
  cargoConfidence: "AIS 可辨識 crude/product tanker、目的港、速度與吃水，能推估載貨狀態；但要知道是哪一種原油或買賣雙方，通常需要 Kpler/Vortexa 等 cargo intelligence。",
  aisUseCase: "用 AIS 觀察油輪是否集中在荷姆茲、麻六甲與台灣周邊港口，作為供應鏈壅塞與風險輔助訊號。",
  routeRiskScore: 86,
  routeRiskLabel: "High",
  freightSensitivity: "高：油輪航程、保險費、繞道與裂解價差會直接影響到岸油品與石化料源成本。",
  cargoTraceability: "Medium",
  dataUpgradePath: ["AIS positions", "vessel draught", "fixture / tanker freight", "Kpler or Vortexa cargo flows"],
  playbook: [
    { trigger: "荷姆茲或紅海風險升高", implication: "油輪保險費與繞道風險上升，東亞到岸成本敏感", action: "同步觀察 Brent、航運燃油、塑化與航空燃油成本" },
    { trigger: "油輪速度下降或等待卸貨增加", implication: "可能出現港口壅塞或煉廠採購節奏變化", action: "把 tanker watch 接到台塑化、中油、航空與航運成本卡" },
    { trigger: "制裁改變俄油/中東油流向", implication: "全球油輪噸海里需求與折價結構改變", action: "追蹤 Brent-WTI spread 與亞洲裂解價差" },
  ],
};

const gasLogistics: CommodityLogisticsProfile = {
  title: "LNG 船運與電力燃料安全",
  primaryRoutes: ["卡達 / 澳洲 / 美國 -> 亞洲 LNG 接收站", "波斯灣 -> 荷姆茲 -> 麻六甲 -> 台灣", "澳洲西北大陸棚 -> 東亞"],
  keyNodes: ["Yongan LNG Terminal", "Taichung LNG", "Strait of Hormuz", "Strait of Malacca"],
  taiwanTransmission: ["LNG 到港節奏影響發電燃料安全", "現貨 LNG 與船期變化會牽動台電燃料成本", "尖峰用電季節到港延誤會放大供電風險"],
  riskSignals: ["JKM 價格波動", "LNG 船等待卸貨", "卡達/澳洲供給事件", "颱風造成接收站作業延誤"],
  cargoConfidence: "LNG tanker 船型辨識度高，AIS 對 LNG 航線較有用；但合約價格、買方與貨源仍需要商業資料庫或公司揭露。",
  aisUseCase: "用 AIS 觀察 LNG tanker 是否靠近永安/台中接收站，以及荷姆茲、麻六甲是否出現 LNG 航線壅塞。",
  routeRiskScore: 82,
  routeRiskLabel: "High",
  freightSensitivity: "高：LNG 專用船、接收站排程與現貨價格會一起影響電力燃料安全。",
  cargoTraceability: "High",
  dataUpgradePath: ["AIS positions", "LNG terminal arrivals", "JKM / DES price", "cargo intelligence for origin and buyer"],
  playbook: [
    { trigger: "LNG 船接收站等待時間上升", implication: "卸貨排程與燃料庫存壓力增加", action: "提高台電、用電大戶與電價政策 watch" },
    { trigger: "卡達/澳洲供給事件", implication: "亞洲 LNG 現貨價格敏感度上升", action: "同步觀察 JKM、台灣接收站 ETA 與夏季尖峰用電" },
    { trigger: "荷姆茲或麻六甲航線壅塞", implication: "LNG 到港不確定性上升", action: "將航線風險連到天然氣 price drivers" },
  ],
};

const metalLogistics: CommodityLogisticsProfile = {
  title: "礦砂、精礦與工業金屬物流",
  primaryRoutes: ["南美礦山港口 -> 中國/東亞冶煉中心", "澳洲 / 印尼 / 非洲 -> 亞洲金屬加工鏈", "中國/東南亞 -> 台灣電子與機械供應鏈"],
  keyNodes: ["Chile / Peru west coast ports", "Guinea bauxite ports", "Indonesia nickel hubs", "Kaohsiung Port"],
  taiwanTransmission: ["金屬多先流向中國/東亞冶煉，再透過材料、半成品或零組件傳導到台灣", "運費與冶煉瓶頸會影響銅箔、線纜、鋁材與不鏽鋼成本", "台灣企業通常更接近下游材料與加工端"],
  riskSignals: ["礦山罷工與港口封鎖", "印尼/中國出口政策", "紅海或蘇伊士繞道影響歐亞航線", "東亞港口壅塞"],
  cargoConfidence: "AIS 可看到 bulk/general cargo 船型與目的港，但無法直接知道是銅精礦、鋁土礦、鎳礦或其他散貨；需搭配礦山港口、報關資料與貿易資料推估。",
  aisUseCase: "用 AIS 觀察散貨船與雜貨船在礦產出口港、東亞冶煉港與台灣工業港的到港節奏。",
  routeRiskScore: 66,
  routeRiskLabel: "Medium",
  freightSensitivity: "中：礦砂與精礦運輸重要，但價格更常由礦山供給、冶煉瓶頸與庫存主導。",
  cargoTraceability: "Medium",
  dataUpgradePath: ["AIS positions", "mine/export terminal mapping", "customs HS code data", "smelter import records"],
  playbook: [
    { trigger: "礦山港口封鎖或罷工", implication: "精礦供給收縮，TC/RC 或冶煉端壓力上升", action: "把風險連到銅、鋁、鎳等金屬供給卡" },
    { trigger: "印尼/中國出口政策變化", implication: "鎳、鋁、稀散金屬實物流向可能重排", action: "同步更新產區點位與貿易 flow map" },
    { trigger: "東亞冶煉港壅塞", implication: "下游材料交期不穩，台灣電子與機械鏈成本承壓", action: "提高台灣企業曝險卡的物流風險標籤" },
  ],
};

const preciousLogistics: CommodityLogisticsProfile = {
  title: "貴金屬物流與金融需求",
  primaryRoutes: ["礦產國 -> 精煉中心 -> 金融/工業需求市場", "倫敦/瑞士/亞洲金融中心 -> 投資與珠寶市場", "太陽能材料鏈 -> 亞洲製造基地"],
  keyNodes: ["London / Zurich vaulting centers", "Hong Kong / Singapore", "Taiwan financial channels", "Solar supply chain hubs"],
  taiwanTransmission: ["黃金主要透過投資需求、ETF/基金與財富管理傳導", "白銀則同時連動投資需求與太陽能銀漿成本", "實體運輸不是台灣價格傳導的主要觀察點"],
  riskSignals: ["美元與實質利率", "ETF 資金流", "央行買盤", "太陽能需求與銀漿成本"],
  cargoConfidence: "貴金屬常透過高安全物流與金融庫存移轉，AIS 對單一商品判斷價值有限；更適合觀察金融流、ETF 與利率。",
  aisUseCase: "不建議把黃金白銀做成船舶追蹤主題；AIS 只適合輔助白銀工業材料或貨櫃物流，不應作為主要訊號。",
  routeRiskScore: 28,
  routeRiskLabel: "Low",
  freightSensitivity: "低：黃金白銀價格主要由利率、美元、避險與投資需求驅動，海運不是核心訊號。",
  cargoTraceability: "Low",
  dataUpgradePath: ["ETF flow", "central bank buying", "vault / exchange inventory", "solar silver demand indicators"],
  playbook: [
    { trigger: "ETF 或央行買盤放大", implication: "金融需求比實體物流更能解釋價格", action: "優先更新 price drivers，而非 AIS layer" },
    { trigger: "太陽能銀漿需求升溫", implication: "白銀工業需求可能支撐價格", action: "把白銀與太陽能企業曝險連動" },
    { trigger: "物流事件影響高安全運輸", implication: "可能影響局部交割或庫存移轉", action: "僅列為低權重輔助訊號" },
  ],
};

export const commodityLogisticsProfiles: Record<CommodityKey, CommodityLogisticsProfile> = {
  soybean: grainLogistics,
  wheat: grainLogistics,
  corn: grainLogistics,
  coffee: softLogistics,
  cocoa: softLogistics,
  sugar: softLogistics,
  cotton: softLogistics,
  soybeanOil: grainLogistics,
  oil: oilLogistics,
  brent: oilLogistics,
  naturalGas: gasLogistics,
  aluminum: metalLogistics,
  copper: metalLogistics,
  nickel: metalLogistics,
  zinc: metalLogistics,
  lead: metalLogistics,
  tin: metalLogistics,
  cobalt: metalLogistics,
  lithium: metalLogistics,
  gallium: metalLogistics,
  germanium: metalLogistics,
  gold: preciousLogistics,
  silver: preciousLogistics,
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
    id: "v-bulk-tw-grain",
    name: "Taiwan Grain",
    mmsi: "416008731",
    imo: "9724431",
    vesselType: "bulk_carrier",
    lat: 24.15,
    lon: 120.38,
    speedKnots: 6.6,
    course: 42,
    destination: "Taichung",
    eta: "2026-05-07 18:30 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "Approaching Taichung bulk terminals",
    commodityHint: "Grain, soybean meal, feedstock bulk import watch",
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
    id: "v-general-tw-metals",
    name: "Taiwan Alloy",
    mmsi: "416009452",
    imo: "9652212",
    vesselType: "general_cargo",
    lat: 22.72,
    lon: 120.05,
    speedKnots: 8.4,
    course: 12,
    destination: "Kaohsiung",
    eta: "2026-05-08 01:10 UTC",
    observedAt: "Sample AIS snapshot",
    routeHint: "South China Sea -> Kaohsiung industrial cargo lane",
    commodityHint: "Metal products, minor metals, and industrial inputs",
    relevance: "high",
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

export function inferCargoSignal(commodity: CommodityKey, vessel: CommodityVesselPoint): CargoSignal {
  if ((commodity === "oil" || commodity === "brent") && vessel.vesselType === "crude_tanker") {
    return {
      confidence: "Medium",
      label: "可能為原油航線",
      rationale: "船型為 crude tanker，且路線位於油輪主航道；但 AIS 無法辨識油種或買賣雙方。",
    };
  }

  if ((commodity === "oil" || commodity === "brent" || commodity === "soybeanOil") && vessel.vesselType === "product_tanker") {
    return {
      confidence: "Medium",
      label: "可能為成品油/液體散貨",
      rationale: "船型與液體商品相符；需靠港口、吃水與 cargo intelligence 才能確認實際貨物。",
    };
  }

  if (commodity === "naturalGas" && vessel.vesselType === "lng_tanker") {
    return {
      confidence: "High",
      label: "LNG 船型高度吻合",
      rationale: "LNG tanker 船型辨識度高，可作為天然氣實物流向的高可信輔助訊號。",
    };
  }

  if (["soybean", "wheat", "corn"].includes(commodity) && vessel.vesselType === "bulk_carrier") {
    return {
      confidence: "Medium",
      label: "可能為穀物/飼料散貨",
      rationale: "bulk carrier 與穀物運輸相符；但需搭配出口港、季節與提單資料確認是黃豆、小麥或玉米。",
    };
  }

  if (["aluminum", "copper", "nickel", "zinc", "lead"].includes(commodity) && vessel.vesselType === "bulk_carrier") {
    return {
      confidence: "Medium",
      label: "可能為礦砂/精礦航線",
      rationale: "bulk carrier 可運礦砂與精礦；需搭配礦區出口港與 HS code 資料確認品項。",
    };
  }

  if (["coffee", "cocoa", "cotton", "tin", "cobalt", "lithium", "gallium", "germanium", "gold", "silver"].includes(commodity)) {
    return {
      confidence: "Low",
      label: "只能作為物流輔助訊號",
      rationale: "此類商品多走貨櫃、雜貨或高安全物流，AIS 無法直接辨識單一商品，需要提單、海關或供應商資料。",
    };
  }

  return {
    confidence: "Low",
    label: "需外部 cargo data 確認",
    rationale: "船型與商品可能相關，但 AIS 本身不提供可驗證的貨物明細。",
  };
}
