import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  toSafeIsoString,
  formatSafeTimeString,
  normalizeFocusSessionEvent,
  normalizeSentinelStatusEvent,
  normalizeSentinelQuarantineEvent,
} from './eventNormalizer.ts'

describe('eventNormalizer - defensive data sanitation', () => {
  describe('toSafeIsoString', () => {
    it('returns a valid ISO string when input is null or undefined', () => {
      const resNull = toSafeIsoString(null)
      const resUndef = toSafeIsoString(undefined)
      assert.ok(!isNaN(new Date(resNull).getTime()))
      assert.ok(!isNaN(new Date(resUndef).getTime()))
    })

    it('returns valid ISO string when input is a timestamp number', () => {
      const now = Date.now()
      const res = toSafeIsoString(now)
      assert.strictEqual(new Date(res).getTime(), now)
    })

    it('returns valid ISO string for ISO input', () => {
      const iso = '2026-10-15T10:00:00.000Z'
      assert.strictEqual(toSafeIsoString(iso), iso)
    })

    it('falls back gracefully on garbage string without throwing or returning Invalid Date', () => {
      const res = toSafeIsoString('not-a-valid-date-ever')
      assert.ok(!isNaN(new Date(res).getTime()))
      assert.notStrictEqual(res, 'Invalid Date')
    })
  })

  describe('formatSafeTimeString', () => {
    it('never outputs "Invalid Date" for null, undefined, or garbage', () => {
      assert.notStrictEqual(formatSafeTimeString(null), 'Invalid Date')
      assert.notStrictEqual(formatSafeTimeString(undefined), 'Invalid Date')
      assert.notStrictEqual(formatSafeTimeString('garbage text'), 'Invalid Date')
      assert.notStrictEqual(formatSafeTimeString(''), 'Invalid Date')
    })

    it('preserves already localized time strings', () => {
      assert.strictEqual(formatSafeTimeString('12:13:10 AM'), '12:13:10 AM')
      assert.strictEqual(formatSafeTimeString('09:45 PM'), '09:45 PM')
    })

    it('formats ISO timestamps properly', () => {
      const iso = '2026-10-15T12:00:00.000Z'
      const formatted = formatSafeTimeString(iso)
      assert.ok(formatted.length >= 7)
      assert.notStrictEqual(formatted, 'Invalid Date')
    })
  })

  describe('normalizeFocusSessionEvent', () => {
    it('handles backend payload with sessionId and durationMinutes', () => {
      const raw = {
        sessionId: 42,
        sessionName: 'Backend Sprint',
        status: 'ACTIVE',
        durationMinutes: 45,
        intention: 'Deep code',
        startedAt: '2026-10-15T12:00:00.000Z',
      }
      const norm = normalizeFocusSessionEvent(raw)
      assert.strictEqual(norm.id, 42)
      assert.strictEqual(norm.plannedDurationMinutes, 45)
      assert.strictEqual(norm.status, 'ACTIVE')
      assert.strictEqual(norm.debriefNotes, 'Deep code')
      assert.ok(!isNaN(new Date(norm.timestamp).getTime()))
    })

    it('handles frontend-shaped payload with id and plannedDurationMinutes', () => {
      const raw = {
        id: 99,
        status: 'PAUSED',
        plannedDurationMinutes: 30,
      }
      const norm = normalizeFocusSessionEvent(raw)
      assert.strictEqual(norm.id, 99)
      assert.strictEqual(norm.plannedDurationMinutes, 30)
      assert.strictEqual(norm.status, 'PAUSED')
    })

    it('handles empty or malformed objects with safe defaults', () => {
      const norm = normalizeFocusSessionEvent({})
      assert.strictEqual(norm.id, 0)
      assert.strictEqual(norm.plannedDurationMinutes, 25)
      assert.strictEqual(norm.status, 'UNKNOWN')
      assert.notStrictEqual(norm.timestamp, 'Invalid Date')
    })
  })

  describe('normalizeSentinelStatusEvent', () => {
    it('normalizes backend enforcementMode and policyLocked', () => {
      const raw = {
        userId: 1,
        enforcementMode: 'STRICT',
        policyLocked: true,
        blockedCount: 5,
        allowedCount: 12,
      }
      const norm = normalizeSentinelStatusEvent(raw)
      assert.strictEqual(norm.mode, 'STRICT')
      assert.strictEqual(norm.isLocked, true)
      assert.strictEqual(norm.blockedCount, 5)
      assert.strictEqual(norm.allowedCount, 12)
    })

    it('normalizes frontend mode and isLocked', () => {
      const raw = {
        userId: 1,
        mode: 'PERMISSIVE',
        isLocked: false,
        blockedCount: 2,
        allowedCount: 8,
      }
      const norm = normalizeSentinelStatusEvent(raw)
      assert.strictEqual(norm.mode, 'PERMISSIVE')
      assert.strictEqual(norm.isLocked, false)
    })
  })

  describe('normalizeSentinelQuarantineEvent', () => {
    it('normalizes backend quarantine record properly', () => {
      const raw = {
        id: 77,
        sessionId: 10,
        pid: 12345,
        processName: 'steam',
        policyAction: 'TERMINATED',
        reason: 'Gaming process blocked',
      }
      const norm = normalizeSentinelQuarantineEvent(raw)
      assert.strictEqual(norm.id, 77)
      assert.strictEqual(norm.focusSessionId, 10)
      assert.strictEqual(norm.pid, 12345)
      assert.strictEqual(norm.processName, 'steam')
      assert.strictEqual(norm.enforcementAction, 'TERMINATED')
      assert.strictEqual(norm.reason, 'Gaming process blocked')
    })
  })
})

