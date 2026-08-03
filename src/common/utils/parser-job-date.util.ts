/**
 * Utility functions for calculating parser job date ranges from
 * a property's historical "to" date and its CRS (days) value.
 *
 * Expedia / Booking rules:
 *   start_date = historical_to + 1 day
 *   end_date   = start_date + crs_days
 *   end_date (booking) = start_date + crs_days + 365 days (1 extra year)
 *
 * Agoda rules:
 *   start_date = historical_to - crs_days + 1 day
 *   end_date   = historical_to + crs_days + 1 day
 */

/**
 * Returns the job start date as `historicalTo` + 1 calendar day.
 *
 * @param historicalTo - Historical "to" date in YYYY-MM-DD format
 * @returns YYYY-MM-DD string for the computed start date
 */
export function calcParserJobStartDate(historicalTo: string): string {
  const d = new Date(`${historicalTo}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Returns the job end date as `startDate` + `crsDays` days, with an optional
 * extra year (365 days) added on top (used for booking jobs).
 *
 * @param startDate    - YYYY-MM-DD start date (output of {@link calcParserJobStartDate})
 * @param crsDays      - CRS value in whole days to advance from the start date
 * @param addExtraYear - When `true` (booking jobs), adds an additional 365 days
 * @returns YYYY-MM-DD string for the computed end date
 */
export function calcParserJobEndDate(
  startDate: string,
  crsDays: number,
  addExtraYear = false
): string {
  const d = new Date(`${startDate}T00:00:00.000Z`)
  const totalDays = crsDays + (addExtraYear ? 365 : 0)
  d.setUTCDate(d.getUTCDate() + totalDays)
  return d.toISOString().slice(0, 10)
}

/**
 * Parses a raw CRS string value into an integer number of days.
 * Returns `null` when the string is absent or cannot be parsed as a positive integer.
 *
 * @param crs - Raw CRS field value from the property record (e.g. "30", "90", "180")
 */
export function parseCrsDays(crs: string | null | undefined): number | null {
  if (!crs) return null
  const parsed = parseInt(crs.trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Returns the Agoda job start date as `historicalTo` - crsDays + 1 calendar day.
 *
 * @param historicalTo - Historical "to" date in YYYY-MM-DD format
 * @param crsDays      - CRS value in whole days
 * @returns YYYY-MM-DD string for the computed Agoda start date
 */
export function calcAgodaParserJobStartDate(
  historicalTo: string,
  crsDays: number
): string {
  const d = new Date(`${historicalTo}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - crsDays + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Returns the Agoda job end date as `historicalTo` + crsDays + 1 calendar day.
 *
 * @param historicalTo - Historical "to" date in YYYY-MM-DD format
 * @param crsDays      - CRS value in whole days
 * @returns YYYY-MM-DD string for the computed Agoda end date
 */
export function calcAgodaParserJobEndDate(
  historicalTo: string,
  crsDays: number
): string {
  const d = new Date(`${historicalTo}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + crsDays + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Returns the last calendar day of the previous month in YYYY-MM-DD format
 * (UTC).
 *
 * Example: if today is 2026-07-26, returns "2026-06-30".
 */
export function lastDayOfLastMonth(): string {
  const now = new Date()
  // Day 0 of the current month = last day of the previous month
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  return d.toISOString().slice(0, 10)
}

/**
 * Calculates the preliminary run date as:
 *   preliminary_run_date = end_date + 1 day + crs_days + 15 days
 *
 * This date is sent to the scraper backend which then validates capacity and
 * returns the actual (possibly later) suitable run date.
 *
 * @param endDate  - YYYY-MM-DD job end date
 * @param crsDays  - CRS value in whole days
 * @returns YYYY-MM-DD string for the preliminary run date
 */
export function calcPreliminaryRunDate(
  endDate: string,
  crsDays: number
): string {
  const d = new Date(`${endDate}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1 + crsDays + 15)  // +1 day + CRS days + 15 days
  return d.toISOString().slice(0, 10)
}

/** Normalizes parser/DBMS date payloads to YYYY-MM-DD for validation and storage. */
export function normalizeParserJobDate(
  value: unknown
): string | undefined {
  if (value == null || value === '') return undefined
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromNumber = new Date(value)
    if (!Number.isNaN(fromNumber.getTime())) {
      return fromNumber.toISOString().slice(0, 10)
    }
  }

  const str = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  const slashDate = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (slashDate) {
    const first = Number(slashDate[1])
    const second = Number(slashDate[2])
    const year = Number(slashDate[3])

    let month: number
    let day: number

    if (first > 12) {
      // e.g. 31/01/2024 — day > 12, so first segment must be the day
      day = first
      month = second
    } else {
      // MM/DD/YYYY — e.g. 01/15/2024
      month = first
      day = second
    }

    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    ) {
      return parsed.toISOString().slice(0, 10)
    }
    return undefined
  }

  if (str.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parsed = new Date(str)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }

  return undefined
}
