import * as XLSX from 'xlsx-js-style'

/** Column order matches templates/property-import-template.xlsx (DBMS Templates). */
export const PROPERTY_EXCEL_HEADERS = [
  'Portfolio',
  'Service Type',
  'Property Name',
  'Property Identifier',
  'Expedia ID',
  'Expedia Service Fee',
  'Expedia Billing Type',
  'Expedia Service Type',
  'Expedia Frequency',
  'Expedia Priority',
  'Expedia Access Level',
  'Expedia From',
  'Expedia To',
  'From DB',
  'To DB',
  'Expedia Revised Date',
  'Expedia Scheduler Review From',
  'Expedia Scheduler Review To',
  'Expedia Scheduler Review DB From',
  'Expedia Scheduler Review DB To',
  'Expedia CRS',
  'Expedia CRS DB',
  'Expedia Run Date From',
  'Expedia Run Date To',
  'Expedia Run Date DB From',
  'Expedia Run Date DB To',
  'Expedia Scheduler',
  'Expedia Duration',
  'Expedia DB Duration',
  'Expedia Processor',
  'Expedia Username',
  'Expedia Password',
  'Expedia Secondary Username',
  'Expedia Secondary Password',
  'Expedia Credential Verified',
  'Expedia OTP Number',
  'Need Another Domain',
  'Booking ID',
  'Booking Service Fee',
  'Booking Service Type',
  'Booking Frequency',
  'Booking Access Level',
  'Booking From',
  'Booking To',
  'Booking Scheduler',
  'Booking Duration',
  'Booking Processor',
  'Booking Username',
  'Booking Password',
  'Booking Credential Verified',
  'Booking OTP Phone',
  'Agoda ID',
  'Agoda Service Fee',
  'Agoda Service Type',
  'Agoda Frequency',
  'Agoda Access Level',
  'Agoda From',
  'Agoda To',
  'Agoda Scheduler',
  'Agoda Duration',
  'Agoda Processor',
  'Agoda Username',
  'Agoda Password',
  'Agoda Credential Verified',
  'Property Address',
  'Portfolio Contact Email',
  'Reporting Contact',
  'Case Contact Email',
  'Access Contact',
  'Sales Rep',
  'Card Descriptor',
  'Qp Username',
  'Qp Password',
  'FP Username',
  'FP Password'
] as const

/** Header background colors from DBMS Templates sheet (gid=1851433537). */
const HEADER_BG_RANGES: { from: number; to: number; color: string | null }[] = [
  { from: 0, to: 3, color: null },
  { from: 4, to: 36, color: 'FFFF00' },
  { from: 37, to: 50, color: 'C1E4F5' },
  { from: 51, to: 63, color: 'FAE2D5' },
  { from: 64, to: 74, color: 'C1F0C8' }
]

const HEADER_CELL_STYLE = {
  font: { bold: true, sz: 13, name: 'Arial' },
  alignment: { vertical: 'center', wrapText: true }
}

const DATA_CELL_STYLE = {
  font: { sz: 13, name: 'Arial' },
  alignment: { vertical: 'center', wrapText: true }
}

function formatCell(value: unknown): string | number {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return value as string | number
}

function headerBackgroundColor(colIndex: number): string | null {
  for (const range of HEADER_BG_RANGES) {
    if (colIndex >= range.from && colIndex <= range.to) return range.color
  }
  return null
}

function headerCellStyle(colIndex: number) {
  const bg = headerBackgroundColor(colIndex)
  if (!bg) return HEADER_CELL_STYLE
  return {
    ...HEADER_CELL_STYLE,
    fill: { fgColor: { rgb: bg }, patternType: 'solid' as const }
  }
}

function columnWidth(header: string, values: (string | number)[]): number {
  const maxLen = Math.max(header.length, ...values.map(v => String(v ?? '').length))
  return Math.min(Math.max(maxLen + 2, 12), 60)
}

export function mapPropertyToExcelRow(property: any): Record<string, string | number> {
  const cred = property.credentials?.[0] || {}

  return {
    Portfolio: property.portfolio?.name ?? '',
    'Service Type': property.service_type?.type ?? '',
    'Property Name': property.name ?? '',
    'Property Identifier': property.property_identifier ?? '',
    'Expedia ID': property.expedia_id ?? '',
    'Expedia Service Fee': property.expedia_service_fee ?? '',
    'Expedia Billing Type': property.expedia_billing_type?.name ?? '',
    'Expedia Service Type': property.expedia_service_type?.type ?? '',
    'Expedia Frequency': property.expedia_frequency?.name ?? '',
    'Expedia Priority': property.expedia_priority ?? '',
    'Expedia Access Level': formatCell(property.expedia_access_level),
    'Expedia From': property.expedia_from ?? '',
    'Expedia To': property.expedia_to ?? '',
    'From DB': property.from_db ?? '',
    'To DB': property.to_db ?? '',
    'Expedia Revised Date': property.expedia_revised_date ?? '',
    'Expedia Scheduler Review From': property.expedia_scheduler_review_from ?? '',
    'Expedia Scheduler Review To': property.expedia_scheduler_review_to ?? '',
    'Expedia Scheduler Review DB From': property.expedia_scheduler_review_db_from ?? '',
    'Expedia Scheduler Review DB To': property.expedia_scheduler_review_db_to ?? '',
    'Expedia CRS': property.expedia_crs ?? '',
    'Expedia CRS DB': property.expedia_crs_db ?? '',
    'Expedia Run Date From': property.expedia_run_date_from ?? '',
    'Expedia Run Date To': property.expedia_run_date_to ?? '',
    'Expedia Run Date DB From': property.expedia_run_date_db_from ?? '',
    'Expedia Run Date DB To': property.expedia_run_date_db_to ?? '',
    'Expedia Scheduler': formatCell(property.expedia_scheduler),
    'Expedia Duration': property.expedia_duration ?? '',
    'Expedia DB Duration': property.expedia_db_duration ?? '',
    'Expedia Processor': property.expedia_processor?.name ?? '',
    'Expedia Username': cred.expediaUsername ?? '',
    'Expedia Password': cred.expediaPassword ?? '',
    'Expedia Secondary Username': cred.expediaSecondaryUsername ?? '',
    'Expedia Secondary Password': cred.expediaSecondaryPassword ?? '',
    'Expedia Credential Verified': formatCell(property.expedia_credential_verified),
    'Expedia OTP Number': property.expedia_otp_number ?? '',
    'Need Another Domain': formatCell(property.need_another_domain),
    'Booking ID': property.booking_id ?? '',
    'Booking Service Fee': property.booking_service_fee ?? '',
    'Booking Service Type': property.booking_service_type?.type ?? '',
    'Booking Frequency': property.booking_frequency?.name ?? '',
    'Booking Access Level': formatCell(property.booking_access_level),
    'Booking From': property.booking_from ?? '',
    'Booking To': property.booking_to ?? '',
    'Booking Scheduler': formatCell(property.booking_scheduler),
    'Booking Duration': property.booking_duration ?? '',
    'Booking Processor': property.booking_processor?.name ?? '',
    'Booking Username': cred.bookingUsername ?? '',
    'Booking Password': cred.bookingPassword ?? '',
    'Booking Credential Verified': formatCell(property.booking_credential_verified),
    'Booking OTP Phone': property.booking_otp_phone ?? '',
    'Agoda ID': property.agoda_id ?? '',
    'Agoda Service Fee': property.agoda_service_fee ?? '',
    'Agoda Service Type': property.agoda_service_type?.type ?? '',
    'Agoda Frequency': property.agoda_frequency?.name ?? '',
    'Agoda Access Level': formatCell(property.agoda_access_level),
    'Agoda From': property.agoda_from ?? '',
    'Agoda To': property.agoda_to ?? '',
    'Agoda Scheduler': formatCell(property.agoda_scheduler),
    'Agoda Duration': property.agoda_duration ?? '',
    'Agoda Processor': property.agoda_processor?.name ?? '',
    'Agoda Username': cred.agodaUsername ?? '',
    'Agoda Password': cred.agodaPassword ?? '',
    'Agoda Credential Verified': formatCell(property.agoda_credential_verified),
    'Property Address': property.hotel_address ?? '',
    'Portfolio Contact Email': property.portfolio_contact_email ?? '',
    'Reporting Contact': property.reporting_contact ?? '',
    'Case Contact Email': property.primary_case_email ?? '',
    'Access Contact': property.access_contact ?? '',
    'Sales Rep': property.sales_rep ?? '',
    'Card Descriptor': property.card_descriptor ?? '',
    'Qp Username': property.qp_username ?? '',
    'Qp Password': property.qp_password ?? '',
    'FP Username': property.fp_username ?? '',
    'FP Password': property.fp_password ?? ''
  }
}

export function buildPropertyExportWorkbook(
  rows: Record<string, string | number>[]
): XLSX.WorkBook {
  const headers = [...PROPERTY_EXCEL_HEADERS]
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers })
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
  const columnValues: (string | number)[][] = headers.map(() => [])

  for (let c = 0; c < headers.length; c++) {
    const headerAddr = XLSX.utils.encode_cell({ r: 0, c })
    const headerCell = worksheet[headerAddr]
    if (headerCell) headerCell.s = headerCellStyle(c)
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
  rows: Record<string, string | number>[]
): Buffer {
  const workbook = buildPropertyExportWorkbook(rows)
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
