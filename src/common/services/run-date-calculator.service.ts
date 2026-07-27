import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Configuration } from '../../config/configuration'
import {
  calcPreliminaryRunDate,
  lastDayOfLastMonth,
  parseCrsDays
} from '../utils/parser-job-date.util'
import { PrismaService } from '../../modules/prisma/prisma.service'

/** Maximum days to search forward when a run-date slot is at capacity */
const MAX_SEARCH_DAYS = 365

export type RunDateOtaType = 'expedia' | 'booking' | 'agoda'

/** Map from OTA type to its run_date DB field name */
const RUN_DATE_FIELD: Record<RunDateOtaType, string> = {
  expedia: 'expedia_run_date',
  booking: 'booking_run_date',
  agoda:   'agoda_run_date'
}

@Injectable()
export class RunDateCalculatorService {
  private readonly logger = new Logger(RunDateCalculatorService.name)
  private readonly capacity: {
    expedia: number
    booking: number
    agoda: number
    expediaDb: number
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Configuration, true>
  ) {
    this.capacity = this.config.get('runDateCapacity', { infer: true })
  }

  /**
   * Calculates the earliest available run-date slot for a given OTA.
   *
   * Starting from:
   *   preliminary = historicalTo + 1 day + crsDays + 15 days
   *
   * Walks forward one day at a time until the number of properties already
   * assigned that date is below the configured capacity for the OTA.
   *
   * Returns `null` when `crs` is absent or cannot be parsed as a positive integer.
   *
   * @param historicalTo  - OTA historical "to" date (YYYY-MM-DD)
   * @param crs           - Raw CRS string from the property record (days)
   * @param otaType       - Which OTA this run date is for
   * @param excludeId     - Optional property ID to exclude from the count (for updates)
   */
  async calcRunDate(
    historicalTo: string,
    crs: string | null | undefined,
    otaType: RunDateOtaType,
    excludeId?: string
  ): Promise<string | null> {
    const crsDays = parseCrsDays(crs)
    if (crsDays === null) return null

    const capacity =
      otaType === 'expedia'
        ? this.capacity.expedia
        : otaType === 'booking'
          ? this.capacity.booking
          : this.capacity.agoda

    const runDateField = RUN_DATE_FIELD[otaType]
    let candidate = calcPreliminaryRunDate(historicalTo, crsDays)

    for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
      const where: Record<string, unknown> = { [runDateField]: candidate }
      if (excludeId) where['id'] = { not: excludeId }

      const slotsUsed = await this.prisma.property.count({ where })
      if (slotsUsed < capacity) break

      const d = new Date(`${candidate}T00:00:00.000Z`)
      d.setUTCDate(d.getUTCDate() + 1)
      candidate = d.toISOString().slice(0, 10)
    }

    return candidate
  }

  /**
   * Calculates run dates for every OTA where the property has both a
   * historical "to" date and a valid CRS value.
   *
   * Priority rules (per OTA):
   *  - `REGULAR` + `_to` provided  → standard run-date formula
   *  - `HIGH`                       → uses the last day of last month as the
   *                                   effective historical "to" date; no `_to`
   *                                   value is required
   *  - `REGULAR` without `_to`      → run date is skipped (kept empty)
   *  - no priority provided         → existing behaviour: calculate whenever
   *                                   both `_to` and a valid `_crs` are present
   *
   * Returns a partial DB update payload — only fields that were successfully
   * calculated are included. Fields are omitted when CRS is missing/invalid.
   *
   * OTAs are processed sequentially so that each calculation reflects the
   * state after the previous update (important for batch imports).
   *
   * @param property  - Subset of property fields needed for the calculation
   * @param excludeId - Property ID to exclude from capacity counts (for updates)
   */
  async calcRunDatesForProperty(
    property: {
      expedia_to?: string | null
      expedia_crs?: string | null
      expedia_priority?: string | null
      booking_to?: string | null
      booking_crs?: string | null
      booking_priority?: string | null
      agoda_to?: string | null
      agoda_crs?: string | null
      agoda_priority?: string | null
    },
    excludeId?: string
  ): Promise<{
    expedia_run_date?: string
    booking_run_date?: string
    agoda_run_date?: string
  }> {
    const updates: {
      expedia_run_date?: string
      booking_run_date?: string
      agoda_run_date?: string
    } = {}

    const effectiveTo = (
      to: string | null | undefined,
      priority: string | null | undefined
    ): string | null => {
      if (priority === 'HIGH') return lastDayOfLastMonth()
      if (priority === 'REGULAR') return to ?? null
      // no priority → legacy behaviour: use to if present
      return to ?? null
    }

    const shouldCalc = (
      to: string | null | undefined,
      priority: string | null | undefined
    ): boolean => {
      if (priority === 'HIGH') return true
      if (priority === 'REGULAR') return !!to
      // no priority → legacy behaviour
      return !!to
    }

    // Expedia
    if (shouldCalc(property.expedia_to, property.expedia_priority)) {
      const historicalTo = effectiveTo(property.expedia_to, property.expedia_priority)!
      const d = await this.calcRunDate(historicalTo, property.expedia_crs, 'expedia', excludeId)
      if (d) {
        updates.expedia_run_date = d
        this.logger.debug(`expedia run_date → ${d} (priority: ${property.expedia_priority ?? 'none'})`)
      }
    }

    // Booking
    if (shouldCalc(property.booking_to, property.booking_priority)) {
      const historicalTo = effectiveTo(property.booking_to, property.booking_priority)!
      const d = await this.calcRunDate(historicalTo, property.booking_crs, 'booking', excludeId)
      if (d) {
        updates.booking_run_date = d
        this.logger.debug(`booking run_date → ${d} (priority: ${property.booking_priority ?? 'none'})`)
      }
    }

    // Agoda
    if (shouldCalc(property.agoda_to, property.agoda_priority)) {
      const historicalTo = effectiveTo(property.agoda_to, property.agoda_priority)!
      const d = await this.calcRunDate(historicalTo, property.agoda_crs, 'agoda', excludeId)
      if (d) {
        updates.agoda_run_date = d
        this.logger.debug(`agoda run_date → ${d} (priority: ${property.agoda_priority ?? 'none'})`)
      }
    }

    return updates
  }
}
