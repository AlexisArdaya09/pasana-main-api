/**
 * Formats a Date (from PostgreSQL `date` or timestamp) as YYYY-MM-DD using UTC
 * calendar components. Avoids timezone shifts when the client parses ISO datetimes.
 */
export function formatDateOnly(value: Date | string | null | undefined): string | null {
  if (value == null) return null;

  const d =
    typeof value === 'string'
      ? new Date(value.length === 10 ? `${value}T12:00:00.000Z` : value)
      : value;

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
