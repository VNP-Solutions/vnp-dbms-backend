/**
 * Races `promise` against a timer and rejects with a clear error if it doesn't
 * settle in time.
 *
 * Why this exists: Prisma's MongoDB connector does NOT support `socketTimeoutMS`
 * (confirmed unsupported by Prisma's own connection-string parser — see
 * https://github.com/prisma/prisma/issues/18241 and the Rust engine's
 * `ClientOptions::parse` docs). That means a Prisma call that grabs a stale/dead
 * pooled connection (e.g. one dropped by a NAT/firewall/Atlas after being idle
 * between rows of a long-running background job) can hang forever with no error
 * and no timeout — nothing above it in the stack will ever hear back. This
 * wrapper is the only reliable way to bound such a call so one dead connection
 * fails a single row instead of freezing an entire background job.
 *
 * Note: this only stops *waiting* on the original promise — it does not (and
 * cannot) cancel the underlying Mongo operation. That's fine for our use case
 * (marking one row failed and moving on); it just means the abandoned operation
 * may still complete on the server side after we've given up on it.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
