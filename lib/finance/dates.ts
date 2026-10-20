/**
 * Computes the instant in UTC corresponding to 00:00:00.000 on (year, month, day=1)
 * in the specified IANA timeZone without relying on the server's local timezone.
 */
function startOfMonthInTimeZone(year: number, month: number, timeZone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const targetUtcWall = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  let candidate = targetUtcWall;

  // Two passes handle any DST boundary cleanly
  for (let i = 0; i < 2; i++) {
    const parts = formatter.formatToParts(new Date(candidate));
    const map: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== "literal") {
        map[part.type] = Number(part.value);
      }
    }
    const wallAtCandidate = Date.UTC(
      map.year,
      map.month - 1,
      map.day,
      map.hour === 24 ? 0 : map.hour,
      map.minute,
      map.second,
      0
    );
    const diff = wallAtCandidate - targetUtcWall;
    candidate -= diff;
  }

  return new Date(candidate);
}

/**
 * Returns the half-open UTC range `[start, end)` for a calendar month (1-indexed, 1..12)
 * in the given IANA timeZone.
 *
 * TODO: Replace the hard-coded `"Africa/Nairobi"` default with `User.timezone` once
 * per-user timezones are added to the schema.
 */
export function getMonthRange(
  year: number,
  month: number,
  timeZone = "Africa/Nairobi"
): { start: Date; end: Date } {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid year or month (month must be 1..12).");
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    start: startOfMonthInTimeZone(year, month, timeZone),
    end: startOfMonthInTimeZone(nextYear, nextMonth, timeZone),
  };
}

