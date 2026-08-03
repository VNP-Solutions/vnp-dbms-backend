import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Configuration } from '../../config/configuration'
import {
  calcPreliminaryRunDate,
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
   * Calculates run dates for every OTA where calculation rules are met.
   *
   * Priority rules (per OTA):
   *  - `REGULAR` + `_to` + CRS → standard formula
   *      run_date = historical_to + 1 day + CRS + 15 days (capacity-adjusted)
   *  - `HIGH` + `_to`          → run_date = property creation date + 1 day
   *      (`_to` is required; CRS is not used for the HIGH run date)
   *  - `REGULAR` without `_to` → run date skipped
   *  - `HIGH` without `_to`    → run date skipped
   *  - no priority             → legacy: calculate when `_to` + valid CRS present
   *
   * Returns a partial DB update payload — only fields that were successfully
   * calculated are included.
   *
   * @param property  - Subset of property fields needed for the calculation
   * @param excludeId - Property ID to exclude from capacity counts (for updates)
   */
  async calcRunDatesForProperty(
    property: {
      created_at?: Date | string | null
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

    // HIGH and REGULAR both require *_to; legacy (no priority) also requires *_to
    const shouldCalc = (to: string | null | undefined): boolean => !!to

    const highRunDate = (): string | null => {
      const base = property.created_at
        ? new Date(property.created_at)
        : new Date()
      if (Number.isNaN(base.getTime())) return null
      const d = new Date(
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
      )
      d.setUTCDate(d.getUTCDate() + 1)
      return d.toISOString().slice(0, 10)
    }

    // Expedia
    if (shouldCalc(property.expedia_to)) {
      if (property.expedia_priority === 'HIGH') {
        const d = highRunDate()
        if (d) {
          updates.expedia_run_date = d
          this.logger.debug(
            `expedia run_date → ${d} (priority: HIGH, created_at+1)`
          )
        }
      } else {
        const d = await this.calcRunDate(
          property.expedia_to!,
          property.expedia_crs,
          'expedia',
          excludeId
        )
        if (d) {
          updates.expedia_run_date = d
          this.logger.debug(
            `expedia run_date → ${d} (priority: ${property.expedia_priority ?? 'none'})`
          )
        }
      }
    }

    // Booking
    if (shouldCalc(property.booking_to)) {
      if (property.booking_priority === 'HIGH') {
        const d = highRunDate()
        if (d) {
          updates.booking_run_date = d
          this.logger.debug(
            `booking run_date → ${d} (priority: HIGH, created_at+1)`
          )
        }
      } else {
        const d = await this.calcRunDate(
          property.booking_to!,
          property.booking_crs,
          'booking',
          excludeId
        )
        if (d) {
          updates.booking_run_date = d
          this.logger.debug(
            `booking run_date → ${d} (priority: ${property.booking_priority ?? 'none'})`
          )
        }
      }
    }

    // Agoda
    if (shouldCalc(property.agoda_to)) {
      if (property.agoda_priority === 'HIGH') {
        const d = highRunDate()
        if (d) {
          updates.agoda_run_date = d
          this.logger.debug(
            `agoda run_date → ${d} (priority: HIGH, created_at+1)`
          )
        }
      } else {
        const d = await this.calcRunDate(
          property.agoda_to!,
          property.agoda_crs,
          'agoda',
          excludeId
        )
        if (d) {
          updates.agoda_run_date = d
          this.logger.debug(
            `agoda run_date → ${d} (priority: ${property.agoda_priority ?? 'none'})`
          )
        }
      }
    }

    return updates
  }
}
