import * as XLSX from 'xlsx-js-style';
import { normalizeParserJobDate } from './parser-job-date.util';

/**
 * Canonical Excel header for every column whose spelling used to differ
 * between the export and the two upload parsers, together with the legacy
 * spellings that are still accepted.
 *
 * The export writes `header`; import and bulk-update match `header` first and
 * then each alias, so a file produced by any version of the export can still
 * be uploaded. Matching is case-insensitive, so aliases only need to list
 * genuinely different wording — not case variants.
 */
export const EXCEL_COLUMN_HEADERS = {
  subportfolio: {
    header: 'Sub Portfolio',
    aliases: ['Sub-Portfolio', 'Subportfolio', 'Sub Portfolio Name']
  },
  hotelAddress: {
    header: 'Hotel Address',
    aliases: ['Address', 'Property Address']
  },
  expediaUsername: {
    header: 'Expedia Username',
    aliases: ['User Name Expedia']
  },
  expediaPassword: {
    header: 'Expedia Password',
    aliases: ['Password Expedia']
  },
  bookingUsername: {
    header: 'Booking Username',
    aliases: ['User Name Booking']
  },
  bookingPassword: {
    header: 'Booking Password',
    aliases: ['Password Booking']
  },
  agodaUsername: {
    header: 'Agoda Username',
    aliases: ['User Name Agoda']
  },
  agodaPassword: {
    header: 'Agoda Password',
    aliases: ['Password Agoda']
  },
  expediaSecondaryUsername: {
    header: 'Expedia Secondary Username',
    aliases: ['Expedia Secondary User Name']
  },
  expediaSecondaryPassword: {
    header: 'Expedia Secondary Password',
    aliases: []
  },
  fpUsername: {
    header: 'FP Username',
    aliases: ['FP User Name']
  },
  bookingOtpPhone: {
    header: 'Booking OTP Phone',
    aliases: ['Booking OTP Phone Number']
  },
  qpUsername: {
    header: 'QP Username',
    aliases: ['QP User Name']
  },
  qpPassword: {
    header: 'QP Password',
    aliases: []
  },
  qpApiKey: {
    header: 'QP API Key',
    aliases: []
  },
  needAnotherDomain: {
    header: 'Need Another Domain',
    aliases: []
  },
  expediaRunDate: {
    header: 'Expedia Run Date',
    aliases: ['Expedia Run Date From']
  },
  expediaRunDateDb: {
    header: 'Expedia Run Date DB',
    aliases: ['Expedia Run Date DB From']
  },
  bookingRunDate: {
    header: 'Booking Run Date',
    aliases: ['Booking Run Date From']
  },
  agodaRunDate: {
    header: 'Agoda Run Date',
    aliases: ['Agoda Run Date From']
  },
  isActive: {
    header: 'Is Active',
    aliases: ['Active', 'is_active']
  },
  nextDueDate: {
    header: 'Next Due Date',
    aliases: ['Due Date']
  }
} as const satisfies Record<
  string,
  { header: string; aliases: readonly string[] }
>

export type ExcelColumnKey = keyof typeof EXCEL_COLUMN_HEADERS

/** Canonical header followed by every accepted alias, for parser lookups. */
export function excelHeaderNames(key: ExcelColumnKey): readonly string[] {
  const entry = EXCEL_COLUMN_HEADERS[key]
  return [entry.header, ...entry.aliases]
}

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

/** Normalizes Excel date cells (MM/DD/YYYY, YYYY-MM-DD, Mmm DD YYYY, serial numbers) to YYYY-MM-DD. */
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
  | 'description'
  | 'is_active'
  | 'next_due_date'
  | 'priority'
  | 'ota_access_levels'
  | 'ota_credentials_verified'
  | 'expedia_id'
  | 'expedia_status'
  | 'expedia_priority'
  | 'expedia_billing_type'
  | 'expedia_service_type'
  | 'expedia_service_fee'
  | 'expedia_frequency'
  | 'expedia_historical_review'
  | 'expedia_historical_review_db'
  | 'expedia_duration'
  | 'expedia_db_duration'
  | 'expedia_crs'
  | 'expedia_crs_db'
  | 'expedia_run_date'
  | 'expedia_run_date_db'
  | 'expedia_revised_date'
  | 'expedia_scheduler'
  | 'expedia_scheduler_review'
  | 'expedia_scheduler_review_db'
  | 'expedia_processor'
  | 'expedia_otp_number'
  | 'userNameExpedia'
  | 'passwordExpedia'
  | 'expedia_secondary_username'
  | 'expedia_secondary_password'
  | 'need_another_domain'
  | 'booking_id'
  | 'booking_status'
  | 'booking_priority'
  | 'booking_billing_type'
  | 'booking_service_type'
  | 'booking_service_fee'
  | 'booking_frequency'
  | 'booking_historical_review'
  | 'booking_duration'
  | 'booking_crs'
  | 'booking_run_date'
  | 'booking_revised_date'
  | 'booking_scheduler'
  | 'booking_processor'
  | 'userNameBooking'
  | 'passwordBooking'
  | 'booking_secondary_username'
  | 'booking_secondary_password'
  | 'booking_otp_phone'
  | 'booking_otp_number'
  | 'agoda_id'
  | 'agoda_status'
  | 'agoda_priority'
  | 'agoda_billing_type'
  | 'agoda_service_type'
  | 'agoda_service_fee'
  | 'agoda_frequency'
  | 'agoda_historical_review'
  | 'agoda_duration'
  | 'agoda_crs'
  | 'agoda_run_date'
  | 'agoda_revised_date'
  | 'agoda_scheduler'
  | 'agoda_processor'
  | 'userNameAgoda'
  | 'passwordAgoda'
  | 'agoda_secondary_username'
  | 'agoda_secondary_password'
  | 'agoda_otp_number'
  | 'hotel_address'
  | 'portfolio_contact'
  | 'portfolio_contact_email'
  | 'reporting_contact'
  | 'primary_case_email'
  | 'case_management_contact'
  | 'access_contact'
  | 'discontinued_email_ids'
  | 'new_domain_email'
  | 'card_descriptor'
  | 'qp_username'
  | 'qp_password'
  | 'qp_api_key'
  | 'fp_username'
  | 'fp_password'
  | 'fp_mid'
  | 'webmail_password'
  | 'sales_rep'
  | 'cybersource_mid'
  | 'adyen_location'
  | 'stripe_connected_email'
  | 'stripe_account_email'
  | 'currency'
  | 'notes'

type ExportHeaderGroup = 'general' | 'expedia' | 'booking' | 'agoda' | 'contact'

/** One physical Excel column produced from a request column code. */
type PropertyExportSheetColumn = {
  header: string
  group: ExportHeaderGroup
  getValue: (property: any) => string | number
}

/**
 * A request `columns` code. Most codes map 1→1 sheet column;
 * composites (e.g. ota_access_levels) expand into multiple sheet columns.
 */
type PropertyExportColumnDef = {
  code: PropertyExportColumnCode
  columns: PropertyExportSheetColumn[]
}

const HEADER_GROUP_COLORS: Record<ExportHeaderGroup, string | null> = {
  general: null,
  expedia: 'FFFF00',
  booking: 'C1E4F5',
  agoda: 'FAE2D5',
  contact: 'C1F0C8'
}

function sheetCol(
  header: string,
  group: ExportHeaderGroup,
  getValue: (property: any) => string | number
): PropertyExportSheetColumn {
  return { header, group, getValue }
}

function singleCol(
  code: PropertyExportColumnCode,
  header: string,
  group: ExportHeaderGroup,
  getValue: (property: any) => string | number
): PropertyExportColumnDef {
  return { code, columns: [sheetCol(header, group, getValue)] }
}

function multiCol(
  code: PropertyExportColumnCode,
  columns: PropertyExportSheetColumn[]
): PropertyExportColumnDef {
  return { code, columns }
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

function cred(property: any) {
  return property.credentials?.[0] || {}
}

/** Canonical export column codes — order is the default “all columns” order. */
export const PROPERTY_EXPORT_COLUMNS: readonly PropertyExportColumnDef[] = [
  singleCol('portfolio_id', 'Portfolio', 'general', p => p.portfolio?.name ?? ''),
  singleCol(
    'subportfolio_id',
    EXCEL_COLUMN_HEADERS.subportfolio.header,
    'general',
    p => p.subportfolio?.name ?? ''
  ),
  singleCol(
    'service_type',
    'Service Type',
    'general',
    p => p.service_type?.type ?? ''
  ),
  singleCol('name', 'Property Name', 'general', p => p.name ?? ''),
  singleCol(
    'property_identifier',
    'Property Identifier',
    'general',
    p => p.property_identifier ?? ''
  ),
  singleCol('description', 'Description', 'general', p => p.description ?? ''),
  singleCol(
    'is_active',
    EXCEL_COLUMN_HEADERS.isActive.header,
    'general',
    p => formatYesNo(p.is_active)
  ),
  singleCol(
    'next_due_date',
    EXCEL_COLUMN_HEADERS.nextDueDate.header,
    'general',
    p => formatExportDate(p.next_due_date)
  ),
  singleCol('priority', 'Priority', 'general', p => p.priority?.name ?? ''),
  multiCol('ota_access_levels', [
    sheetCol('Expedia Access Level', 'general', p =>
      formatYesNo(p.expedia_access_level)
    ),
    sheetCol('Booking Access Level', 'general', p =>
      formatYesNo(p.booking_access_level)
    ),
    sheetCol('Agoda Access Level', 'general', p =>
      formatYesNo(p.agoda_access_level)
    )
  ]),
  multiCol('ota_credentials_verified', [
    sheetCol('Expedia Credential Verified', 'general', p =>
      formatYesNo(p.expedia_credential_verified)
    ),
    sheetCol('Booking Credential Verified', 'general', p =>
      formatYesNo(p.booking_credential_verified)
    ),
    sheetCol('Agoda Credential Verified', 'general', p =>
      formatYesNo(p.agoda_credential_verified)
    )
  ]),
  singleCol('expedia_id', 'Expedia ID', 'expedia', p => formatCell(p.expedia_id)),
  singleCol(
    'expedia_status',
    'Expedia Status',
    'expedia',
    p => p.expedia_status ?? ''
  ),
  singleCol(
    'expedia_priority',
    'Expedia Priority',
    'expedia',
    p => p.expedia_priority ?? ''
  ),
  singleCol(
    'expedia_billing_type',
    'Expedia Billing Type',
    'expedia',
    p => p.expedia_billing_type?.name ?? ''
  ),
  singleCol(
    'expedia_service_type',
    'Expedia Service Type',
    'expedia',
    p => p.expedia_service_type?.type ?? ''
  ),
  singleCol('expedia_service_fee', 'Expedia Service Fee', 'expedia', p =>
    formatCell(p.expedia_service_fee)
  ),
  singleCol(
    'expedia_frequency',
    'Expedia Frequency',
    'expedia',
    p => p.expedia_frequency?.name ?? ''
  ),
  multiCol('expedia_historical_review', [
    sheetCol('Expedia Historical From', 'expedia', p =>
      formatExportDate(p.expedia_from)
    ),
    sheetCol('Expedia Historical To', 'expedia', p =>
      formatExportDate(p.expedia_to)
    )
  ]),
  multiCol('expedia_historical_review_db', [
    sheetCol('DB Historical From', 'expedia', p => formatExportDate(p.from_db)),
    sheetCol('DB Historical To', 'expedia', p => formatExportDate(p.to_db))
  ]),
  singleCol('expedia_duration', 'Expedia Duration', 'expedia', p =>
    formatCell(p.expedia_duration)
  ),
  singleCol('expedia_db_duration', 'Expedia DB Duration', 'expedia', p =>
    formatCell(p.expedia_db_duration)
  ),
  singleCol('expedia_crs', 'Expedia CRS', 'expedia', p => p.expedia_crs ?? ''),
  singleCol(
    'expedia_crs_db',
    'Expedia CRS DB',
    'expedia',
    p => p.expedia_crs_db ?? ''
  ),
  singleCol(
    'expedia_run_date',
    EXCEL_COLUMN_HEADERS.expediaRunDate.header,
    'expedia',
    p => formatExportDate(p.expedia_run_date)
  ),
  singleCol(
    'expedia_run_date_db',
    EXCEL_COLUMN_HEADERS.expediaRunDateDb.header,
    'expedia',
    p => formatExportDate(p.expedia_run_date_db)
  ),
  singleCol('expedia_revised_date', 'Expedia Revised Date', 'expedia', p =>
    formatExportDate(p.expedia_revised_date)
  ),
  singleCol('expedia_scheduler', 'Expedia Scheduler', 'expedia', p =>
    formatYesNo(p.expedia_scheduler)
  ),
  multiCol('expedia_scheduler_review', [
    sheetCol('Expedia Scheduler Review From', 'expedia', p =>
      formatExportDate(p.expedia_scheduler_review_from)
    ),
    sheetCol('Expedia Scheduler Review To', 'expedia', p =>
      formatExportDate(p.expedia_scheduler_review_to)
    )
  ]),
  multiCol('expedia_scheduler_review_db', [
    sheetCol('Expedia Scheduler DB', 'expedia', p =>
      formatCell(p.expedia_scheduler_db)
    ),
    sheetCol('Expedia Scheduler Review DB From', 'expedia', p =>
      formatExportDate(p.expedia_scheduler_review_db_from)
    ),
    sheetCol('Expedia Scheduler Review DB To', 'expedia', p =>
      formatExportDate(p.expedia_scheduler_review_db_to)
    )
  ]),
  singleCol(
    'expedia_processor',
    'Expedia Processor',
    'expedia',
    p => p.expedia_processor?.name ?? ''
  ),
  singleCol(
    'expedia_otp_number',
    'Expedia OTP Number',
    'expedia',
    p => p.expedia_otp_number ?? ''
  ),
  singleCol(
    'userNameExpedia',
    EXCEL_COLUMN_HEADERS.expediaUsername.header,
    'expedia',
    p => cred(p).expediaUsername ?? ''
  ),
  singleCol(
    'passwordExpedia',
    EXCEL_COLUMN_HEADERS.expediaPassword.header,
    'expedia',
    p => cred(p).expediaPassword ?? ''
  ),
  singleCol(
    'expedia_secondary_username',
    EXCEL_COLUMN_HEADERS.expediaSecondaryUsername.header,
    'expedia',
    p => cred(p).expediaSecondaryUsername ?? ''
  ),
  singleCol(
    'expedia_secondary_password',
    EXCEL_COLUMN_HEADERS.expediaSecondaryPassword.header,
    'expedia',
    p => cred(p).expediaSecondaryPassword ?? ''
  ),
  singleCol(
    'need_another_domain',
    EXCEL_COLUMN_HEADERS.needAnotherDomain.header,
    'expedia',
    p => formatYesNo(p.need_another_domain)
  ),
  singleCol('booking_id', 'Booking ID', 'booking', p => formatCell(p.booking_id)),
  singleCol(
    'booking_status',
    'Booking Status',
    'booking',
    p => p.booking_status ?? ''
  ),
  singleCol(
    'booking_priority',
    'Booking Priority',
    'booking',
    p => p.booking_priority ?? ''
  ),
  singleCol(
    'booking_billing_type',
    'Booking Billing Type',
    'booking',
    p => p.booking_billing_type?.name ?? ''
  ),
  singleCol(
    'booking_service_type',
    'Booking Service Type',
    'booking',
    p => p.booking_service_type?.type ?? ''
  ),
  singleCol('booking_service_fee', 'Booking Service Fee', 'booking', p =>
    formatCell(p.booking_service_fee)
  ),
  singleCol(
    'booking_frequency',
    'Booking Frequency',
    'booking',
    p => p.booking_frequency?.name ?? ''
  ),
  multiCol('booking_historical_review', [
    sheetCol('Booking Historical From', 'booking', p =>
      formatExportDate(p.booking_from)
    ),
    sheetCol('Booking Historical To', 'booking', p =>
      formatExportDate(p.booking_to)
    )
  ]),
  singleCol('booking_duration', 'Booking Duration', 'booking', p =>
    formatCell(p.booking_duration)
  ),
  singleCol('booking_crs', 'Booking CRS', 'booking', p => p.booking_crs ?? ''),
  singleCol(
    'booking_run_date',
    EXCEL_COLUMN_HEADERS.bookingRunDate.header,
    'booking',
    p => formatExportDate(p.booking_run_date)
  ),
  singleCol('booking_revised_date', 'Booking Revised Date', 'booking', p =>
    formatExportDate(p.booking_revised_date)
  ),
  singleCol('booking_scheduler', 'Booking Scheduler', 'booking', p =>
    formatYesNo(p.booking_scheduler)
  ),
  singleCol(
    'booking_processor',
    'Booking Processor',
    'booking',
    p => p.booking_processor?.name ?? ''
  ),
  singleCol(
    'userNameBooking',
    EXCEL_COLUMN_HEADERS.bookingUsername.header,
    'booking',
    p => cred(p).bookingUsername ?? ''
  ),
  singleCol(
    'passwordBooking',
    EXCEL_COLUMN_HEADERS.bookingPassword.header,
    'booking',
    p => cred(p).bookingPassword ?? ''
  ),
  singleCol(
    'booking_secondary_username',
    'Booking Secondary Username',
    'booking',
    p => cred(p).bookingSecondaryUsername ?? ''
  ),
  singleCol(
    'booking_secondary_password',
    'Booking Secondary Password',
    'booking',
    p => cred(p).bookingSecondaryPassword ?? ''
  ),
  singleCol(
    'booking_otp_phone',
    EXCEL_COLUMN_HEADERS.bookingOtpPhone.header,
    'booking',
    p => p.booking_otp_phone ?? ''
  ),
  singleCol(
    'booking_otp_number',
    'Booking OTP Number',
    'booking',
    p => p.booking_otp_number ?? ''
  ),
  singleCol('agoda_id', 'Agoda ID', 'agoda', p => formatCell(p.agoda_id)),
  singleCol('agoda_status', 'Agoda Status', 'agoda', p => p.agoda_status ?? ''),
  singleCol(
    'agoda_priority',
    'Agoda Priority',
    'agoda',
    p => p.agoda_priority ?? ''
  ),
  singleCol(
    'agoda_billing_type',
    'Agoda Billing Type',
    'agoda',
    p => p.agoda_billing_type?.name ?? ''
  ),
  singleCol(
    'agoda_service_type',
    'Agoda Service Type',
    'agoda',
    p => p.agoda_service_type?.type ?? ''
  ),
  singleCol('agoda_service_fee', 'Agoda Service Fee', 'agoda', p =>
    formatCell(p.agoda_service_fee)
  ),
  singleCol(
    'agoda_frequency',
    'Agoda Frequency',
    'agoda',
    p => p.agoda_frequency?.name ?? ''
  ),
  multiCol('agoda_historical_review', [
    sheetCol('Agoda Historical From', 'agoda', p =>
      formatExportDate(p.agoda_from)
    ),
    sheetCol('Agoda Historical To', 'agoda', p => formatExportDate(p.agoda_to))
  ]),
  singleCol('agoda_duration', 'Agoda Duration', 'agoda', p =>
    formatCell(p.agoda_duration)
  ),
  singleCol('agoda_crs', 'Agoda CRS', 'agoda', p => p.agoda_crs ?? ''),
  singleCol(
    'agoda_run_date',
    EXCEL_COLUMN_HEADERS.agodaRunDate.header,
    'agoda',
    p => formatExportDate(p.agoda_run_date)
  ),
  singleCol('agoda_revised_date', 'Agoda Revised Date', 'agoda', p =>
    formatExportDate(p.agoda_revised_date)
  ),
  singleCol('agoda_scheduler', 'Agoda Scheduler', 'agoda', p =>
    formatYesNo(p.agoda_scheduler)
  ),
  singleCol(
    'agoda_processor',
    'Agoda Processor',
    'agoda',
    p => p.agoda_processor?.name ?? ''
  ),
  singleCol(
    'userNameAgoda',
    EXCEL_COLUMN_HEADERS.agodaUsername.header,
    'agoda',
    p => cred(p).agodaUsername ?? ''
  ),
  singleCol(
    'passwordAgoda',
    EXCEL_COLUMN_HEADERS.agodaPassword.header,
    'agoda',
    p => cred(p).agodaPassword ?? ''
  ),
  singleCol(
    'agoda_secondary_username',
    'Agoda Secondary Username',
    'agoda',
    p => cred(p).agodaSecondaryUsername ?? ''
  ),
  singleCol(
    'agoda_secondary_password',
    'Agoda Secondary Password',
    'agoda',
    p => cred(p).agodaSecondaryPassword ?? ''
  ),
  singleCol(
    'agoda_otp_number',
    'Agoda OTP Number',
    'agoda',
    p => p.agoda_otp_number ?? ''
  ),
  singleCol(
    'hotel_address',
    EXCEL_COLUMN_HEADERS.hotelAddress.header,
    'contact',
    p => p.hotel_address ?? ''
  ),
  singleCol(
    'portfolio_contact',
    'Portfolio Contact',
    'contact',
    p => p.portfolio_contact ?? ''
  ),
  singleCol(
    'portfolio_contact_email',
    'Portfolio Contact Email',
    'contact',
    p => p.portfolio_contact_email ?? ''
  ),
  singleCol(
    'reporting_contact',
    'Reporting Contact',
    'contact',
    p => p.reporting_contact ?? ''
  ),
  singleCol(
    'primary_case_email',
    'Case Contact Email',
    'contact',
    p => p.primary_case_email ?? ''
  ),
  singleCol(
    'case_management_contact',
    'Case Management Contact',
    'contact',
    p => p.case_management_contact ?? ''
  ),
  singleCol(
    'access_contact',
    'Access Contact',
    'contact',
    p => p.access_contact ?? ''
  ),
  singleCol('discontinued_email_ids', 'Discontinued Email IDs', 'contact', p =>
    Array.isArray(p.discontinued_email_ids)
      ? p.discontinued_email_ids.filter(Boolean).join(', ')
      : (p.discontinued_email_ids ?? '')
  ),
  singleCol(
    'card_descriptor',
    'Card Descriptor',
    'contact',
    p => p.card_descriptor ?? ''
  ),
  singleCol(
    'qp_username',
    EXCEL_COLUMN_HEADERS.qpUsername.header,
    'contact',
    p => p.qp_username ?? ''
  ),
  singleCol(
    'qp_password',
    EXCEL_COLUMN_HEADERS.qpPassword.header,
    'contact',
    p => p.qp_password ?? ''
  ),
  singleCol(
    'qp_api_key',
    EXCEL_COLUMN_HEADERS.qpApiKey.header,
    'contact',
    p => p.qp_api_key ?? ''
  ),
  singleCol(
    'fp_username',
    EXCEL_COLUMN_HEADERS.fpUsername.header,
    'contact',
    p => p.fp_username ?? ''
  ),
  singleCol('fp_password', 'FP Password', 'contact', p => p.fp_password ?? ''),
  singleCol('fp_mid', 'FP MID', 'contact', p => p.fp_mid ?? ''),
  singleCol(
    'webmail_password',
    'Webmail Password',
    'contact',
    p => p.webmail_password ?? ''
  ),
  singleCol(
    'new_domain_email',
    'New Domains Email',
    'contact',
    p => p.new_domain_email ?? ''
  ),
  singleCol('sales_rep', 'Sales Rep', 'contact', p => p.sales_rep ?? ''),
  singleCol(
    'cybersource_mid',
    'Cybersource MID',
    'contact',
    p => p.cybersource_mid ?? ''
  ),
  singleCol(
    'adyen_location',
    'Adyen Location',
    'contact',
    p => p.adyen_location ?? ''
  ),
  singleCol(
    'stripe_connected_email',
    'Stripe Connected Email',
    'contact',
    p => p.stripe_connected_email ?? ''
  ),
  singleCol(
    'stripe_account_email',
    'Stripe Account Email',
    'contact',
    p => p.stripe_account_email ?? ''
  ),
  singleCol(
    'currency',
    'Currency',
    'contact',
    p => p.currency?.code ?? p.currency?.name ?? ''
  ),
  // Semicolon-separated so the bulk-update parser can split them back apart.
  singleCol('notes', 'Notes', 'contact', p =>
    Array.isArray(p.notes)
      ? p.notes
          .map((n: any) => String(n?.text ?? '').trim())
          .filter(Boolean)
          .join('; ')
      : ''
  )
]

const PROPERTY_EXPORT_COLUMN_BY_CODE = new Map(
  PROPERTY_EXPORT_COLUMNS.map(col => [col.code, col])
)

/** All supported export column codes (stable order). */
export const PROPERTY_EXPORT_COLUMN_CODES = PROPERTY_EXPORT_COLUMNS.map(
  c => c.code
)

function flattenExportSheetColumns(
  defs: readonly PropertyExportColumnDef[]
): PropertyExportSheetColumn[] {
  return defs.flatMap(def => def.columns)
}

/** Headers in default export order (expanded composites). */
export const PROPERTY_EXCEL_HEADERS = flattenExportSheetColumns(
  PROPERTY_EXPORT_COLUMNS
).map(c => c.header)

/**
 * Resolves requested column codes to physical Excel sheet columns.
 * Composite codes expand (e.g. ota_access_levels → 3 columns).
 * Omitted / null / empty array → all columns.
 * Unknown codes are ignored; order follows the request when codes are provided.
 */
export function resolvePropertyExportColumns(
  columnCodes?: string[] | null
): PropertyExportSheetColumn[] {
  if (!columnCodes || columnCodes.length === 0) {
    return flattenExportSheetColumns(PROPERTY_EXPORT_COLUMNS)
  }

  const resolvedDefs: PropertyExportColumnDef[] = []
  const seen = new Set<string>()
  for (const code of columnCodes) {
    if (seen.has(code)) continue
    const def = PROPERTY_EXPORT_COLUMN_BY_CODE.get(
      code as PropertyExportColumnCode
    )
    if (!def) continue
    seen.add(code)
    resolvedDefs.push(def)
  }

  const flattened = flattenExportSheetColumns(
    resolvedDefs.length > 0 ? resolvedDefs : PROPERTY_EXPORT_COLUMNS
  )
  return flattened
}

function headerCellStyle(group: ExportHeaderGroup) {
  const bg = HEADER_GROUP_COLORS[group]
  if (!bg) return HEADER_CELL_STYLE
  return {
    ...HEADER_CELL_STYLE,
    fill: { fgColor: { rgb: bg }, patternType: 'solid' as const }
  }
}

function columnWidth(maxContentLength: number): number {
  return Math.min(Math.max(maxContentLength + 2, 12), 60)
}

/**
 * Resolves the column set once and returns a mapper, so exporting N properties
 * doesn't re-resolve the column list N times.
 */
export function createPropertyExcelRowMapper(
  columnCodes?: string[] | null
): (property: any) => Record<string, string | number> {
  const columns = resolvePropertyExportColumns(columnCodes)
  return property => {
    const row: Record<string, string | number> = {}
    for (const col of columns) {
      row[col.header] = col.getValue(property)
    }
    return row
  }
}

export function mapPropertyToExcelRow(
  property: any,
  columnCodes?: string[] | null
): Record<string, string | number> {
  return createPropertyExcelRowMapper(columnCodes)(property)
}

export function buildPropertyExportWorkbook(
  rows: Record<string, string | number>[],
  columnCodes?: string[] | null
): XLSX.WorkBook {
  const columns = resolvePropertyExportColumns(columnCodes)
  const headers = columns.map(c => c.header)
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers })
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  // Running maximum per column — keeping every cell value around a second time
  // just to size the columns is what made large exports blow up.
  const maxContentLength = headers.map(h => h.length)

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
      const len = String(cell.v ?? '').length
      if (len > maxContentLength[c]) maxContentLength[c] = len
    }
  }

  worksheet['!cols'] = maxContentLength.map(len => ({
    wch: columnWidth(len)
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
