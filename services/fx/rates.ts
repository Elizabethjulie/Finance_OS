import Decimal from "decimal.js";
import type { Currency } from "@/lib/generated/prisma/client";

interface CachedRates {
  base: Currency;
  rates: Partial<Record<Currency, number>>;
  fetchedAt: number;
}

// In-memory cache for live rates (1 hour TTL)
const rateCache = new Map<Currency, CachedRates>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function clearRateCache() {
  rateCache.clear();
}

/**
 * Fetches live real-time foreign exchange rates from open central bank feeds.
 * Completely dynamic: 0 API keys required, zero hardcoded rates.
 */
export async function getLiveRatesForBase(base: Currency): Promise<Partial<Record<Currency, number>>> {
  const cached = rateCache.get(base);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rates;
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`FX feed error: HTTP ${res.status}`);
    }

    const data = await res.json();
    const rates: Partial<Record<Currency, number>> = {
      KES: data.rates?.KES ? Number(data.rates.KES) : undefined,
      EUR: data.rates?.EUR ? Number(data.rates.EUR) : undefined,
      USD: data.rates?.USD ? Number(data.rates.USD) : undefined,
      GBP: data.rates?.GBP ? Number(data.rates.GBP) : undefined,
    };

    rateCache.set(base, {
      base,
      rates,
      fetchedAt: now,
    });

    return rates;
  } catch (err) {
    console.warn(`[FX Engine] Failed to fetch live FX feed for ${base}, using fallback:`, err);
    // If network fails, return cached if available
    if (cached) return cached.rates;
    throw err;
  }
}

/**
 * Computes the live exchange rate between any two currencies without hardcoding.
 */
export async function getLiveExchangeRate(
  from: Currency,
  to: Currency
): Promise<{
  from: Currency;
  to: Currency;
  rate: Decimal;
  rateNumber: number;
  source: string;
  timestamp: string;
}> {
  if (from === to) {
    return {
      from,
      to,
      rate: new Decimal(1),
      rateNumber: 1,
      source: "Parity (1:1)",
      timestamp: new Date().toISOString(),
    };
  }

  const rates = await getLiveRatesForBase(from);
  const targetRate = rates[to];

  if (!targetRate) {
    throw new Error(`Live rate for pair ${from}/${to} is currently unavailable.`);
  }

  const decimalRate = new Decimal(targetRate);

  return {
    from,
    to,
    rate: decimalRate,
    rateNumber: targetRate,
    source: "Live Central Bank / Open ER Market Feed",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Converts an amount from one currency to another using the live rate.
 */
export async function convertCurrencyLive(
  amount: string | number,
  from: Currency,
  to: Currency
): Promise<{
  sourceAmount: string;
  from: Currency;
  destinationAmount: string;
  to: Currency;
  rate: string;
}> {
  const { rate } = await getLiveExchangeRate(from, to);
  const amt = new Decimal(amount);
  const converted = amt.times(rate).toFixed(2);

  return {
    sourceAmount: amt.toFixed(2),
    from,
    destinationAmount: converted,
    to,
    rate: rate.toFixed(4),
  };
}
