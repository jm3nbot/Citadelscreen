import { NextResponse } from "next/server";
import type {
  AmbientMarket,
  MarketRange,
  MarketSeries,
} from "@/lib/ambient-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 60;

const SYMBOL_MAP: Record<string, { yahoo: string; name: string; label: string }> = {
  SPX: { yahoo: "%5EGSPC", name: "S&P 500", label: "SPX" },
  VOO: { yahoo: "VOO", name: "Vanguard S&P 500 ETF", label: "VOO" },
  QQQM: { yahoo: "QQQM", name: "Invesco Nasdaq 100 ETF", label: "QQQM" },
  SOXX: { yahoo: "SOXX", name: "iShares Semiconductor ETF", label: "SOXX" },
  NVDA: { yahoo: "NVDA", name: "NVIDIA", label: "NVDA" },
};

// (range, interval) tuples — keep intraday density manageable.
const RANGE_PARAMS: Record<MarketRange, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "1W": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  IPO: { range: "max", interval: "1mo" },
};

type YahooResult = {
  meta?: {
    regularMarketPrice?: number;
    previousClose?: number;
    chartPreviousClose?: number;
    regularMarketTime?: number;
    marketState?: string;
    currency?: string;
  };
  timestamp?: number[];
  indicators?: { quote?: Array<{ open?: number[]; close?: number[] }> };
};

async function fetchYahooChart(
  yahooSym: string,
  range: string,
  interval: string
): Promise<YahooResult> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    next: { revalidate: 60 },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; CitadelAmbient/1.0; +https://citadel.local)",
    },
  });
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  const j = (await res.json()) as {
    chart?: { result?: YahooResult[]; error?: { description?: string } };
  };
  const r = j.chart?.result?.[0];
  if (!r?.meta) throw new Error(j.chart?.error?.description ?? "no_data");
  return r;
}

function buildMarketFromQuote(
  meta: NonNullable<YahooResult["meta"]>,
  opens: number[],
  label: string,
  name: string
): AmbientMarket {
  const price = meta.regularMarketPrice;
  const prev = meta.previousClose ?? meta.chartPreviousClose;
  let open: number | undefined;
  for (let i = opens.length - 1; i >= 0; i--) {
    if (typeof opens[i] === "number") {
      open = opens[i];
      break;
    }
  }
  const change = price != null && prev != null ? price - prev : undefined;
  const changePct =
    price != null && prev != null && prev !== 0 ? (change! / prev) * 100 : undefined;
  return {
    symbol: label,
    name,
    price,
    open,
    previousClose: prev,
    change,
    changePct,
    marketState: meta.marketState,
    currency: meta.currency,
    updatedAt: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
  };
}

function buildSeries(r: YahooResult, range: MarketRange): MarketSeries {
  const ts = r.timestamp ?? [];
  const closes = r.indicators?.quote?.[0]?.close ?? [];
  const points: Array<{ t: number; c: number }> = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c === "number") points.push({ t: ts[i] * 1000, c });
  }
  // Sparkline gets jagged with thousands of points — downsample 1Y/IPO if huge.
  const target = range === "IPO" || range === "1Y" ? 220 : points.length;
  let downsampled = points;
  if (points.length > target * 1.5) {
    const stride = Math.ceil(points.length / target);
    downsampled = points.filter((_, i) => i % stride === 0 || i === points.length - 1);
  }
  const cs = downsampled.map((p) => p.c);
  return {
    range,
    points: downsampled,
    high: cs.length ? Math.max(...cs) : undefined,
    low: cs.length ? Math.min(...cs) : undefined,
    rangeStart: downsampled[0]?.c,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sym = (url.searchParams.get("symbol") ?? "SPX").toUpperCase();
  const rangeParam = (url.searchParams.get("range") ?? "1D").toUpperCase() as MarketRange;
  const key = SYMBOL_MAP[sym] ? sym : "SPX";
  const range = RANGE_PARAMS[rangeParam] ? rangeParam : "1D";
  const symMeta = SYMBOL_MAP[key];
  const r = RANGE_PARAMS[range];

  try {
    // For the headline quote we always use 5-day daily data (gives us a fresh
    // regularMarketPrice + previousClose regardless of which range is selected).
    // The selected range only changes the chart series.
    const [quoteRaw, seriesRaw] = await Promise.all([
      fetchYahooChart(symMeta.yahoo, "5d", "1d"),
      fetchYahooChart(symMeta.yahoo, r.range, r.interval),
    ]);
    const market = buildMarketFromQuote(
      quoteRaw.meta!,
      quoteRaw.indicators?.quote?.[0]?.open ?? [],
      symMeta.label,
      symMeta.name
    );
    const series = buildSeries(seriesRaw, range);
    return NextResponse.json(
      { market, series },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(
      { market: { symbol: key, name: symMeta.name }, error: msg },
      { status: 502 }
    );
  }
}
