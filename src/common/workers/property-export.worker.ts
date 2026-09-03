import { parentPort, workerData } from 'worker_threads'
import { writePropertyExportBuffer } from '../utils/property-excel.util'

/**
 * Builds the .xlsx buffer for a property export.
 *
 * Sheet construction, per-cell styling and the XML/zip serialisation are all
 * synchronous and take seconds on a full export, so they run here instead of
 * on the API's event loop. Only flat row data crosses the thread boundary —
 * no Prisma, no Nest DI, no credentials beyond what is already in the rows.
 */
export type PropertyExportWorkerInput = {
  rows: Record<string, string | number>[]
  columnCodes: string[] | null
}

if (!parentPort) {
  throw new Error('property-export.worker must be started as a worker thread')
}

try {
  const { rows, columnCodes } = workerData as PropertyExportWorkerInput
  const buffer = writePropertyExportBuffer(rows, columnCodes)
  // Transferred rather than copied, so a 10MB workbook does not get cloned.
  const copy = new Uint8Array(buffer)
  parentPort.postMessage({ ok: true, buffer: copy }, [copy.buffer])
} catch (error: any) {
  parentPort.postMessage({
    ok: false,
    error: error?.message ?? String(error)
  })
}
