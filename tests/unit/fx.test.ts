import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLiveExchangeRate, convertCurrencyLive, clearRateCache } from "@/services/fx/rates";

describe("Live FX Engine (services/fx/rates.ts)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearRateCache();
  });

  it("returns 1:1 rate when source and destination currencies are identical", async () => {
    const res = await getLiveExchangeRate("KES", "KES");
    expect(res.rateNumber).toBe(1);
    expect(res.source).toContain("Parity");
  });

  it("retrieves live exchange rate dynamically without hardcoding", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rates: {
          KES: 142.5,
          USD: 1.08,
          GBP: 0.85,
        },
      }),
    } as unknown as Response);

    const res = await getLiveExchangeRate("EUR", "KES");
    expect(res.from).toBe("EUR");
    expect(res.to).toBe("KES");
    expect(res.rate.toFixed(1)).toBe("142.5");
    expect(res.source).toContain("Live Central Bank / Open ER Market Feed");
  });

  it("converts currency accurately using live rates", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rates: {
          KES: 140.0,
        },
      }),
    } as unknown as Response);

    const result = await convertCurrencyLive("50.00", "EUR", "KES");
    expect(result.sourceAmount).toBe("50.00");
    expect(result.destinationAmount).toBe("7000.00");
    expect(result.rate).toBe("140.0000");
  });
});
