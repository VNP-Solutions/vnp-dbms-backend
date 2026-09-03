import { Injectable, Logger } from '@nestjs/common'
import * as path from 'path'
import { Worker, type WorkerOptions } from 'worker_threads'
import {
  PROPERTY_EXPORT_CONCURRENCY,
  PROPERTY_EXPORT_MAX_QUEUED,
  PROPERTY_EXPORT_WORKER_TIMEOUT_MS
} from '../../config/configuration'
import { writePropertyExportBuffer } from '../utils/property-excel.util'

export class ExportQueueFullError extends Error {
  constructor(queued: number) {
    super(`property export queue is full (${queued} waiting)`)
    this.name = 'ExportQueueFullError'
  }
}

/**
 * Keeps property exports from starving the rest of the API.
 *
 * Two separate problems, two mechanisms:
 *  - CPU: building the workbook is ~1.4s of unbroken synchronous work for a
 *    full export, which stalls the event loop, so it runs in a worker thread.
 *  - Contention: several people exporting at once would still saturate the
 *    CPU and hold several copies of the data in memory, so whole jobs run
 *    through a concurrency gate and the rest wait their turn.
 *
 * The gate wraps the entire job (query included) rather than just the workbook
 * step, so a queued export holds nothing in memory while it waits.
 */
@Injectable()
export class PropertyExportRunnerService {
  private readonly logger = new Logger(PropertyExportRunnerService.name)
  private active = 0
  private readonly waiting: (() => void)[] = []

  get queueDepth(): number {
    return this.waiting.length
  }

  get activeCount(): number {
    return this.active
  }

  /**
   * Runs `job` once a slot is free. Throws ExportQueueFullError immediately if
   * too many exports are already waiting, so the caller can tell the user to
   * retry instead of piling up unbounded work.
   */
  async run<T>(job: () => Promise<T>): Promise<T> {
    if (this.waiting.length >= PROPERTY_EXPORT_MAX_QUEUED) {
      throw new ExportQueueFullError(this.waiting.length)
    }

    await this.acquire()
    try {
      return await job()
    } finally {
      this.release()
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < PROPERTY_EXPORT_CONCURRENCY) {
      this.active++
      return
    }
    this.logger.log(
      `export waiting for a slot (${this.active} running, ${this.waiting.length} queued)`
    )
    // The slot is handed straight over on release, so active is not touched.
    await new Promise<void>(resolve => this.waiting.push(resolve))
  }

  private release(): void {
    const next = this.waiting.shift()
    if (next) {
      next()
      return
    }
    this.active--
  }

  /**
   * Builds the .xlsx buffer on a worker thread. Falls back to building inline
   * if the worker cannot run — a briefly blocked event loop is better than a
   * failed export.
   */
  async buildWorkbookBuffer(
    rows: Record<string, string | number>[],
    columnCodes: string[] | null
  ): Promise<Buffer> {
    try {
      return await this.runWorker(rows, columnCodes)
    } catch (error: any) {
      this.logger.error(
        `export worker unavailable (${error?.message ?? error}), building inline on the main thread`
      )
      return writePropertyExportBuffer(rows, columnCodes)
    }
  }

  private runWorker(
    rows: Record<string, string | number>[],
    columnCodes: string[] | null
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      // Running from src under ts-node in dev, from dist after a build.
      const compiled = !__filename.endsWith('.ts')
      const workerFile = path.join(
        __dirname,
        '..',
        'workers',
        compiled ? 'property-export.worker.js' : 'property-export.worker.ts'
      )

      const options: WorkerOptions = { workerData: { rows, columnCodes } }
      if (!compiled) {
        options.execArgv = ['-r', 'ts-node/register/transpile-only']
      }

      let settled = false
      const worker = new Worker(workerFile, options)

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        void worker.terminate()
        reject(
          new Error(
            `export worker timed out after ${PROPERTY_EXPORT_WORKER_TIMEOUT_MS}ms`
          )
        )
      }, PROPERTY_EXPORT_WORKER_TIMEOUT_MS)

      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        fn()
      }

      worker.on('message', (msg: any) => {
        if (msg?.ok) finish(() => resolve(Buffer.from(msg.buffer)))
        else finish(() => reject(new Error(msg?.error ?? 'unknown worker error')))
      })
      worker.on('error', err => finish(() => reject(err)))
      worker.on('exit', code => {
        if (code !== 0) {
          finish(() => reject(new Error(`export worker exited with code ${code}`)))
        }
      })
    })
  }
}
