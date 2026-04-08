import { CacheModule } from '@nestjs/cache-manager'
import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import KeyvRedis, { Keyv } from '@keyv/redis'
import { RedisService, CACHE_NAMESPACE } from './redis.service'

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('redis.host', 'localhost')
        const port = configService.get<number>('redis.port', 6379)
        const password = configService.get<string | undefined>('redis.password')
        const ttlMs = configService.get<number>('redis.ttl', 300) * 1000

        const url = password
          ? `redis://:${password}@${host}:${port}`
          : `redis://${host}:${port}`

        return {
          stores: new Keyv({
            store: new KeyvRedis(url),
            namespace: CACHE_NAMESPACE,
            ttl: ttlMs
          })
        }
      }
    })
  ],
  providers: [RedisService],
  exports: [RedisService]
})
export class RedisModule {}
