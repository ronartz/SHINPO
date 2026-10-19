import test from 'node:test'
import assert from 'node:assert/strict'
import { getSortedScheduleSessions, getSessionSecondaryInfo } from '../../utils/scheduleHelpers.ts'
import type { FocusSession } from '../../api/focusSessions'

test('getSortedScheduleSessions prioritizes active/paused first, then scheduled, then completed', () => {
  const dummySessions = [
    { id: 1, name: 'Task 1', durationMinutes: 25, status: 'COMPLETED' },
    { id: 2, name: 'Task 2', durationMinutes: 30, status: 'SCHEDULED', scheduledAt: '2026-10-19T14:00:00Z' },
    { id: 3, name: 'Task 3', durationMinutes: 45, status: 'ACTIVE' },
    { id: 4, name: 'Task 4', durationMinutes: 20, status: 'SCHEDULED', scheduledAt: '2026-10-19T11:00:00Z' },
  ] as FocusSession[]

  const sorted = getSortedScheduleSessions(dummySessions)
  assert.equal(sorted.length, 4)
  // Active must come first
  assert.equal(sorted[0].id, 3)
  // Scheduled ordered by time (11:00 before 14:00)
  assert.equal(sorted[1].id, 4)
  assert.equal(sorted[2].id, 2)
  // Completed comes last
  assert.equal(sorted[3].id, 1)
})

test('getSessionSecondaryInfo never duplicates session name', () => {
  const sessionWithDuplicateIntention = {
    id: 10,
    name: 'Learn Spring Boot Authentication',
    intention: 'Learn Spring Boot Authentication',
    durationMinutes: 45,
    status: 'SCHEDULED',
    scheduledAt: '2026-10-19T15:30:00Z',
  } as FocusSession

  const secondary = getSessionSecondaryInfo(sessionWithDuplicateIntention)
  // Must NOT include the duplicated intention string
  assert.ok(!secondary.includes('• Learn Spring Boot Authentication'))
  assert.ok(secondary.includes('Scheduled for'))
})

test('getSessionSecondaryInfo formats active and paused states distinctly', () => {
  const activeSession = {
    id: 1,
    name: 'Deep Work',
    durationMinutes: 50,
    status: 'ACTIVE',
  } as FocusSession
  const pausedSession = {
    id: 2,
    name: 'Deep Work',
    durationMinutes: 50,
    status: 'PAUSED',
  } as FocusSession

  assert.equal(getSessionSecondaryInfo(activeSession), 'In Progress • Focus Sprint Active')
  assert.equal(getSessionSecondaryInfo(pausedSession), 'Paused • Ready to resume')
})

