import Decimal from "decimal.js";

/**
 * Converts a string, number, or Decimal into a validated finite Decimal instance.
 * Note: Callers handling money should pass decimal strings or Decimal instances;
 * number is accepted only for defensive conversion and rejected if non-finite.
 */
export function toDecimal(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) {
    if (!value.isFinite()) {
      throw new Error("Invalid money amount: must be a finite number.");
    }
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Invalid money amount: must be a finite number.");
    }
    return new Decimal(value);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Invalid money amount: empty string.");
  }

  let decimal: Decimal;
  try {
    decimal = new Decimal(trimmed);
  } catch {
    throw new Error(`Invalid money amount: "${value}".`);
  }

  if (!decimal.isFinite()) {
    throw new Error("Invalid money amount: must be a finite number.");
  }

  return decimal;
}

/**
 * Formats a Decimal to a fixed 2-decimal-place string at presentation/return boundaries.
 */
export function formatAmount(d: Decimal): string {
  if (!d.isFinite()) {
    throw new Error("Cannot format a non-finite Decimal.");
  }
  return d.toFixed(2);
}

/**
 * Sums a sequence of money values using exact Decimal arithmetic.
 */
export function sum(values: ReadonlyArray<string | number | Decimal>): Decimal {
  let total = new Decimal(0);
  for (let i = 0; i < values.length; i++) {
    total = total.plus(toDecimal(values[i]));
  }
  return total;
}

/**
 * Returns the canonical display symbol for a given currency code.
 */
export function getCurrencySymbol(currency?: string | null): string {
  switch (currency?.toUpperCase()) {
    case "KES":
      return "KSh ";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "USD":
    default:
      return "$";
  }
}

/**
 * Formats a money value with its true currency symbol and thousand separators.
 * e.g., 25000 in KES -> "KSh 25,000.00", 300 in EUR -> "€300.00"
 */
export function formatMoneyWithCurrency(
  value: Decimal | string | number,
  currency?: string | null
): string {
  const dec = toDecimal(value);
  const [intPart, decPart = "00"] = dec.toFixed(2).split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = sign ? intPart.slice(1) : intPart;
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = getCurrencySymbol(currency);
  return `${sign}${symbol}${withCommas}.${decPart}`;
}

