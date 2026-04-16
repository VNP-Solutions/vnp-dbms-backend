import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger } from '@nestjs/common'
import type { Cache } from 'cache-manager'
import type { RedisClientType } from '@keyv/redis'

export const CACHE_NAMESPACE = 'vnp'

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name)

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key)
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttlMs)
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key)
  }

  /**
   * Delete all keys matching a glob pattern.
   * The pattern should NOT include the namespace prefix (e.g. use 'portfolio:list:*', not 'vnp::portfolio:list:*').
   * Uses Redis SCAN to safely iterate without blocking the server.
   */
  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const client = this.getRedisClient()
      if (!client) {
        this.logger.warn('Redis client unavailable — skipping pattern invalidation')
        return
      }

      // Check if client is open/connected
      if (!(client as any).isOpen) {
        this.logger.warn('Redis client is not connected — skipping pattern invalidation')
        return
      }

      // Actual Redis key format: {ns}::{ns}:{key}
      // Keyv adds  "{ns}:"  → "@keyv/redis" adds  "{ns}::"  on top
      const fullPattern = `${CACHE_NAMESPACE}::${CACHE_NAMESPACE}:${pattern}`
      // Cursor must be a string — @redis/client v5.11+ encodes args as-is
      // and the RESP encoder rejects raw numbers.
      let cursor = '0'
      const keysToDelete: string[] = []

      do {
        const result = await (client as any).scan(cursor, { MATCH: fullPattern, COUNT: 100 })
        // Normalise: older builds return { cursor: number }, newer return { cursor: string }
        cursor = String(result.cursor)
        keysToDelete.push(...result.keys)
      } while (cursor !== '0')

      if (keysToDelete.length > 0) {
        // Delete one-at-a-time to stay compatible across @redis/client versions
        // (array-form DEL is accepted by some versions but not others)
        await Promise.all(keysToDelete.map(key => (client as any).del(key)))
        this.logger.debug(`Deleted ${keysToDelete.length} keys matching: ${fullPattern}`)
      }
    } catch (err: any) {
      this.logger.error(`Pattern delete failed for "${pattern}": ${err.message}`)
    }
  }

  private getRedisClient(): RedisClientType | null {
    try {
      const cache = this.cacheManager as any
      const keyv = Array.isArray(cache.stores) ? cache.stores[0] : null
      const adapter = keyv?.store
      return adapter?.client ?? null
    } catch {
      return null
    }
  }
}
