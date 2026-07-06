import { Injectable } from '@nestjs/common'
import { OtpPlatform, OtpStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateOtpStatusDto, UpdateOtpStatusDto } from './otp-status.dto'
import type { IOtpStatusRepository } from './otp-status.interface'

@Injectable()
export class OtpStatusRepository implements IOtpStatusRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateOtpStatusDto): Promise<OtpStatus> {
    return this.prisma.otpStatus.create({ data })
  }

  findAll(): Promise<OtpStatus[]> {
    return this.prisma.otpStatus.findMany({ orderBy: { updated_at: 'desc' } })
  }

  findByPlatform(platform: OtpPlatform): Promise<OtpStatus | null> {
    return this.prisma.otpStatus.findFirst({
      where: { platform },
      orderBy: { updated_at: 'desc' }
    })
  }

  update(id: string, data: UpdateOtpStatusDto): Promise<OtpStatus> {
    return this.prisma.otpStatus.update({ where: { id }, data })
  }

  delete(id: string): Promise<OtpStatus> {
    return this.prisma.otpStatus.delete({ where: { id } })
  }
}
