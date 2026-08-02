import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '../../modules/redis/redis.service'

export const PROPERTY_ALL_PATTERN = 'property:all:*'
export const PROPERTY_ITEM_PATTERN = 'property:*'
export const PORTFOLIO_ALL_PATTERN = 'portfolio:all:*'
export const SUBPORTFOLIO_ALL_PATTERN = 'subportfolio:all:*'
export const GLOBAL_FILTER_PATTERN = 'global-filter:all:*'

@Injectable()
export class GlobalFilterCacheService {
  private readonly logger = new Logger(GlobalFilterCacheService.name)

  constructor(private readonly redisService: RedisService) {}

  /** Clears all list + global-filter caches used by GET /property/global-filter. */
  async invalidateAll(): Promise<void> {
    await Promise.all([
      this.redisService.deleteByPattern(PROPERTY_ALL_PATTERN),
      this.redisService.deleteByPattern(GLOBAL_FILTER_PATTERN),
      this.redisService.deleteByPattern(PORTFOLIO_ALL_PATTERN),
      this.redisService.deleteByPattern(SUBPORTFOLIO_ALL_PATTERN)
    ])
    this.logger.debug('Invalidated property, portfolio, subportfolio, and global-filter caches')
  }

  async invalidatePropertyItem(propertyId: string): Promise<void> {
    await this.redisService.del(`property:${propertyId}`)
  }

  async invalidateAllIncludingPropertyItems(): Promise<void> {
    await Promise.all([
      this.invalidateAll(),
      this.redisService.deleteByPattern(PROPERTY_ITEM_PATTERN)
    ])
  }
}
