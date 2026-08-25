import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { IpInfoController } from './ipinfo.controller'
import { IpInfoService } from './ipinfo.service'

@Module({
  imports: [ConfigModule],
  controllers: [IpInfoController],
  providers: [IpInfoService]
})
export class IpInfoModule {}
