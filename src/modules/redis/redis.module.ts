import { CacheModule } from '@nestjs/cache-manager'
import { Global, Module, OnModuleDestroy } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import KeyvRedis, { Keyv } from '@keyv/redis'
import { createClient, type RedisClientType } from 'redis'
import { GlobalFilterCacheService } from '../../common/services/global-filter-cache.service'
import { RedisService, CACHE_NAMESPACE } from './redis.service'

let redisClient: RedisClientType

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('redis.host', 'localhost')
        const port = configService.get<number>('redis.port', 6379)
        const password = configService.get<string | undefined>('redis.password')
        const ttlMs = configService.get<number>('redis.ttl', 300) * 1000

        const url = password
          ? `redis://:${password}@${host}:${port}`
          : `redis://${host}:${port}`

        // Create a persistent Redis client with proper connection settings
        redisClient = createClient({
          url,
          socket: {
            keepAlive: 5000, // Keep connection alive with 5s pings
            reconnectStrategy: (retries: number) => {
              if (retries > 20) {
                console.error('Redis: Max reconnect attempts reached')
                return new Error('Max reconnect attempts reached')
              }
              const delay = Math.min(retries * 100, 3000)
              console.log(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`)
              return delay
            }
          },
          // Disable offline queue to prevent blocking
          disableOfflineQueue: false
        })

        // Handle connection events
        redisClient.on('error', (err) => {
          console.error('Redis Client Error:', err.message)
        })

        redisClient.on('connect', () => {
          console.log(`Redis: Connected to ${host}:${port}`)
        })

        redisClient.on('ready', () => {
          console.log('Redis: Client ready')
        })

        redisClient.on('reconnecting', () => {
          console.log('Redis: Reconnecting...')
        })

        redisClient.on('end', () => {
          console.log('Redis: Connection closed')
        })

        // Connect the client before passing to KeyvRedis
        await redisClient.connect()

        // Pass the connected client to KeyvRedis (not the URL)
        // Type cast needed due to version mismatch between redis and @keyv/redis
        const redisStore = new KeyvRedis(redisClient as any)

        return {
          stores: new Keyv({
            store: redisStore,
            namespace: CACHE_NAMESPACE,
            ttl: ttlMs
          })
        }
      }
    })
  ],
  providers: [RedisService, GlobalFilterCacheService],
  exports: [RedisService, GlobalFilterCacheService]
})
export class RedisModule implements OnModuleDestroy {
  async onModuleDestroy() {
    if (redisClient?.isOpen) {
      await redisClient.quit()
      console.log('Redis: Connection closed gracefully')
    }
  }
}
