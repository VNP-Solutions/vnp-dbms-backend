/**
 * Audit utility functions
 */

/**
 * ============================================================================
 * AUDIT STATUS CATEGORIES
 * ============================================================================
 * These are the status names from the AuditStatus collection organized by
 * their stage in the audit workflow (case-insensitive comparison)
 */

/**
 * Pending statuses - Audits that are waiting to start
 */
export const PENDING_AUDIT_STATUSES = [
  'Access Required',
  'Other OTA Instance',
  'Pending Assignment'
]

/**
 * Upcoming statuses - Audits that are scheduled
 */
export const UPCOMING_AUDIT_STATUSES = ['Job Assigned-Batched']

/**
 * In Progress statuses - Audits that are actively being worked on
 */
export const IN_PROGRESS_AUDIT_STATUSES = [
  'Approval Required',
  'OTA POST',
  'VCC Reported To Property',
  'VCC Ready to be Invoiced',
  'MOR in Progress',
  'Direct Bill Reported',
  'Direct Bill Ready To Be Invoiced'
]

/**
 * Completed statuses - Audits that are finished and can be archived
 */
export const COMPLETED_AUDIT_STATUSES = [
  'No Review Required',
  'OTA POST Completed',
  'VCC Invoiced',
  'MOR completed and Invoiced',
  'Direct Bill Invoiced',
  'Nothing To Report'
]

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Check if an audit status is pending
 * @param auditStatus - The audit status name from the AuditStatus collection
 * @returns boolean - true if status is pending
 */
export function isPendingAudit(auditStatus: string): boolean {
  const trimmedStatus = auditStatus.trim().toLowerCase()
  return PENDING_AUDIT_STATUSES.some(status => status.toLowerCase() === trimmedStatus)
}

/**
 * Check if an audit status is upcoming
 * @param auditStatus - The audit status name from the AuditStatus collection
 * @returns boolean - true if status is upcoming
 */
export function isUpcomingAudit(auditStatus: string): boolean {
  const trimmedStatus = auditStatus.trim().toLowerCase()
  return UPCOMING_AUDIT_STATUSES.some(status => status.toLowerCase() === trimmedStatus)
}

/**
 * Check if an audit status is in progress
 * @param auditStatus - The audit status name from the AuditStatus collection
 * @returns boolean - true if status is in progress
 */
export function isInProgressAudit(auditStatus: string): boolean {
  const trimmedStatus = auditStatus.trim().toLowerCase()
  return IN_PROGRESS_AUDIT_STATUSES.some(status => status.toLowerCase() === trimmedStatus)
}

/**
 * Check if an audit status is completed
 * @param auditStatus - The audit status name from the AuditStatus collection
 * @returns boolean - true if status is completed
 */
export function isCompletedAudit(auditStatus: string): boolean {
  const trimmedStatus = auditStatus.trim().toLowerCase()
  return COMPLETED_AUDIT_STATUSES.some(status => status.toLowerCase() === trimmedStatus)
}

/**
 * Check if an audit can be archived based on its status
 * @param auditStatus - The audit status name from the AuditStatus collection
 * @returns boolean - true if audit can be archived (completed status)
 */
export function canArchiveAudit(auditStatus: string): boolean {
  return isCompletedAudit(auditStatus)
}

/**
 * Get the status category for a given audit status
 * @param auditStatus - The audit status name from the AuditStatus collection
 * @returns string - The category: 'pending', 'upcoming', 'in_progress', 'completed', or 'unknown'
 */
export function getAuditStatusCategory(
  auditStatus: string
): 'pending' | 'upcoming' | 'in_progress' | 'completed' | 'unknown' {
  const trimmedStatus = auditStatus.trim().toLowerCase()

  if (PENDING_AUDIT_STATUSES.some(status => status.toLowerCase() === trimmedStatus)) return 'pending'
  if (UPCOMING_AUDIT_STATUSES.some(status => status.toLowerCase() === trimmedStatus)) return 'upcoming'
  if (IN_PROGRESS_AUDIT_STATUSES.some(status => status.toLowerCase() === trimmedStatus)) return 'in_progress'
  if (COMPLETED_AUDIT_STATUSES.some(status => status.toLowerCase() === trimmedStatus)) return 'completed'

  return 'unknown'
}

/**
 * Get all statuses for a given category
 * @param category - The status category
 * @returns string[] - List of all statuses in that category
 */
export function getStatusesByCategory(
  category: 'pending' | 'upcoming' | 'in_progress' | 'completed'
): string[] {
  switch (category) {
    case 'pending':
      return [...PENDING_AUDIT_STATUSES]
    case 'upcoming':
      return [...UPCOMING_AUDIT_STATUSES]
    case 'in_progress':
      return [...IN_PROGRESS_AUDIT_STATUSES]
    case 'completed':
      return [...COMPLETED_AUDIT_STATUSES]
    default:
      return []
  }
}

/**
 * Get all completed statuses (for archiving)
 * @returns string[] - List of all completed statuses
 */
export function getCompletedStatuses(): string[] {
  return [...COMPLETED_AUDIT_STATUSES]
}

/**
 * Get error message for non-archivable audit
 * @param currentStatus - Current audit status
 * @returns string - Error message
 */
export function getArchiveErrorMessage(currentStatus: string): string {
  return `Cannot archive audit. Current status is "${currentStatus}". Audit can only be archived with one of these statuses: ${COMPLETED_AUDIT_STATUSES.join(', ')}.`
}
