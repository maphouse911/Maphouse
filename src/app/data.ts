export type CommodityKey = "soybean" | "wheat" | "corn" | "coffee" | "oil";

export type RegionInsight = {
  id: string;
  region: string;
  role: string;
  metric: string;
  color: string;
  blurb: string;
  why: string;
};

export type CommodityTheme = {
  key: CommodityKey;
  title: string;
  subtitle: string;
  insights: RegionInsight[];
};

export const commodityThemes: CommodityTheme[] = [
  {
    key: "soybean",
    title: "Soybean Flows",
    subtitle: "Origins, trade concentration, and feed-cost sensitivity",
    insights: [
      {
        id: "south-america",
        region: "Brazil",
        role: "Net Exporter",
        metric: "Global export share 50%+",
        color: "#b8913d",
        blurb: "Brazil anchors soybean supply and sets the tone for feed inflation in Asia.",
        why: "When harvest logistics tighten, protein prices often rise downstream.",
      },
      {
        id: "north-america",
        region: "United States",
        role: "Producer + Exporter",
        metric: "Weather-sensitive yield cycle",
        color: "#617a42",
        blurb: "US yield surprises can reset global price expectations within weeks.",
        why: "Corn-soy rotation affects broader crop allocation and futures spread.",
      },
      {
        id: "east-asia",
        region: "China",
        role: "Net Importer",
        metric: "Demand-side anchor",
        color: "#2e6f86",
        blurb: "Import demand concentration amplifies freight and crushing margin effects.",
        why: "Demand shifts can reprice soybean curves across exchanges.",
      },
    ],
  },
  {
    key: "wheat",
    title: "Wheat Risk Map",
    subtitle: "Trade corridors and inflation transmission",
    insights: [
      {
        id: "europe",
        region: "Black Sea + Europe",
        role: "Export Corridor",
        metric: "High geopolitical premium",
        color: "#aa5b35",
        blurb: "Black Sea shipment risks are quickly reflected in wheat futures risk premium.",
        why: "Staple-food inflation impacts CPI expectations in import economies.",
      },
      {
        id: "north-america",
        region: "North America",
        role: "Buffer Supplier",
        metric: "Quality + logistics advantage",
        color: "#617a42",
        blurb: "North America often becomes a fallback supplier during regional disruptions.",
        why: "Global buyers rotate origins to manage delivery certainty.",
      },
    ],
  },
  {
    key: "corn",
    title: "Corn Production Pulse",
    subtitle: "Yield volatility and biofuel linkage",
    insights: [
      {
        id: "north-america",
        region: "US Midwest",
        role: "Core Producer",
        metric: "Yield volatility weather-driven",
        color: "#617a42",
        blurb: "Corn price is tightly linked to planting pace, weather, and ethanol demand.",
        why: "Feed, fuel, and food channels all react to the same supply signal.",
      },
      {
        id: "south-america",
        region: "Brazil + Argentina",
        role: "Second-wave Supply",
        metric: "Seasonal export swing",
        color: "#b8913d",
        blurb: "South America's cycle can extend or reverse global corn trend.",
        why: "Seasonal overlap shapes futures term-structure and freight demand.",
      },
    ],
  },
  {
    key: "coffee",
    title: "Coffee Belt Watch",
    subtitle: "Climate shocks and currency pass-through",
    insights: [
      {
        id: "south-america",
        region: "Brazil",
        role: "Arabica Anchor",
        metric: "Frost and drought risk",
        color: "#aa5b35",
        blurb: "Brazil weather events can trigger global repricing in coffee contracts.",
        why: "Consumer brands adjust pricing when bean volatility persists.",
      },
      {
        id: "southeast-asia",
        region: "Vietnam",
        role: "Robusta Leader",
        metric: "Concentrated robusta output",
        color: "#2e6f86",
        blurb: "Vietnam supply changes directly influence robusta benchmark spreads.",
        why: "Blend composition shifts across retail and hospitality chains.",
      },
    ],
  },
  {
    key: "oil",
    title: "Crude Oil Routes",
    subtitle: "Supply discipline, freight, and geopolitical risk",
    insights: [
      {
        id: "middle-east",
        region: "Middle East",
        role: "Export Hub",
        metric: "Route risk priced in",
        color: "#aa5b35",
        blurb: "Oil markets often price expected disruption before stock drawdown appears.",
        why: "Energy shocks diffuse into transport, manufacturing, and CPI baskets.",
      },
      {
        id: "north-america",
        region: "United States",
        role: "Flexible Producer",
        metric: "Shale response window",
        color: "#617a42",
        blurb: "US output elasticity can soften extended supply stress scenarios.",
        why: "Short-cycle production informs medium-term downside risk.",
      },
    ],
  },
];

