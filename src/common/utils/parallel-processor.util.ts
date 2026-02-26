import { Worker } from 'worker_threads'
import * as os from 'os'

/**
 * Configuration for parallel processing
 */
export interface ParallelProcessorConfig {
  /** Number of worker threads (default: from env or 8) */
  workerCount?: number
  /** Minimum items required to use parallel processing (default: 100) */
  minItemsForParallel?: number
}

/**
 * Result from a worker thread
 */
interface WorkerResult<T> {
  results: T[]
  errors: string[]
}

/**
 * Reusable parallel processor utility using worker threads
 *
 * This utility splits work across multiple threads for CPU-intensive operations
 * like encryption/decryption, hashing, or data transformation.
 *
 * Usage:
 * ```typescript
 * const results = await ParallelProcessor.process(
 *   items,
 *   (item) => expensiveOperation(item),
 *   { workerCount: 8 }
 * )
 * ```
 */
export class ParallelProcessor {
  private static readonly DEFAULT_WORKER_COUNT = 8
  private static readonly MIN_ITEMS_FOR_PARALLEL = 100

  /**
   * Get the configured worker count from environment or default
   */
  static getWorkerCount(): number {
    const envWorkers = process.env.PARALLEL_WORKERS
    if (envWorkers) {
      const parsed = parseInt(envWorkers, 10)
      if (!isNaN(parsed) && parsed > 0) {
        return Math.min(parsed, os.cpus().length * 2) // Cap at 2x CPU cores
      }
    }
    return Math.min(this.DEFAULT_WORKER_COUNT, os.cpus().length)
  }

  /**
   * Process items in parallel using worker threads
   *
   * For small datasets, processes sequentially to avoid thread overhead.
   * For large datasets, splits work across multiple worker threads.
   *
   * @param items - Array of items to process
   * @param processor - Function to apply to each item (must be serializable)
   * @param processorCode - String representation of the processor function for workers
   * @param context - Additional context data needed by the processor
   * @param config - Optional configuration
   * @returns Processed results (items that failed processing are excluded)
   */
  static async processWithWorkers<T, R>(
    items: T[],
    processorCode: string,
    context: Record<string, any> = {},
    config: ParallelProcessorConfig = {}
  ): Promise<R[]> {
    const workerCount = config.workerCount ?? this.getWorkerCount()
    const minItems = config.minItemsForParallel ?? this.MIN_ITEMS_FOR_PARALLEL

    // For small datasets, process sequentially (avoid thread overhead)
    if (items.length < minItems) {
      return this.processSequentially<T, R>(items, processorCode, context)
    }

    // Split items into chunks for each worker
    const chunks = this.splitIntoChunks(items, workerCount)

    // Process chunks in parallel using worker threads
    const workerPromises = chunks.map(chunk =>
      this.runWorker<T, R>(chunk, processorCode, context)
    )

    const results = await Promise.all(workerPromises)

    // Combine results from all workers
    return results.flatMap(r => r.results)
  }

  /**
   * Simple parallel processing using Promise.all with chunked batches
   * This is lighter weight than worker threads but still provides parallelism
   *
   * @param items - Array of items to process
   * @param processor - Async function to apply to each item
   * @param config - Optional configuration
   */
  static async processInBatches<T, R>(
    items: T[],
    processor: (item: T) => Promise<R | null>,
    config: ParallelProcessorConfig = {}
  ): Promise<R[]> {
    const batchSize = config.workerCount ?? this.getWorkerCount()
    const results: R[] = []

    // Process in batches to avoid overwhelming the event loop
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(async item => {
          try {
            return await processor(item)
          } catch {
            return null
          }
        })
      )

      // Filter out nulls (failed items)
      for (const result of batchResults) {
        if (result !== null) {
          results.push(result)
        }
      }
    }

    return results
  }

  /**
   * Process items sequentially (for small datasets)
   */
  private static processSequentially<T, R>(
    items: T[],
    processorCode: string,
    context: Record<string, any>
  ): R[] {
    // Create processor function from code string
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const processorFn = new Function('item', 'context', processorCode) as (
      item: T,
      context: Record<string, any>
    ) => R | null

    const results: R[] = []
    for (const item of items) {
      try {
        const result = processorFn(item, context)
        if (result !== null) {
          results.push(result)
        }
      } catch {
        // Skip items that fail processing
      }
    }
    return results
  }

  /**
   * Split array into roughly equal chunks
   */
  private static splitIntoChunks<T>(items: T[], numChunks: number): T[][] {
    const chunks: T[][] = []
    const chunkSize = Math.ceil(items.length / numChunks)

    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize))
    }

    return chunks
  }

  /**
   * Run a worker thread to process a chunk of items
   */
  private static runWorker<T, R>(
    chunk: T[],
    processorCode: string,
    context: Record<string, any>
  ): Promise<WorkerResult<R>> {
    return new Promise((resolve, reject) => {
      // Create inline worker code
      const workerCode = `
        const { parentPort, workerData } = require('worker_threads');

        const { items, processorCode, context } = workerData;

        // Create processor function from code string
        const processorFn = new Function('item', 'context', processorCode);

        const results = [];
        const errors = [];

        for (const item of items) {
          try {
            const result = processorFn(item, context);
            if (result !== null) {
              results.push(result);
            }
          } catch (err) {
            errors.push(err.message || 'Unknown error');
          }
        }

        parentPort.postMessage({ results, errors });
      `

      const worker = new Worker(workerCode, {
        eval: true,
        workerData: {
          items: chunk,
          processorCode,
          context
        }
      })

      worker.on('message', (result: WorkerResult<R>) => {
        resolve(result)
      })

      worker.on('error', err => {
        reject(err)
      })

      worker.on('exit', code => {
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${code}`))
        }
      })
    })
  }
}

/**
 * Helper to create a processor code string for decryption
 * This is needed because worker threads can't directly share function references
 *
 * OPTIMIZATION: If context.derivedKey is provided (as hex string), uses it directly
 * instead of calling scryptSync for each item. This avoids repeated expensive key derivation.
 */
export function createDecryptionProcessor(): string {
  return `
    const crypto = require('crypto');

    const ALGORITHM = 'aes-256-cbc';

    // Use pre-derived key if available (major performance optimization)
    // Otherwise fall back to deriving key (for backwards compatibility)
    const key = context.derivedKey
      ? Buffer.from(context.derivedKey, 'hex')
      : crypto.scryptSync(context.secret, 'salt', 32);

    const parts = item.password.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return {
      password: decrypted,
      otaType: item.otaType
    };
  `
}

/**
 * Pre-derive the encryption key from a secret
 * Call this ONCE and pass the result to workers via context.derivedKey
 *
 * This avoids calling scryptSync (expensive) for every single item being decrypted.
 *
 * @param secret - The encryption secret
 * @returns The derived key as a hex string (can be passed to workers)
 */
export function deriveEncryptionKey(secret: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto')
  const key = crypto.scryptSync(secret, 'salt', 32)
  return key.toString('hex')
}
