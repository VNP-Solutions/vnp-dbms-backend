import { BadRequestException } from '@nestjs/common'
import * as XLSX from 'xlsx'
import type { BulkUploadRetrievalJobsPayload } from '../../modules/external-api/external-api.dto'

export interface RetrievalExcelGroup {
  hotel_id: string
  rows: Record<string, unknown>[]
}

export function groupRetrievalExcelRows(
  rawData: Record<string, unknown>[]
): Map<string, Record<string, unknown>[]> {
  const groupedByHotelId = new Map<string, Record<string, unknown>[]>()

  for (const row of rawData) {
    const hotelId =
      (
        row['Hotel ID'] ||
        row['Property ID'] ||
        row['Property Id']
      )?.toString() || ''

    if (!hotelId) continue

    if (!groupedByHotelId.has(hotelId)) {
      groupedByHotelId.set(hotelId, [])
    }
    groupedByHotelId.get(hotelId)!.push(row)
  }

  return groupedByHotelId
}

export function parseRetrievalExcelBuffer(
  filename: string,
  buffer: Buffer
): BulkUploadRetrievalJobsPayload {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]

  if (!sheetName) {
    throw new BadRequestException('Excel file has no worksheets')
  }

  const worksheet = workbook.Sheets[sheetName]
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)

  if (!rawData.length) {
    throw new BadRequestException('Excel file is empty')
  }

  const groupedByHotelId = groupRetrievalExcelRows(rawData)

  if (!groupedByHotelId.size) {
    throw new BadRequestException(
      'Excel file has no valid Hotel ID / Property ID columns'
    )
  }

  return {
    parent_retrieval_name: filename,
    groups: Array.from(groupedByHotelId.entries()).map(([hotel_id, rows]) => ({
      hotel_id,
      rows
    }))
  }
}

export function getRetrievalGroupDisplayName(
  group: RetrievalExcelGroup
): string {
  const firstRow = group.rows[0] ?? {}
  return (
    firstRow['Hotel Name']?.toString() ||
    firstRow['Property Name']?.toString() ||
    `Hotel ${group.hotel_id}`
  )
}
