import { OtpPlatform, OtpStatus } from '@prisma/client'
import { CreateOtpStatusDto, UpdateOtpStatusDto } from './otp-status.dto'

export interface IOtpStatusRepository {
  create(data: CreateOtpStatusDto): Promise<OtpStatus>
  findAll(): Promise<OtpStatus[]>
  findByPlatform(platform: OtpPlatform): Promise<OtpStatus | null>
  update(id: string, data: UpdateOtpStatusDto): Promise<OtpStatus>
  delete(id: string): Promise<OtpStatus>
}

export interface IOtpStatusService {
  create(data: CreateOtpStatusDto): Promise<OtpStatus>
  findAll(): Promise<OtpStatus[]>
  findByPlatform(platform: OtpPlatform): Promise<OtpStatus | null>
  update(id: string, data: UpdateOtpStatusDto): Promise<OtpStatus>
  remove(id: string): Promise<OtpStatus>
}
