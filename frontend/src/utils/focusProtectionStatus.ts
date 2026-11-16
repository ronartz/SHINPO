import type { SentinelStatus, SentinelQuarantineItem } from '../api/device'
import { guardianCapabilityLabel, guardianModeLabel } from './guardianCapability.ts'

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
 * Formats backend technical enforcement mode strings into human-readable user labels.
 * Specifically maps AUDIT_ONLY to "Monitoring Only" and CONTAINMENT to "Containment".
 */
export function formatEnforcementMode(mode?: string | null): string {
  if (!mode) return 'Status unavailable'
  const normalized = mode.trim().toUpperCase()
  if (normalized === 'AUDIT_ONLY') return 'Monitoring Only'
  if (normalized === 'CONTAINMENT') return 'Containment'
  if (normalized === 'STRICT') return 'Strict'
  return 'Configured mode'
}

/**
 * Derives honest overall protection health based on real session state,
 * daemon heartbeat connectivity, and enforcement mode.
 */
export function deriveOverallProtectionStatus(sentinelStatus: SentinelStatus | null): ProtectionStatusInfo {
  if (sentinelStatus?.interventionCapability !== undefined) {
    const mode = guardianModeLabel(sentinelStatus.guardianMode)
    const capability = guardianCapabilityLabel(sentinelStatus.interventionCapability)
    const sessionName = sentinelStatus.activeFocusSessionName || null
    const isActive = sentinelStatus.status === 'ACTIVE'

    if (sentinelStatus.interventionCapability === 'LOCKED') {
      return {
        statusKey: 'DISCONNECTED', badgeText: 'Vault Locked', badgeVariant: 'offline',
        headline: 'Guardian unavailable', description: 'Unlock the local vault to view Guardian status.',
        shieldConnected: false, mode, isPolicyLocked: false, activeSessionName: null,
      }
    }
    if (sentinelStatus.observerStatus === 'DEGRADED') {
      return {
        statusKey: 'DEGRADED', badgeText: 'Observer unavailable', badgeVariant: 'degraded',
        headline: 'App observer unavailable', description: `${capability}. No application action is taken while the observer is unavailable.`,
        shieldConnected: false, mode, isPolicyLocked: Boolean(sentinelStatus.isPolicyLocked), activeSessionName: sessionName,
      }
    }
    if (sentinelStatus.status === 'STANDBY') {
      return {
        statusKey: 'STANDBY', badgeText: 'Focus paused', badgeVariant: 'standby',
        headline: 'Guardian paused with Focus', description: 'App observation and intervention are paused with this Focus session.',
        shieldConnected: false, mode, isPolicyLocked: Boolean(sentinelStatus.isPolicyLocked), activeSessionName: null,
      }
    }
    if (isActive && sentinelStatus.interventionCapability === 'MONITORING_DISABLED') {
      return {
        statusKey: 'READY', badgeText: 'App observation off', badgeVariant: 'standby',
        headline: 'App observation is off', description: 'This Focus session is not observing applications. Website restrictions require a connected Browser Companion.',
        shieldConnected: false, mode, isPolicyLocked: Boolean(sentinelStatus.isPolicyLocked), activeSessionName: sessionName,
      }
    }
    if (isActive && sentinelStatus.observerStatus === 'MONITORING') {
      return {
        statusKey: 'READY', badgeText: 'Observing apps', badgeVariant: 'ready',
        headline: sessionName ? `Focus: "${sessionName}"` : 'Focus is active',
        description: `${capability}. Website restrictions require a connected Browser Companion.`,
        shieldConnected: true, mode, isPolicyLocked: Boolean(sentinelStatus.isPolicyLocked), activeSessionName: sessionName,
      }
    }
    if (isActive) {
      return {
        statusKey: 'READY', badgeText: 'Observer starting', badgeVariant: 'standby',
        headline: 'Guardian is starting', description: `${capability}. No app action is taken until observation is available.`,
        shieldConnected: false, mode, isPolicyLocked: Boolean(sentinelStatus.isPolicyLocked), activeSessionName: sessionName,
      }
    }
    return {
      statusKey: 'READY', badgeText: 'Guardian idle', badgeVariant: 'ready',
      headline: 'Guardian ready when Focus starts',
      description: 'App observation starts only during an opted-in Focus session. Website policy requires a connected Browser Companion.',
      shieldConnected: false, mode, isPolicyLocked: Boolean(sentinelStatus.isPolicyLocked), activeSessionName: null,
    }
  }
  if (sentinelStatus?.warningOnly) {
    const connected = Boolean(sentinelStatus.daemonConnected)
    const active = sentinelStatus.status === 'ACTIVE'
    const paused = sentinelStatus.status === 'STANDBY'
    const name = sentinelStatus.activeFocusSessionName || null
    const mode = sentinelStatus.guardianMode || 'Standard'
    if (!connected) {
      return {
        statusKey: 'DISCONNECTED',
        badgeText: 'Vault Locked',
        badgeVariant: 'offline',
        headline: 'Guardian Paused',
        description: 'Automatic Guardian is paused while the encrypted vault is locked.',
        shieldConnected: false,
        mode: 'Warning only',
        isPolicyLocked: false,
        activeSessionName: null,
      }
    }
    if (active) {
      return {
        statusKey: 'ACTIVE_DEFENSE',
        badgeText: 'Guardian Monitoring',
        badgeVariant: 'active',
        headline: name ? `Monitoring Focus: "${name}"` : 'Guardian Monitoring',
        description: `Automatic ${mode} mode records recognized distracting app names in the encrypted vault. Apps are never closed; website restrictions depend on the Browser Companion connection.`,
        shieldConnected: true,
        mode: `${mode} · warning only`,
        isPolicyLocked: Boolean(sentinelStatus.isPolicyLocked),
        activeSessionName: name,
      }
    }
    return {
      statusKey: paused ? 'STANDBY' : 'READY',
      badgeText: paused ? 'Focus Paused' : 'Guardian Ready',
      badgeVariant: 'standby',
      headline: paused ? 'Guardian Paused with Focus' : 'Guardian Ready',
      description: paused
        ? 'App observation is paused with the Focus session. No applications are closed.'
        : 'App observation starts with a Focus session. Website policy is managed separately by the Browser Companion.',
      shieldConnected: true,
      mode: `${mode} · warning only`,
      isPolicyLocked: Boolean(sentinelStatus.isPolicyLocked),
      activeSessionName: null,
    }
  }
  const isSessionActive = Boolean(sentinelStatus?.activeFocusSessionId)
  const shieldConnected = Boolean(sentinelStatus?.daemonConnected)
  const rawMode = sentinelStatus?.enforcementMode || 'UNKNOWN'
  const isAuditOnly = rawMode.toUpperCase() === 'AUDIT_ONLY'
  const mode = formatEnforcementMode(rawMode)
  const isPolicyLocked = Boolean(sentinelStatus?.isPolicyLocked)
  const activeSessionName = sentinelStatus?.activeFocusSessionName || null

  if (isSessionActive) {
    if (shieldConnected) {
      return {
        statusKey: 'ACTIVE_DEFENSE',
        badgeText: isAuditOnly ? 'Native Monitoring' : 'Native Defense',
        badgeVariant: 'active',
        headline: activeSessionName ? `Protecting: "${activeSessionName}"` : 'Active Focus Session Protected',
        description: isAuditOnly
          ? 'Focus session active in Monitoring Only mode. Workstation activity is logged; no applications will be terminated.'
          : 'Native Shield daemon is enforcing workstation application policies. Browser protection is reported separately.',
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
        badgeText: isAuditOnly ? 'Native Monitoring' : 'Native Shield Standby',
        badgeVariant: 'standby',
        headline: 'Standby (Upcoming Sprint)',
        description: isAuditOnly
          ? 'Daemon heartbeat verified. Shield is ready in Monitoring Only mode when scheduled session starts.'
          : 'Daemon heartbeat verified. Shield is ready to arm protection when scheduled session starts.',
        shieldConnected: true,
        mode,
        isPolicyLocked,
        activeSessionName: null,
      }
    }
    return {
      statusKey: 'READY',
      badgeText: isAuditOnly ? 'Native Monitoring' : 'Native Shield Ready',
      badgeVariant: isAuditOnly ? 'standby' : 'ready',
      headline: isAuditOnly ? 'Monitoring Only (Passive)' : 'Ready (Passive Standby)',
      description: isAuditOnly
        ? 'No active focus session. Workstation is in passive telemetry monitoring mode; applications will not be terminated.'
        : 'No active focus session. Native Shield is in passive workstation standby; browser protection is reported separately.',
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

