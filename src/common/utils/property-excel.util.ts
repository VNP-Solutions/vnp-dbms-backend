import * as XLSX from 'xlsx-js-style'
import { normalizeParserJobDate } from './parser-job-date.util'

/** Preferred Excel headers with legacy aliases for import/bulk-update. */
export const EXCEL_HISTORICAL_DATE_HEADERS = {
  expediaFrom: ['Expedia Historical From', 'Expedia From'],
  expediaTo: ['Expedia Historical To', 'Expedia To'],
  expediaDbFrom: [
    'DB Historical From',
    'Expedia Historical DB From',
    'From DB'
  ],
  expediaDbTo: ['DB Historical To', 'Expedia Historical DB To', 'To DB'],
  bookingFrom: ['Booking Historical From', 'Booking From'],
  bookingTo: ['Booking Historical To', 'Booking To'],
  agodaFrom: ['Agoda Historical From', 'Agoda From'],
  agodaTo: ['Agoda Historical To', 'Agoda To']
} as const

export function findExcelCellValue(
  row: Record<string, unknown>,
  names: readonly string[]
): string | undefined {
  for (const name of names) {
    const val = row[name]
    if (val !== undefined && val !== null && val !== '') {
      const trimmed = String(val).trim()
      if (trimmed !== '') return trimmed
    }
  }
  const rowKeys = Object.keys(row)
  for (const name of names) {
    for (const key of rowKeys) {
      const cleanKey = key.replace(/\s*\*+\s*$/, '').trim()
      if (cleanKey.toLowerCase() === name.toLowerCase()) {
        const val = row[key]
        if (val !== undefined && val !== null && val !== '') {
          const trimmed = String(val).trim()
          if (trimmed !== '') return trimmed
        }
      }
    }
  }
  return undefined
}

/** Normalizes Excel date cells (MM/DD/YYYY, YYYY-MM-DD, serial numbers) to YYYY-MM-DD. */
export function normalizeExcelDate(value: unknown): string | undefined {
  return normalizeParserJobDate(value)
}

export function findExcelDateValue(
  row: Record<string, unknown>,
  names: readonly string[]
): string | undefined {
  for (const name of names) {
    const val = row[name]
    if (val !== undefined && val !== null && val !== '') {
      const normalized = normalizeParserJobDate(val)
      if (normalized) return normalized
    }
  }
  const rowKeys = Object.keys(row)
  for (const name of names) {
    for (const key of rowKeys) {
      const cleanKey = key.replace(/\s*\*+\s*$/, '').trim()
      if (cleanKey.toLowerCase() === name.toLowerCase()) {
        const val = row[key]
        if (val !== undefined && val !== null && val !== '') {
          const normalized = normalizeParserJobDate(val)
          if (normalized) return normalized
        }
      }
    }
  }
  return undefined
}

export type PropertyExportColumnCode =
  | 'portfolio_id'
  | 'subportfolio_id'
  | 'service_type'
  | 'name'
  | 'property_identifier'
  | 'ota_access_levels'
  | 'ota_credentials_verified'
  | 'expedia_id'
  | 'expedia_priority'
  | 'expedia_billing_type'
  | 'expedia_service_type'
  | 'expedia_service_fee'
  | 'expedia_frequency'
  | 'expedia_historical_review'
  | 'expedia_historical_review_db'
  | 'expedia_crs'
  | 'expedia_crs_db'
  | 'expedia_run_date'
  | 'expedia_run_date_db'
  | 'expedia_processor'
  | 'expedia_otp_number'
  | 'userNameExpedia'
  | 'passwordExpedia'
  | 'expedia_secondary_username'
  | 'expedia_secondary_password'
  | 'need_another_domain'
  | 'booking_id'
  | 'booking_priority'
  | 'booking_service_type'
  | 'booking_service_fee'
  | 'booking_frequency'
  | 'booking_historical_review'
  | 'booking_crs'
  | 'booking_run_date'
  | 'booking_processor'
  | 'userNameBooking'
  | 'passwordBooking'
  | 'booking_otp_phone'
  | 'agoda_id'
  | 'agoda_priority'
  | 'agoda_service_type'
  | 'agoda_service_fee'
  | 'agoda_frequency'
  | 'agoda_historical_review'
  | 'agoda_crs'
  | 'agoda_run_date'
  | 'agoda_processor'
  | 'userNameAgoda'
  | 'passwordAgoda'
  | 'agoda_otp_number'
  | 'hotel_address'
  | 'portfolio_contact_email'
  | 'reporting_contact'
  | 'primary_case_email'
  | 'access_contact'
  | 'discontinued_email_ids'
  | 'card_descriptor'
  | 'qp_username'
  | 'qp_password'
  | 'fp_username'
  | 'fp_password'
  | 'sales_rep'
  | 'cybersource_mid'
  | 'adyen_location'
  | 'stripe_connected_email'
  | 'currency'

type PropertyExportColumnDef = {
  code: PropertyExportColumnCode
  header: string
  /** Header background color group (null = no fill). */
  group: 'general' | 'expedia' | 'booking' | 'agoda' | 'contact'
  getValue: (property: any) => string | number
}

const HEADER_GROUP_COLORS: Record<
  PropertyExportColumnDef['group'],
  string | null
> = {
  general: null,
  expedia: 'FFFF00',
  booking: 'C1E4F5',
  agoda: 'FAE2D5',
  contact: 'C1F0C8'
}

const HEADER_CELL_STYLE = {
  font: { bold: true, sz: 13, name: 'Arial' },
  alignment: { vertical: 'center', wrapText: true }
}

const DATA_CELL_STYLE = {
  font: { sz: 13, name: 'Arial' },
  alignment: { vertical: 'center', wrapText: true }
}

function formatYesNo(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === 'true' || value === 1 || value === '1') return 'Yes'
  if (value === 'false' || value === 0 || value === '0') return 'No'
  return String(value)
}

function formatCell(value: unknown): string | number {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return value as string | number
}

/** Formats a stored date (YYYY-MM-DD / Date / ISO) as MM/DD/YYYY. */
function formatExportDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const normalized = normalizeParserJobDate(value)
  if (!normalized) return String(value)
  const [year, month, day] = normalized.split('-')
  if (!year || !month || !day) return String(value)
  return `${month}/${day}/${year}`
}

function formatDateRange(from: unknown, to: unknown): string {
  const fromStr = formatExportDate(from)
  const toStr = formatExportDate(to)
  if (!fromStr && !toStr) return ''
  if (fromStr && toStr) return `${fromStr} - ${toStr}`
  return fromStr || toStr
}

function formatYesNoTriple(a: unknown, b: unknown, c: unknown): string {
  return [formatYesNo(a), formatYesNo(b), formatYesNo(c)].join(' / ')
}

function cred(property: any) {
  return property.credentials?.[0] || {}
}

/** Canonical export columns — order is the default “all columns” order. */
export const PROPERTY_EXPORT_COLUMNS: readonly PropertyExportColumnDef[] = [
  {
    code: 'portfolio_id',
    header: 'Portfolio',
    group: 'general',
    getValue: p => p.portfolio?.name ?? ''
  },
  {
    code: 'subportfolio_id',
    header: 'Sub-Portfolio',
    group: 'general',
    getValue: p => p.subportfolio?.name ?? ''
  },
  {
    code: 'service_type',
    header: 'Service Type',
    group: 'general',
    getValue: p => p.service_type?.type ?? ''
  },
  {
    code: 'name',
    header: 'Property Name',
    group: 'general',
    getValue: p => p.name ?? ''
  },
  {
    code: 'property_identifier',
    header: 'Property Identifier',
    group: 'general',
    getValue: p => p.property_identifier ?? ''
  },
  {
    code: 'ota_access_levels',
    header: 'Access Levels',
    group: 'general',
    getValue: p =>
      formatYesNoTriple(
        p.expedia_access_level,
        p.booking_access_level,
        p.agoda_access_level
      )
  },
  {
    code: 'ota_credentials_verified',
    header: 'Credentials Verified',
    group: 'general',
    getValue: p =>
      formatYesNoTriple(
        p.expedia_credential_verified,
        p.booking_credential_verified,
        p.agoda_credential_verified
      )
  },
  {
    code: 'expedia_id',
    header: 'Expedia ID',
    group: 'expedia',
    getValue: p => formatCell(p.expedia_id)
  },
  {
    code: 'expedia_priority',
    header: 'Expedia Priority',
    group: 'expedia',
    getValue: p => p.expedia_priority ?? ''
  },
  {
    code: 'expedia_billing_type',
    header: 'Expedia Billing Type',
    group: 'expedia',
    getValue: p => p.expedia_billing_type?.name ?? ''
  },
  {
    code: 'expedia_service_type',
    header: 'Expedia Service Type',
    group: 'expedia',
    getValue: p => p.expedia_service_type?.type ?? ''
  },
  {
    code: 'expedia_service_fee',
    header: 'Expedia Service Fee',
    group: 'expedia',
    getValue: p => formatCell(p.expedia_service_fee)
  },
  {
    code: 'expedia_frequency',
    header: 'Expedia Frequency',
    group: 'expedia',
    getValue: p => p.expedia_frequency?.name ?? ''
  },
  {
    code: 'expedia_historical_review',
    header: 'Expedia Historical Review',
    group: 'expedia',
    getValue: p => formatDateRange(p.expedia_from, p.expedia_to)
  },
  {
    code: 'expedia_historical_review_db',
    header: 'Expedia Historical Review DB',
    group: 'expedia',
    getValue: p => formatDateRange(p.from_db, p.to_db)
  },
  {
    code: 'expedia_crs',
    header: 'Expedia CRS',
    group: 'expedia',
    getValue: p => p.expedia_crs ?? ''
  },
  {
    code: 'expedia_crs_db',
    header: 'Expedia CRS DB',
    group: 'expedia',
    getValue: p => p.expedia_crs_db ?? ''
  },
  {
    code: 'expedia_run_date',
    header: 'Expedia Run Date',
    group: 'expedia',
    getValue: p => formatExportDate(p.expedia_run_date)
  },
  {
    code: 'expedia_run_date_db',
    header: 'Expedia Run Date DB',
    group: 'expedia',
    getValue: p => formatExportDate(p.expedia_run_date_db)
  },
  {
    code: 'expedia_processor',
    header: 'Expedia Processor',
    group: 'expedia',
    getValue: p => p.expedia_processor?.name ?? ''
  },
  {
    code: 'expedia_otp_number',
    header: 'Expedia OTP Number',
    group: 'expedia',
    getValue: p => p.expedia_otp_number ?? ''
  },
  {
    code: 'userNameExpedia',
    header: 'User Name Expedia',
    group: 'expedia',
    getValue: p => cred(p).expediaUsername ?? ''
  },
  {
    code: 'passwordExpedia',
    header: 'Password Expedia',
    group: 'expedia',
    getValue: p => cred(p).expediaPassword ?? ''
  },
  {
    code: 'expedia_secondary_username',
    header: 'Expedia Secondary User Name',
    group: 'expedia',
    getValue: p => cred(p).expediaSecondaryUsername ?? ''
  },
  {
    code: 'expedia_secondary_password',
    header: 'Expedia Secondary Password',
    group: 'expedia',
    getValue: p => cred(p).expediaSecondaryPassword ?? ''
  },
  {
    code: 'need_another_domain',
    header: 'Need another Domain',
    group: 'expedia',
    getValue: p => formatYesNo(p.need_another_domain)
  },
  {
    code: 'booking_id',
    header: 'Booking ID',
    group: 'booking',
    getValue: p => formatCell(p.booking_id)
  },
  {
    code: 'booking_priority',
    header: 'Booking Priority',
    group: 'booking',
    getValue: p => p.booking_priority ?? ''
  },
  {
    code: 'booking_service_type',
    header: 'Booking Service Type',
    group: 'booking',
    getValue: p => p.booking_service_type?.type ?? ''
  },
  {
    code: 'booking_service_fee',
    header: 'Booking Service Fee',
    group: 'booking',
    getValue: p => formatCell(p.booking_service_fee)
  },
  {
    code: 'booking_frequency',
    header: 'Booking Frequency',
    group: 'booking',
    getValue: p => p.booking_frequency?.name ?? ''
  },
  {
    code: 'booking_historical_review',
    header: 'Booking Historical Review',
    group: 'booking',
    getValue: p => formatDateRange(p.booking_from, p.booking_to)
  },
  {
    code: 'booking_crs',
    header: 'Booking CRS',
    group: 'booking',
    getValue: p => p.booking_crs ?? ''
  },
  {
    code: 'booking_run_date',
    header: 'Booking Run Date',
    group: 'booking',
    getValue: p => formatExportDate(p.booking_run_date)
  },
  {
    code: 'booking_processor',
    header: 'Booking Processor',
    group: 'booking',
    getValue: p => p.booking_processor?.name ?? ''
  },
  {
    code: 'userNameBooking',
    header: 'User Name Booking',
    group: 'booking',
    getValue: p => cred(p).bookingUsername ?? ''
  },
  {
    code: 'passwordBooking',
    header: 'Password Booking',
    group: 'booking',
    getValue: p => cred(p).bookingPassword ?? ''
  },
  {
    code: 'booking_otp_phone',
    header: 'Booking OTP Phone Number',
    group: 'booking',
    getValue: p => p.booking_otp_phone ?? ''
  },
  {
    code: 'agoda_id',
    header: 'Agoda ID',
    group: 'agoda',
    getValue: p => formatCell(p.agoda_id)
  },
  {
    code: 'agoda_priority',
    header: 'Agoda Priority',
    group: 'agoda',
    getValue: p => p.agoda_priority ?? ''
  },
  {
    code: 'agoda_service_type',
    header: 'Agoda Service Type',
    group: 'agoda',
    getValue: p => p.agoda_service_type?.type ?? ''
  },
  {
    code: 'agoda_service_fee',
    header: 'Agoda Service Fee',
    group: 'agoda',
    getValue: p => formatCell(p.agoda_service_fee)
  },
  {
    code: 'agoda_frequency',
    header: 'Agoda Frequency',
    group: 'agoda',
    getValue: p => p.agoda_frequency?.name ?? ''
  },
  {
    code: 'agoda_historical_review',
    header: 'Agoda Historical Review',
    group: 'agoda',
    getValue: p => formatDateRange(p.agoda_from, p.agoda_to)
  },
  {
    code: 'agoda_crs',
    header: 'Agoda CRS',
    group: 'agoda',
    getValue: p => p.agoda_crs ?? ''
  },
  {
    code: 'agoda_run_date',
    header: 'Agoda Run Date',
    group: 'agoda',
    getValue: p => formatExportDate(p.agoda_run_date)
  },
  {
    code: 'agoda_processor',
    header: 'Agoda Processor',
    group: 'agoda',
    getValue: p => p.agoda_processor?.name ?? ''
  },
  {
    code: 'userNameAgoda',
    header: 'User Name Agoda',
    group: 'agoda',
    getValue: p => cred(p).agodaUsername ?? ''
  },
  {
    code: 'passwordAgoda',
    header: 'Password Agoda',
    group: 'agoda',
    getValue: p => cred(p).agodaPassword ?? ''
  },
  {
    code: 'agoda_otp_number',
    header: 'Agoda OTP Number',
    group: 'agoda',
    getValue: p => p.agoda_otp_number ?? ''
  },
  {
    code: 'hotel_address',
    header: 'Hotel Address',
    group: 'contact',
    getValue: p => p.hotel_address ?? ''
  },
  {
    code: 'portfolio_contact_email',
    header: 'Portfolio Contact Email',
    group: 'contact',
    getValue: p => p.portfolio_contact_email ?? ''
  },
  {
    code: 'reporting_contact',
    header: 'Reporting Contact',
    group: 'contact',
    getValue: p => p.reporting_contact ?? ''
  },
  {
    code: 'primary_case_email',
    header: 'Case Contact Email',
    group: 'contact',
    getValue: p => p.primary_case_email ?? ''
  },
  {
    code: 'access_contact',
    header: 'Access Contact',
    group: 'contact',
    getValue: p => p.access_contact ?? ''
  },
  {
    code: 'discontinued_email_ids',
    header: 'Discontinued Email IDs',
    group: 'contact',
    getValue: p =>
      Array.isArray(p.discontinued_email_ids)
        ? p.discontinued_email_ids.filter(Boolean).join(', ')
        : (p.discontinued_email_ids ?? '')
  },
  {
    code: 'card_descriptor',
    header: 'Card Descriptor',
    group: 'contact',
    getValue: p => p.card_descriptor ?? ''
  },
  {
    code: 'qp_username',
    header: 'QP Username',
    group: 'contact',
    getValue: p => p.qp_username ?? ''
  },
  {
    code: 'qp_password',
    header: 'QP Password',
    group: 'contact',
    getValue: p => p.qp_password ?? ''
  },
  {
    code: 'fp_username',
    header: 'FP User Name',
    group: 'contact',
    getValue: p => p.fp_username ?? ''
  },
  {
    code: 'fp_password',
    header: 'FP Password',
    group: 'contact',
    getValue: p => p.fp_password ?? ''
  },
  {
    code: 'sales_rep',
    header: 'Sales Rep',
    group: 'contact',
    getValue: p => p.sales_rep ?? ''
  },
  {
    code: 'cybersource_mid',
    header: 'Cybersource MID',
    group: 'contact',
    getValue: p => p.cybersource_mid ?? ''
  },
  {
    code: 'adyen_location',
    header: 'Adyen Location',
    group: 'contact',
    getValue: p => p.adyen_location ?? ''
  },
  {
    code: 'stripe_connected_email',
    header: 'Stripe Connected Email',
    group: 'contact',
    getValue: p => p.stripe_connected_email ?? ''
  },
  {
    code: 'currency',
    header: 'Currency',
    group: 'contact',
    getValue: p => p.currency?.code ?? p.currency?.name ?? ''
  }
] as const

const PROPERTY_EXPORT_COLUMN_BY_CODE = new Map(
  PROPERTY_EXPORT_COLUMNS.map(col => [col.code, col])
)

/** All supported export column codes (stable order). */
export const PROPERTY_EXPORT_COLUMN_CODES = PROPERTY_EXPORT_COLUMNS.map(
  c => c.code
)

/** Headers in default export order (kept for callers that need the full list). */
export const PROPERTY_EXCEL_HEADERS = PROPERTY_EXPORT_COLUMNS.map(c => c.header)

/**
 * Resolves requested column codes to export defs.
 * Omitted / null / empty array → all columns.
 * Unknown codes are ignored; order follows the request when codes are provided.
 */
export function resolvePropertyExportColumns(
  columnCodes?: string[] | null
): PropertyExportColumnDef[] {
  if (!columnCodes || columnCodes.length === 0) {
    return [...PROPERTY_EXPORT_COLUMNS]
  }

  const resolved: PropertyExportColumnDef[] = []
  const seen = new Set<string>()
  for (const code of columnCodes) {
    if (seen.has(code)) continue
    const def = PROPERTY_EXPORT_COLUMN_BY_CODE.get(
      code as PropertyExportColumnCode
    )
    if (!def) continue
    seen.add(code)
    resolved.push(def)
  }

  return resolved.length > 0 ? resolved : [...PROPERTY_EXPORT_COLUMNS]
}

function headerCellStyle(group: PropertyExportColumnDef['group']) {
  const bg = HEADER_GROUP_COLORS[group]
  if (!bg) return HEADER_CELL_STYLE
  return {
    ...HEADER_CELL_STYLE,
    fill: { fgColor: { rgb: bg }, patternType: 'solid' as const }
  }
}

function columnWidth(header: string, values: (string | number)[]): number {
  const maxLen = Math.max(
    header.length,
    ...values.map(v => String(v ?? '').length)
  )
  return Math.min(Math.max(maxLen + 2, 12), 60)
}

export function mapPropertyToExcelRow(
  property: any,
  columnCodes?: string[] | null
): Record<string, string | number> {
  const columns = resolvePropertyExportColumns(columnCodes)
  const row: Record<string, string | number> = {}
  for (const col of columns) {
    row[col.header] = col.getValue(property)
  }
  return row
}

export function buildPropertyExportWorkbook(
  rows: Record<string, string | number>[],
  columnCodes?: string[] | null
): XLSX.WorkBook {
  const columns = resolvePropertyExportColumns(columnCodes)
  const headers = columns.map(c => c.header)
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers })
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  const columnValues: (string | number)[][] = headers.map(() => [])

  for (let c = 0; c < columns.length; c++) {
    const headerAddr = XLSX.utils.encode_cell({ r: 0, c })
    const headerCell = worksheet[headerAddr]
    if (headerCell) headerCell.s = headerCellStyle(columns[c].group)
  }

  for (let r = 1; r <= range.e.r; r++) {
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = worksheet[addr]
      if (!cell) continue
      cell.s = DATA_CELL_STYLE
      columnValues[c].push(cell.v as string | number)
    }
  }

  worksheet['!cols'] = headers.map((header, index) => ({
    wch: columnWidth(header, columnValues[index])
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Properties')
  return workbook
}

export function writePropertyExportBuffer(
  rows: Record<string, string | number>[],
  columnCodes?: string[] | null
): Buffer {
  const workbook = buildPropertyExportWorkbook(rows, columnCodes)
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
