// Client-safe types for the ambient widget.

export type AmbientLocation = {
  city?: string;
  country?: string;
  timezone?: string;
  lat?: number;
  lon?: number;
};

export type AmbientWeather = {
  tempC?: number;
  tempF?: number;
  code?: number;
  label?: string;
  isDay?: boolean;
};

export type AmbientMarket = {
  symbol: string;
  name: string;
  price?: number;
  open?: number;
  previousClose?: number;
  change?: number;
  changePct?: number;
  marketState?: string;
  currency?: string;
  updatedAt?: number;
};

export type MarketRange = "1D" | "1W" | "1M" | "1Y" | "IPO";

export type MarketSeries = {
  range: MarketRange;
  // Plot points — { t: epoch ms, c: close price }. Already cleaned of nulls.
  points: Array<{ t: number; c: number }>;
  high?: number;
  low?: number;
  rangeStart?: number; // price at the first point (for % change over the window)
};

export type MarketResp = {
  market: AmbientMarket;
  series?: MarketSeries;
  error?: string;
};

export const SYMBOL_OPTIONS: Array<{ key: string; label: string; name: string }> = [
  { key: "SPX", label: "SPX", name: "S&P 500" },
  { key: "VOO", label: "VOO", name: "Vanguard S&P 500" },
  { key: "QQQM", label: "QQQM", name: "Nasdaq 100 ETF" },
  { key: "SOXX", label: "SOXX", name: "Semiconductor ETF" },
  { key: "NVDA", label: "NVDA", name: "NVIDIA" },
];
