import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mapEnforcementOutcome,
  deriveOverallProtectionStatus,
  groupQuarantineEvents,
} from './focusProtectionStatus.ts'
import type { SentinelStatus, SentinelQuarantineItem } from '../api/device'

test('mapEnforcementOutcome - distinguishes confirmed termination from attempted unconfirmed', () => {
  const confirmed = mapEnforcementOutcome('TERMINATED')
  assert.equal(confirmed.badgeLabel, 'Termination confirmed')
  assert.equal(confirmed.statusType, 'confirmed')
  assert.equal(confirmed.isSuccessful, true)

  const unconfirmed = mapEnforcementOutcome('TERMINATE_ATTEMPTED')
  assert.equal(unconfirmed.badgeLabel, 'Termination unconfirmed')
  assert.equal(unconfirmed.statusType, 'unconfirmed')
  assert.equal(unconfirmed.isSuccessful, false)

  const contained = mapEnforcementOutcome('CONTAINED')
  assert.equal(contained.badgeLabel, 'Restriction applied')
  assert.equal(contained.statusType, 'contained')
  assert.equal(contained.isSuccessful, true)

  const failed = mapEnforcementOutcome('CONTAINMENT_FAILED')
  assert.equal(failed.badgeLabel, 'Enforcement failed')
  assert.equal(failed.statusType, 'failed')
  assert.equal(failed.isSuccessful, false)

  const warned = mapEnforcementOutcome('WARNED')
  assert.equal(warned.badgeLabel, 'Warning issued')
  assert.equal(warned.statusType, 'warned')

  const grace = mapEnforcementOutcome('GRACE_ACTIVE')
  assert.equal(grace.badgeLabel, 'Grace period active')
  assert.equal(grace.statusType, 'grace')

  const denied = mapEnforcementOutcome('REJECTED')
  assert.equal(denied.badgeLabel, 'Permission denied')
  assert.equal(denied.statusType, 'denied')
  assert.equal(denied.isSuccessful, false)
})

test('deriveOverallProtectionStatus - derives honest operational status from daemon connectivity and active session', () => {
  // Case 1: Active session with connected shield
  const activeDefending: SentinelStatus = {
    status: 'ACTIVE_DEFENSE',
    activeFocusSessionId: 101,
    activeFocusSessionName: 'Sprint Alpha',
    enforcementMode: 'STRICT',
    totalInterceptedToday: 4,
    activePolicyRulesCount: 2,
    daemonConnected: true,
    recentQuarantines: [],
    lastSweepAt: null,
  }
  const s1 = deriveOverallProtectionStatus(activeDefending)
  assert.equal(s1.statusKey, 'ACTIVE_DEFENSE')
  assert.equal(s1.badgeText, 'Native Defense')
  assert.equal(s1.badgeVariant, 'active')
  assert.equal(s1.shieldConnected, true)

  // Case 2: Active session with disconnected shield -> Degraded!
  const degraded: SentinelStatus = {
    ...activeDefending,
    daemonConnected: false,
  }
  const s2 = deriveOverallProtectionStatus(degraded)
  assert.equal(s2.statusKey, 'DEGRADED')
  assert.equal(s2.badgeText, 'Degraded')
  assert.equal(s2.badgeVariant, 'degraded')
  assert.equal(s2.shieldConnected, false)

  // Case 3: No active session with connected shield -> Ready
  const ready: SentinelStatus = {
    ...activeDefending,
    activeFocusSessionId: null,
    activeFocusSessionName: null,
    status: 'READY',
  }
  const s3 = deriveOverallProtectionStatus(ready)
  assert.equal(s3.statusKey, 'READY')
  assert.equal(s3.badgeText, 'Native Shield Ready')
  assert.equal(s3.badgeVariant, 'ready')
  assert.equal(s3.shieldConnected, true)

  // Case 4: No active session, disconnected shield -> Offline
  const offline: SentinelStatus = {
    ...ready,
    daemonConnected: false,
    status: 'UNAVAILABLE',
  }
  const s4 = deriveOverallProtectionStatus(offline)
  assert.equal(s4.statusKey, 'DISCONNECTED')
  assert.equal(s4.badgeText, 'Shield Offline')
  assert.equal(s4.badgeVariant, 'offline')
  assert.equal(s4.shieldConnected, false)

  // Case 5: Null input -> Offline
  const s5 = deriveOverallProtectionStatus(null)
  assert.equal(s5.statusKey, 'DISCONNECTED')
  assert.equal(s5.shieldConnected, false)

  // Case 6: AUDIT_ONLY mode maps truth-first without conflicting "Ready" messaging
  const auditOnlyStatus: SentinelStatus = {
    ...ready,
    enforcementMode: 'AUDIT_ONLY',
  }
  const s6 = deriveOverallProtectionStatus(auditOnlyStatus)
  assert.equal(s6.badgeText, 'Native Monitoring')
  assert.equal(s6.mode, 'Monitoring Only')
  assert.equal(s6.headline, 'Monitoring Only (Passive)')

  const activeMonitoring = deriveOverallProtectionStatus({
    ...activeDefending,
    enforcementMode: 'AUDIT_ONLY',
  })
  assert.equal(activeMonitoring.badgeText, 'Native Monitoring')
  assert.match(activeMonitoring.description, /no applications will be terminated/i)

  const staleActiveState = deriveOverallProtectionStatus({
    ...activeDefending,
    daemonConnected: false,
  })
  assert.equal(staleActiveState.statusKey, 'DEGRADED')
  assert.equal(staleActiveState.shieldConnected, false)
})

test('groupQuarantineEvents - groups repeated events while preserving all records and PIDs', () => {
  const items: SentinelQuarantineItem[] = [
    {
      id: 1,
      focusSessionId: 10,
      pid: 1001,
      processName: 'discord',
      commandLine: '/usr/bin/discord',
      policyAction: 'TERMINATED',
      enforcementMode: 'STRICT',
      reason: '[STRICT_ENFORCEMENT] Target process in blocklist',
      detectedAt: '2026-10-16T10:00:00Z',
    },
    {
      id: 2,
      focusSessionId: 10,
      pid: 1002,
      processName: 'discord',
      commandLine: '/usr/bin/discord',
      policyAction: 'TERMINATED',
      enforcementMode: 'STRICT',
      reason: '[STRICT_ENFORCEMENT] Target process in blocklist',
      detectedAt: '2026-10-16T10:01:00Z',
    },
    {
      id: 3,
      focusSessionId: 10,
      pid: 2001,
      processName: 'spotify',
      commandLine: '/usr/bin/spotify',
      policyAction: 'TERMINATE_ATTEMPTED',
      enforcementMode: 'STRICT',
      reason: '[STRICT_ENFORCEMENT] Target process in blocklist',
      detectedAt: '2026-10-16T10:02:00Z',
    },
  ]

  const grouped = groupQuarantineEvents(items)
  assert.equal(grouped.length, 2)

  // First group: discord TERMINATED (2 events)
  const discordGroup = grouped.find((g) => g.processName === 'discord')
  assert.ok(discordGroup)
  assert.equal(discordGroup.count, 2)
  assert.deepEqual(discordGroup.allPids, [1001, 1002])
  assert.equal(discordGroup.items.length, 2)

  // Second group: spotify TERMINATE_ATTEMPTED (1 event)
  const spotifyGroup = grouped.find((g) => g.processName === 'spotify')
  assert.ok(spotifyGroup)
  assert.equal(spotifyGroup.count, 1)
  assert.deepEqual(spotifyGroup.allPids, [2001])
})
