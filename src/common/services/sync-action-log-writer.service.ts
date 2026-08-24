import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { AxiosInstance } from 'axios'
import { SyncCommunicationService } from './sync-communication.service'
import type { Configuration } from '../../config/configuration'
import type { IUserWithPermissions } from '../interfaces/permission.interface'
import type {
  EntitySyncState,
  UploadJobData,
  UploadJobEntity
} from '../../modules/property/property.interface'

export type SyncActionScope = 'SINGLE' | 'BULK'
export type SyncActionEntityType = 'PORTFOLIO' | 'PROPERTY'
export type SyncActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'TRANSFER'
  | 'IMPORT'

export interface SyncActionLogItemPayload {
  id?: string
  name: string
  success?: boolean
  reason?: string
  dbms?: string
  dashboard?: string
  scraper?: string
  from_portfolio_id?: string
  from_portfolio_name?: string
  to_portfolio_id?: string
  to_portfolio_name?: string
}

export interface SyncActionActorSnapshot {
  performed_by_email?: string
  performed_by_name?: string
  performed_by_role?: string
}

export interface SyncActionLogPayload {
  scope: SyncActionScope
  entity_type: SyncActionEntityType
  action: SyncActionType
  entity_id?: string
  entity_name?: string
  items: SyncActionLogItemPayload[]
  total_count?: number
  success_count?: number
  failed_count?: number
  performed_by_email?: string
  performed_by_name?: string
  performed_by_role?: string
  job_id?: string
}

type ActorUser = IUserWithPermissions & {
  first_name?: string | null
  last_name?: string | null
}

const FAILED_STATES: ReadonlySet<EntitySyncState> = new Set(['failed'])
const SUCCESS_STATES: ReadonlySet<EntitySyncState> = new Set([
  'created',
  'updated',
  'skipped'
])

@Injectable()
export class SyncActionLogWriter {
  private readonly logger = new Logger(SyncActionLogWriter.name)
  private readonly client: AxiosInstance | null

  constructor(
    private readonly config: ConfigService<Configuration, true>,
    private readonly syncCommunication: SyncCommunicationService
  ) {
    const dashUrl =
      this.config.get('dashboardBackendUrl', { infer: true }) ?? ''
    this.client =
      dashUrl && this.syncCommunication.isConfigured()
        ? axios.create({ baseURL: dashUrl, timeout: 15000 })
        : null

    if (!this.client) {
      this.logger.warn(
        '[sync-action-log] disabled — dashboard URL or JWT_COMMUNICATION_SECRET missing'
      )
    }
  }

  actorFromUser(user: ActorUser): SyncActionActorSnapshot {
    const name = [user.first_name, user.last_name]
      .filter(Boolean)
      .join(' ')
      .trim()
    return {
      performed_by_email: user.email,
      performed_by_name: name || user.email,
      performed_by_role: user.role?.name
    }
  }

  async write(payload: SyncActionLogPayload): Promise<void> {
    if (!this.client) return

    try {
      await this.client.post('/api/sync-action-log', payload, {
        headers: this.syncCommunication.createAuthHeaders()
      })
    } catch (e: any) {
      this.logger.error(
        `[sync-action-log] failed to write log: ${e?.message ?? e}`
      )
    }
  }

  async writeSingle(params: {
    entity_type: SyncActionEntityType
    action: SyncActionType
    entity_id?: string
    entity_name: string
    success?: boolean
    reason?: string
    dbms?: string
    dashboard?: string
    scraper?: string
    from_portfolio_id?: string
    from_portfolio_name?: string
    to_portfolio_id?: string
    to_portfolio_name?: string
    performed_by_email?: string
    performed_by_name?: string
    performed_by_role?: string
  }): Promise<void> {
    const success = params.success !== false
    await this.write({
      scope: 'SINGLE',
      entity_type: params.entity_type,
      action: params.action,
      entity_id: params.entity_id,
      entity_name: params.entity_name,
      items: [
        {
          id: params.entity_id,
          name: params.entity_name,
          success,
          reason: params.reason,
          dbms: params.dbms,
          dashboard: params.dashboard,
          scraper: params.scraper,
          from_portfolio_id: params.from_portfolio_id,
          from_portfolio_name: params.from_portfolio_name,
          to_portfolio_id: params.to_portfolio_id,
          to_portfolio_name: params.to_portfolio_name
        }
      ],
      total_count: 1,
      success_count: success ? 1 : 0,
      failed_count: success ? 0 : 1,
      performed_by_email: params.performed_by_email,
      performed_by_name: params.performed_by_name,
      performed_by_role: params.performed_by_role
    })
  }

  async writeFromUploadJobItems(params: {
    job: UploadJobData
    entity_type: SyncActionEntityType
    action: SyncActionType
    items: UploadJobEntity[]
    to_portfolio_id?: string
    to_portfolio_name?: string
  }): Promise<void> {
    const { job, entity_type, action, items } = params
    if (!items.length) return

    const mapped = items.map(item => this.mapUploadJobEntity(item, params))
    const successCount = mapped.filter(i => i.success).length
    const failedCount = mapped.length - successCount

    await this.write({
      scope: 'BULK',
      entity_type,
      action,
      items: mapped,
      total_count: mapped.length,
      success_count: successCount,
      failed_count: failedCount,
      performed_by_email: job.userEmail,
      performed_by_name: job.userName || job.userEmail,
      performed_by_role: job.userRole,
      job_id: job.jobId
    })
  }

  /** Writes portfolio + property logs from a finished upload job when applicable. */
  async writeFromUploadJob(job: UploadJobData): Promise<void> {
    const action =
      job.source === 'import'
        ? 'IMPORT'
        : job.source === 'bulk-update'
          ? 'UPDATE'
          : 'TRANSFER'

    if (job.portfolios.items.length > 0 && job.source === 'import') {
      await this.writeFromUploadJobItems({
        job,
        entity_type: 'PORTFOLIO',
        action: 'IMPORT',
        items: job.portfolios.items
      })
    }

    if (job.properties.items.length > 0) {
      await this.writeFromUploadJobItems({
        job,
        entity_type: 'PROPERTY',
        action,
        items: job.properties.items,
        to_portfolio_name:
          job.source === 'bulk-transfer' ? job.filename : undefined
      })
    }
  }

  private mapUploadJobEntity(
    item: UploadJobEntity,
    opts: {
      to_portfolio_id?: string
      to_portfolio_name?: string
    }
  ): SyncActionLogItemPayload {
    const success = this.isItemOverallSuccess(item)
    const reason =
      item.dbms.reason ||
      item.dashboard.reason ||
      item.scraper.reason ||
      undefined

    return {
      id: item.id,
      name: item.name,
      success,
      reason,
      dbms: item.dbms.state,
      dashboard: item.dashboard.state,
      scraper: item.scraper.state,
      to_portfolio_id: opts.to_portfolio_id,
      to_portfolio_name: opts.to_portfolio_name
    }
  }

  private isItemOverallSuccess(item: UploadJobEntity): boolean {
    const states = [item.dbms.state, item.dashboard.state, item.scraper.state]
    if (states.some(s => FAILED_STATES.has(s))) return false
    if (item.dbms.state === 'pending' || item.dbms.state === 'processing') {
      return false
    }
    return (
      SUCCESS_STATES.has(item.dbms.state) || item.dbms.state === 'skipped'
    )
  }
}
