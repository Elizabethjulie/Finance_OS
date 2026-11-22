import { NextResponse } from "next/server";
import type { Currency } from "@/lib/generated/prisma/client";
import { getLiveExchangeRate, convertCurrencyLive } from "@/services/fx/rates";

const SUPPORTED_CURRENCIES: Currency[] = ["KES", "EUR", "USD", "GBP"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get("from")?.toUpperCase() ?? "EUR") as Currency;
  const to = (searchParams.get("to")?.toUpperCase() ?? "KES") as Currency;
  const amount = searchParams.get("amount");

  if (!SUPPORTED_CURRENCIES.includes(from) || !SUPPORTED_CURRENCIES.includes(to)) {
    return NextResponse.json(
      { error: `Invalid currency. Supported: ${SUPPORTED_CURRENCIES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    if (amount) {
      const conversion = await convertCurrencyLive(amount, from, to);
      return NextResponse.json(conversion, { status: 200 });
    }

    const fx = await getLiveExchangeRate(from, to);
    return NextResponse.json(
      {
        from: fx.from,
        to: fx.to,
        rate: fx.rate.toFixed(4),
        ratePrecise: fx.rateNumber,
        source: fx.source,
        timestamp: fx.timestamp,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to retrieve live rate" },
      { status: 502 }
    );
  }
}
