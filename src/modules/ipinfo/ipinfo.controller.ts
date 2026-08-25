import { Controller, Get, Req, Res } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { resolveClientIp } from '../../common/helpers/client-ip.helper'
import { Public } from '../auth/decorators/public.decorator'
import { IpInfoService } from './ipinfo.service'

@ApiTags('IP Info')
@Controller('ipinfo')
@Public()
export class IpInfoController {
  constructor(private readonly ipInfoService: IpInfoService) {}

  @Get()
  @ApiOperation({
    summary: 'Get caller IP geolocation info (proxied from ipinfo.io)'
  })
  @ApiResponse({
    status: 200,
    description: 'IP information retrieved successfully'
  })
  @ApiResponse({
    status: 503,
    description: 'IP info service unavailable or misconfigured'
  })
  async getIpInfo(
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const clientIp = resolveClientIp(req)
    const result = await this.ipInfoService.getIpInfo(clientIp)
    res.status(result.status).json(result.body)
  }
}
