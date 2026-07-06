import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { OtpPlatform, OtpStatus } from '@prisma/client'
import { CreateOtpStatusDto, UpdateOtpStatusDto } from './otp-status.dto'
import type { IOtpStatusRepository, IOtpStatusService } from './otp-status.interface'

@Injectable()
export class OtpStatusService implements IOtpStatusService {
  constructor(
    @Inject('IOtpStatusRepository')
    private readonly repo: IOtpStatusRepository
  ) {}

  create(data: CreateOtpStatusDto): Promise<OtpStatus> {
    return this.repo.create(data)
  }

  findAll(): Promise<OtpStatus[]> {
    return this.repo.findAll()
  }

  findByPlatform(platform: OtpPlatform): Promise<OtpStatus | null> {
    return this.repo.findByPlatform(platform)
  }

  async update(id: string, data: UpdateOtpStatusDto): Promise<OtpStatus> {
    const existing = await this.repo.findByPlatform(data.platform as OtpPlatform)
    if (!existing && !data.platform) {
      throw new NotFoundException(`OTP status with id ${id} not found`)
    }
    return this.repo.update(id, data)
  }

  async remove(id: string): Promise<OtpStatus> {
    return this.repo.delete(id)
  }
}
