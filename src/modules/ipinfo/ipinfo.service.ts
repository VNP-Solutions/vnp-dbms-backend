import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { isPrivateOrLocalIp } from '../../common/helpers/client-ip.helper'
import { Configuration } from '../../config/configuration'

export interface IpInfoResponse {
  ip: string
  city?: string
  region?: string
  country?: string
  loc?: string
  org?: string
  postal?: string
  timezone?: string
}

@Injectable()
export class IpInfoService {
  private readonly logger = new Logger(IpInfoService.name)

  constructor(
    private readonly configService: ConfigService<Configuration>
  ) {}

  async getIpInfo(
    clientIp?: string
  ): Promise<{ status: number; body: unknown }> {
    const token = this.configService.get('ipinfo.token', { infer: true })

    if (!token) {
      throw new ServiceUnavailableException(
        'IP info service is not configured'
      )
    }

    // Match direct ipinfo.io/json behavior: when the caller IP is private
    // (localhost, Docker gateway, etc.), let ipinfo resolve from the outbound
    // connection instead of looking up a bogon address.
    const url =
      clientIp && !isPrivateOrLocalIp(clientIp)
        ? `https://ipinfo.io/${encodeURIComponent(clientIp)}/json`
        : 'https://ipinfo.io/json'

    try {
      const response = await axios.get(url, {
        params: { token },
        timeout: 10_000,
        validateStatus: () => true
      })

      return { status: response.status, body: response.data }
    } catch (error) {
      this.logger.error(
        `Failed to fetch IP info${clientIp ? ` for ${clientIp}` : ''}`,
        error instanceof Error ? error.stack : String(error)
      )
      throw new ServiceUnavailableException(
        'Failed to retrieve IP information'
      )
    }
  }
}
