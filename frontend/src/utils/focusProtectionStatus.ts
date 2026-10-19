import type { SentinelStatus, SentinelQuarantineItem } from '../api/device'

export type EnforcementStatusType =
  | 'confirmed'
  | 'unconfirmed'
  | 'contained'
  | 'warned'
  | 'grace'
  | 'denied'
  | 'failed'
  | 'neutral'

export interface EnforcementOutcome {
  badgeLabel: string
  statusType: EnforcementStatusType
  summaryExplanation: string
  fullTechnicalAction: string
  isSuccessful: boolean
}

/**
 * Maps raw backend policy actions and technical reasons to precise, honest user-facing labels.
 * Crucially distinguishes 'Termination confirmed' from 'Termination unconfirmed',
 * and avoids misleading green success styling for unconfirmed or failed enforcement.
 */
export function mapEnforcementOutcome(policyAction?: string | null, rawReason?: string | null): EnforcementOutcome {
  const action = (policyAction || '').toUpperCase().trim()
  const reason = (rawReason || '').trim()

  switch (action) {
    case 'TERMINATED':
      return {
        badgeLabel: 'Termination confirmed',
        statusType: 'confirmed',
        summaryExplanation: 'Process was terminated and verified closed during active focus session.',
        fullTechnicalAction: 'TERMINATED',
        isSuccessful: true,
      }

    case 'TERMINATE_ATTEMPTED':
      return {
        badgeLabel: 'Termination unconfirmed',
        statusType: 'unconfirmed',
        summaryExplanation: 'Termination signal was dispatched, but process exit was not verified before deadline.',
        fullTechnicalAction: 'TERMINATE_ATTEMPTED',
        isSuccessful: false,
      }

    case 'CONTAINED':
    case 'QUARANTINED':
      return {
        badgeLabel: 'Restriction applied',
        statusType: 'contained',
        summaryExplanation: 'Application was restricted and closed in containment mode.',
        fullTechnicalAction: action,
        isSuccessful: true,
      }

    case 'CONTAINMENT_FAILED':
      return {
        badgeLabel: 'Enforcement failed',
        statusType: 'failed',
        summaryExplanation: 'Application did not respond to containment signal and remains active.',
        fullTechnicalAction: 'CONTAINMENT_FAILED',
        isSuccessful: false,
      }

    case 'WARNED':
      return {
        badgeLabel: 'Warning issued',
        statusType: 'warned',
        summaryExplanation: reason.includes('[WARNING_EXPIRED]')
          ? 'Warning decision window expired; authorization escalated to enforcement.'
          : 'Interactive discipline warning displayed with grace period countdown.',
        fullTechnicalAction: 'WARNED',
        isSuccessful: true,
      }

    case 'GRACE_ACTIVE':
    case 'GRANT_GRACE':
      return {
        badgeLabel: 'Grace period active',
        statusType: 'grace',
        summaryExplanation: 'Temporary research recess approved by user for study resources.',
        fullTechnicalAction: action,
        isSuccessful: true,
      }

    case 'REJECTED':
      return {
        badgeLabel: 'Permission denied',
        statusType: 'denied',
        summaryExplanation: 'Target is a core operating system process; action was rejected for workstation safety.',
        fullTechnicalAction: 'REJECTED',
        isSuccessful: false,
      }

    default:
      return {
        badgeLabel: action ? action.replace(/_/g, ' ') : 'Event logged',
        statusType: 'neutral',
        summaryExplanation: reason
          ? reason.replace(/\[.*?\]/g, '').trim() || 'Process inspected by Sentinel policy engine.'
          : 'Process inspected by Sentinel policy engine.',
        fullTechnicalAction: action || 'INSPECTED',
        isSuccessful: false,
      }
  }
}

export type ProtectionStatusKey =
  | 'ACTIVE_DEFENSE'
  | 'STANDBY'
  | 'READY'
  | 'DEGRADED'
  | 'DISCONNECTED'

export interface ProtectionStatusInfo {
  statusKey: ProtectionStatusKey
  badgeText: string
  badgeVariant: 'active' | 'standby' | 'ready' | 'degraded' | 'offline'
  headline: string
  description: string
  shieldConnected: boolean
  mode: string
  isPolicyLocked: boolean
  activeSessionName: string | null
}

/**
 * Derives honest overall protection health based on real session state,
 * daemon heartbeat connectivity, and enforcement mode.
 */
export function deriveOverallProtectionStatus(sentinelStatus: SentinelStatus | null): ProtectionStatusInfo {
  const isSessionActive = Boolean(sentinelStatus?.activeFocusSessionId)
  const shieldConnected = Boolean(sentinelStatus?.daemonConnected)
  const mode = sentinelStatus?.enforcementMode || 'STRICT'
  const isPolicyLocked = Boolean(sentinelStatus?.isPolicyLocked)
  const activeSessionName = sentinelStatus?.activeFocusSessionName || null

  if (isSessionActive) {
    if (shieldConnected) {
      return {
        statusKey: 'ACTIVE_DEFENSE',
        badgeText: 'Active Defense',
        badgeVariant: 'active',
        headline: activeSessionName ? `Protecting: "${activeSessionName}"` : 'Active Focus Session Protected',
        description: 'Native Shield daemon is actively defending workstation against distraction applications.',
        shieldConnected: true,
        mode,
        isPolicyLocked,
        activeSessionName,
      }
    }
    return {
      statusKey: 'DEGRADED',
      badgeText: 'Degraded',
      badgeVariant: 'degraded',
      headline: 'Shield Daemon Offline',
      description: 'A focus session is active, but the native Shield daemon heartbeat is absent. Real-time enforcement is degraded.',
      shieldConnected: false,
      mode,
      isPolicyLocked,
      activeSessionName,
    }
  }

  if (shieldConnected) {
    const rawStatus = sentinelStatus?.status?.toUpperCase() || ''
    if (rawStatus === 'STANDBY') {
      return {
        statusKey: 'STANDBY',
        badgeText: 'Standby',
        badgeVariant: 'standby',
        headline: 'Standby (Upcoming Sprint)',
        description: 'Daemon heartbeat verified. Shield is ready to arm protection when scheduled session starts.',
        shieldConnected: true,
        mode,
        isPolicyLocked,
        activeSessionName: null,
      }
    }
    return {
      statusKey: 'READY',
      badgeText: 'Ready',
      badgeVariant: 'ready',
      headline: 'Ready (Passive Standby)',
      description: 'No active focus session. Workstation monitored in passive telemetry standby.',
      shieldConnected: true,
      mode,
      isPolicyLocked,
      activeSessionName: null,
    }
  }

  return {
    statusKey: 'DISCONNECTED',
    badgeText: 'Shield Offline',
    badgeVariant: 'offline',
    headline: 'Native Shield Disconnected',
    description: 'Native Sentinel daemon is not communicating with backend. Real-time process defense is unavailable.',
    shieldConnected: false,
    mode,
    isPolicyLocked,
    activeSessionName: null,
  }
}

export interface GroupedQuarantineItem {
  groupKey: string
  processName: string
  policyAction: string
  count: number
  primaryItem: SentinelQuarantineItem
  allPids: number[]
  items: SentinelQuarantineItem[]
}

/**
 * Groups consecutive or repeated quarantine events for the same application and action,
 * keeping the list clean and readable while preserving every individual audit record.
 */
export function groupQuarantineEvents(items: SentinelQuarantineItem[]): GroupedQuarantineItem[] {
  if (!items || items.length === 0) return []

  const groups: GroupedQuarantineItem[] = []
  const groupMap = new Map<string, GroupedQuarantineItem>()

  for (const item of items) {
    const key = `${item.processName.toLowerCase()}__${(item.policyAction || '').toUpperCase()}`
    const existing = groupMap.get(key)
    if (existing) {
      existing.count += 1
      existing.items.push(item)
      if (!existing.allPids.includes(item.pid)) {
        existing.allPids.push(item.pid)
      }
    } else {
      const newGroup: GroupedQuarantineItem = {
        groupKey: key,
        processName: item.processName,
        policyAction: item.policyAction,
        count: 1,
        primaryItem: item,
        allPids: [item.pid],
        items: [item],
      }
      groupMap.set(key, newGroup)
      groups.push(newGroup)
    }
  }

  return groups
}

