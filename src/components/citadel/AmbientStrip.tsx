"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Moon,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudFog,
  CloudLightning,
  CloudSun,
  CloudDrizzle,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AmbientWeather, MarketRange, MarketResp } from "@/lib/ambient-types";
import { SYMBOL_OPTIONS } from "@/lib/ambient-types";

const RANGES: MarketRange[] = ["1D", "1W", "1M", "1Y", "IPO"];

// Map open-meteo WMO codes to lucide icons.
function weatherIcon(code: number | undefined, isDay: boolean | undefined): LucideIcon {
  if (code == null) return Cloud;
  if (code === 0) return isDay === false ? Moon : Sun;
  if (code === 1 || code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

const WMO: Record<number, string> = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Showers", 81: "Showers", 82: "Violent showers",
  85: "Snow showers", 86: "Snow showers",
  95: "Thunderstorm", 96: "Thunder & hail", 99: "Thunder & hail",
};

// Extract a city name from an IANA timezone identifier.
// "Asia/Dubai" → "Dubai", "America/Los_Angeles" → "Los Angeles".
// Some zones have 3 segments ("America/Argentina/Buenos_Aires") — we use the last.
function cityFromTimezone(tz: string): string {
  const parts = tz.split("/");
  const last = parts[parts.length - 1] ?? tz;
  return last.replace(/_/g, " ");
}

// Live clock — re-renders every 30s. Uses the browser's *real* timezone via
// Intl.DateTimeFormat, so the displayed time always matches the user's OS clock.
function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return { time: "—", tzAbbr: "", timezone: "" };
  // Default formatter uses the browser's local zone — correct for any user.
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
  let tzAbbr = "";
  let timezone = "";
  try {
    const opts = Intl.DateTimeFormat().resolvedOptions();
    timezone = opts.timeZone;
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
    }).formatToParts(now);
    tzAbbr = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {}
  return { time, tzAbbr, timezone };
}

// Resolve the user's location via the browser timezone, then call
// open-meteo's CORS-friendly geocoding + weather endpoints client-side.
// This sidesteps the unreliable IP-geolocation path entirely.
function useLocalWeather(timezone: string | undefined) {
  const [data, setData] = useState<{
    city?: string;
    country?: string;
    weather?: AmbientWeather;
  } | null>(null);
  const lastTz = useRef<string | null>(null);

  useEffect(() => {
    if (!timezone || lastTz.current === timezone) return;
    lastTz.current = timezone;
    const guessedCity = cityFromTimezone(timezone);
    let cancelled = false;

    (async () => {
      try {
        // Geocode the city — open-meteo's free geocoding API. Picks the
        // largest-population match by default which usually matches the
        // IANA timezone city (Asia/Dubai → Dubai, UAE).
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          guessedCity
        )}&count=1&language=en&format=json`;
        const geoRes = await fetch(geoUrl);
        if (!geoRes.ok) throw new Error(`geo ${geoRes.status}`);
        const geo = (await geoRes.json()) as {
          results?: Array<{
            name?: string;
            country?: string;
            latitude?: number;
            longitude?: number;
          }>;
        };
        const hit = geo.results?.[0];
        if (!hit?.latitude || !hit.longitude) throw new Error("no_geo");

        const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weather_code,is_day&temperature_unit=celsius&timezone=auto`;
        const wxRes = await fetch(wxUrl);
        if (!wxRes.ok) throw new Error(`wx ${wxRes.status}`);
        const wx = (await wxRes.json()) as {
          current?: {
            temperature_2m?: number;
            weather_code?: number;
            is_day?: number;
          };
        };
        const c = wx.current?.temperature_2m;
        const code = wx.current?.weather_code;
        if (cancelled) return;
        setData({
          city: hit.name ?? guessedCity,
          country: hit.country,
          weather: {
            tempC: typeof c === "number" ? Math.round(c) : undefined,
            tempF: typeof c === "number" ? Math.round((c * 9) / 5 + 32) : undefined,
            code,
            label: code != null ? WMO[code] ?? "—" : undefined,
            isDay: wx.current?.is_day === 1,
          },
        });
      } catch {
        if (!cancelled) setData({ city: guessedCity });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [timezone]);

  return data;
}

const SYMBOL_LS_KEY = "citadel-market-symbol";
const RANGE_LS_KEY = "citadel-market-range";

function loadSymbol(): string {
  if (typeof window === "undefined") return "SPX";
  try {
    const v = window.localStorage.getItem(SYMBOL_LS_KEY);
    if (v && SYMBOL_OPTIONS.some((s) => s.key === v)) return v;
  } catch {}
  return "SPX";
}

function loadRange(): MarketRange {
  if (typeof window === "undefined") return "1D";
  try {
    const v = window.localStorage.getItem(RANGE_LS_KEY);
    if (v && (RANGES as string[]).includes(v)) return v as MarketRange;
  } catch {}
  return "1D";
}

// Tiny SVG sparkline. No chart-lib dep — keeps the bundle slim.
function Sparkline({
  points,
  width,
  height,
  up,
}: {
  points: Array<{ t: number; c: number }>;
  width: number;
  height: number;
  up: boolean;
}) {
  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[10px] text-muted-soft"
        style={{ width, height }}
      >
        No data
      </div>
    );
  }
  const xs = points.map((p) => p.t);
  const ys = points.map((p) => p.c);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const fx = (x: number) => pad + ((x - xMin) / xRange) * w;
  const fy = (y: number) => pad + h - ((y - yMin) / yRange) * h;
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${fx(p.t).toFixed(2)} ${fy(p.c).toFixed(2)}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${fx(points[points.length - 1].t).toFixed(2)} ${pad + h} ` +
    `L ${fx(points[0].t).toFixed(2)} ${pad + h} Z`;
  const stroke = up ? "rgb(110 231 183)" : "rgb(252 165 165)";
  const fillId = `spark-fill-${up ? "u" : "d"}`;
  return (
    <svg width={width} height={height} className="block">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${fillId})`} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function AmbientStrip() {
  const [symbol, setSymbol] = useState<string>("SPX");
  const [range, setRange] = useState<MarketRange>("1D");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Read persisted prefs once on mount (avoid SSR hydration mismatch).
  useEffect(() => {
    setSymbol(loadSymbol());
    setRange(loadRange());
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(SYMBOL_LS_KEY, symbol);
    } catch {}
  }, [symbol]);
  useEffect(() => {
    try {
      window.localStorage.setItem(RANGE_LS_KEY, range);
    } catch {}
  }, [range]);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const { data: marketData } = useSWR<MarketResp>(
    `/api/ambient?symbol=${symbol}&range=${range}`,
    { refreshInterval: 60_000 }
  );

  const { time, tzAbbr, timezone } = useClock();
  const local = useLocalWeather(timezone);

  const WeatherIcon = weatherIcon(local?.weather?.code, local?.weather?.isDay);
  const tempC = local?.weather?.tempC;
  const city = local?.city;

  const market = marketData?.market;
  const up = (market?.change ?? 0) > 0;
  const flat = market?.change == null || Math.abs(market.change) < 0.001;
  const down = (market?.change ?? 0) < 0;
  const MarketIcon = up ? TrendingUp : down ? TrendingDown : Minus;
  const marketColor = up
    ? "text-emerald-300"
    : down
    ? "text-rose-300"
    : "text-muted";

  const currentSymOpt = useMemo(
    () => SYMBOL_OPTIONS.find((o) => o.key === symbol) ?? SYMBOL_OPTIONS[0],
    [symbol]
  );

  return (
    <div className="hidden items-center gap-2 lg:flex">
      <Pill title={local?.weather?.label ?? "Weather"}>
        <WeatherIcon className="h-3.5 w-3.5 text-sky-200" strokeWidth={1.7} />
        <span className="text-white">{tempC != null ? `${tempC}°` : "—"}</span>
        {city && <span className="text-muted-soft">·</span>}
        {city && (
          <span className="max-w-[110px] truncate text-muted">{city}</span>
        )}
      </Pill>

      <Pill title={timezone}>
        <span className="text-white">{time}</span>
        {tzAbbr && <span className="text-muted-soft">{tzAbbr}</span>}
      </Pill>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          title={
            market
              ? `${market.name} — ${market.marketState ?? ""} — prev close ${
                  market.previousClose?.toFixed(2) ?? "—"
                }`
              : currentSymOpt.name
          }
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] tracking-tight transition-colors",
            menuOpen
              ? "border-accent/30 bg-accent/[0.06]"
              : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.12]"
          )}
        >
          <MarketIcon
            className={cn("h-3.5 w-3.5", marketColor)}
            strokeWidth={1.7}
          />
          <span className="text-muted-soft">{currentSymOpt.label}</span>
          <span className="text-white tabular-nums">
            {market?.price != null
              ? market.price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "—"}
          </span>
          {market?.changePct != null && !flat && (
            <span className={cn("tabular-nums", marketColor)}>
              {up ? "+" : ""}
              {market.changePct.toFixed(2)}%
            </span>
          )}
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              className="absolute right-0 top-[calc(100%+6px)] z-50 w-[400px] overflow-hidden rounded-xl border border-white/[0.08] bg-ink-100/95 shadow-panel backdrop-blur-md"
            >
              <MarketPanel
                symbol={symbol}
                range={range}
                onSymbol={setSymbol}
                onRange={setRange}
                marketData={marketData}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Pill({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div
      title={title}
      className="flex items-center gap-1.5 rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1 text-[11px] tracking-tight"
    >
      {children}
    </div>
  );
}

function MarketPanel({
  symbol,
  range,
  onSymbol,
  onRange,
  marketData,
}: {
  symbol: string;
  range: MarketRange;
  onSymbol: (s: string) => void;
  onRange: (r: MarketRange) => void;
  marketData: MarketResp | undefined;
}) {
  const market = marketData?.market;
  const series = marketData?.series;
  // % change over the selected range (not just today). Falls back to the
  // headline daily change when no series is available.
  const rangeStart = series?.rangeStart;
  const last = series?.points[series.points.length - 1]?.c;
  const rangeChange =
    rangeStart != null && last != null ? last - rangeStart : market?.change;
  const rangeChangePct =
    rangeStart != null && last != null && rangeStart !== 0
      ? ((last - rangeStart) / rangeStart) * 100
      : market?.changePct;
  const up = (rangeChange ?? 0) >= 0;
  const color = up ? "text-emerald-300" : "text-rose-300";

  return (
    <div>
      {/* Symbol pills */}
      <div className="flex gap-1 border-b border-white/[0.05] p-2">
        {SYMBOL_OPTIONS.map((opt) => {
          const active = opt.key === symbol;
          return (
            <button
              key={opt.key}
              onClick={() => onSymbol(opt.key)}
              title={opt.name}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-[11px] tracking-tight transition-colors",
                active
                  ? "bg-accent/[0.10] text-white shadow-glow-sm"
                  : "text-muted hover:bg-white/[0.03] hover:text-white"
              )}
            >
              {opt.label}
              {active && (
                <Check className="ml-1 inline h-3 w-3 text-accent" strokeWidth={2.4} />
              )}
            </button>
          );
        })}
      </div>

      {/* Headline + change */}
      <div className="flex items-end justify-between gap-3 px-3 pt-3">
        <div className="min-w-0">
          <div className="mono-tag">{market?.name ?? "—"}</div>
          <div className="mt-0.5 truncate text-[18px] font-medium tracking-tight text-white tabular-nums">
            {market?.price != null
              ? market.price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "—"}
            <span className="ml-1 text-[10px] uppercase text-muted-soft">
              {market?.currency ?? ""}
            </span>
          </div>
        </div>
        <div className={cn("text-right", color)}>
          <div className="text-[13px] tabular-nums">
            {rangeChange != null
              ? `${up ? "+" : ""}${rangeChange.toFixed(2)}`
              : "—"}
          </div>
          <div className="text-[11px] tabular-nums">
            {rangeChangePct != null
              ? `${up ? "+" : ""}${rangeChangePct.toFixed(2)}%`
              : ""}
            <span className="ml-1 text-muted-soft">· {range}</span>
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="px-3 pt-2">
        {series ? (
          <Sparkline
            points={series.points}
            width={368}
            height={92}
            up={up}
          />
        ) : (
          <div className="flex h-[92px] items-center justify-center text-[11px] text-muted">
            {marketData ? "no data" : "loading…"}
          </div>
        )}
      </div>

      {/* Range pills */}
      <div className="flex gap-1 px-2 pb-2 pt-1">
        {RANGES.map((r) => {
          const active = r === range;
          return (
            <button
              key={r}
              onClick={() => onRange(r)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-[10.5px] tracking-wider transition-colors",
                active
                  ? "bg-accent/[0.10] text-white"
                  : "text-muted hover:bg-white/[0.03] hover:text-white"
              )}
            >
              {r}
            </button>
          );
        })}
      </div>

      {/* Stats footer */}
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] px-3 py-2 text-[10.5px] tabular-nums text-muted">
        <span>
          High <span className="text-white">{series?.high?.toFixed(2) ?? "—"}</span>
        </span>
        <span>
          Low <span className="text-white">{series?.low?.toFixed(2) ?? "—"}</span>
        </span>
        <span>
          Prev close{" "}
          <span className="text-white">
            {market?.previousClose?.toFixed(2) ?? "—"}
          </span>
        </span>
        <span className="text-muted-soft">
          {market?.marketState ?? ""}
        </span>
      </div>
    </div>
  );
}
