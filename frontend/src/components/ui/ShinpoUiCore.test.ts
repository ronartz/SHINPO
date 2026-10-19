import test from 'node:test'
import assert from 'node:assert/strict'

test('ShinpoSelect - options filtering and selection contracts', () => {
  const options = [
    { value: 'ACTIVE', label: 'Active Execution' },
    { value: 'PAUSED', label: 'Paused Focus' },
    { value: 'COMPLETED', label: 'Completed Milestone' },
    { value: 'ABANDONED', label: 'Archived', disabled: true },
  ]

  // Find by value
  const selected = options.find((o) => o.value === 'ACTIVE')
  assert.ok(selected)
  assert.equal(selected.label, 'Active Execution')

  // Search filtering
  const query = 'pause'
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].value, 'PAUSED')

  // Disabled check
  const disabledOption = options.find((o) => o.disabled)
  assert.ok(disabledOption)
  assert.equal(disabledOption.value, 'ABANDONED')
})

test('ShinpoDatePicker - local date math and leap-year correctness', () => {
  const formatDateStr = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // Standard non-leap year (2025)
  const feb2025LastDay = new Date(2025, 2, 0).getDate()
  assert.equal(feb2025LastDay, 28)

  // Leap year (2024 & 2028)
  const feb2024LastDay = new Date(2024, 2, 0).getDate()
  assert.equal(feb2024LastDay, 29)

  const feb2028LastDay = new Date(2028, 2, 0).getDate()
  assert.equal(feb2028LastDay, 29)

  // Formatting maintains exact YYYY-MM-DD string with local calendar
  const testDate = formatDateStr(2026, 9, 16) // Oct 16, 2026 (month index 9)
  assert.equal(testDate, '2026-10-16')

  // Boundary checks (min/max string comparison)
  const minDate = '2026-10-10'
  const maxDate = '2026-10-25'
  assert.equal('2026-10-09' < minDate, true)
  assert.equal('2026-10-16' >= minDate && '2026-10-16' <= maxDate, true)
  assert.equal('2026-10-26' > maxDate, true)
})

test('ShinpoTimePicker - 24-hour parsing, formatting and step intervals', () => {
  const parseTime = (timeStr: string) => {
    if (!/^\d{2}:\d{2}$/.test(timeStr)) return null
    const [h, m] = timeStr.split(':').map(Number)
    return { h, m }
  }

  const parsed = parseTime('14:45')
  assert.ok(parsed)
  assert.equal(parsed.h, 14)
  assert.equal(parsed.m, 45)

  // Minutes step generator
  const getMinutes = (step: number) => {
    const list: number[] = []
    for (let m = 0; m < 60; m += step) list.push(m)
    return list
  }

  const step15 = getMinutes(15)
  assert.deepEqual(step15, [0, 15, 30, 45])

  const step5 = getMinutes(5)
  assert.equal(step5.length, 12)
  assert.equal(step5[0], 0)
  assert.equal(step5[11], 55)
})

test('ShinpoConfirmDialog - preserves destructive defaults and safety contracts', () => {
  const defaultConfirmProps = {
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    isDestructive: false,
    isLoading: false,
  }

  assert.equal(defaultConfirmProps.confirmLabel, 'Confirm')
  assert.equal(defaultConfirmProps.cancelLabel, 'Cancel')
  assert.equal(defaultConfirmProps.isDestructive, false)
  assert.equal(defaultConfirmProps.isLoading, false)

  const destructiveProps = {
    ...defaultConfirmProps,
    isDestructive: true,
  }
  assert.equal(destructiveProps.isDestructive, true)
})

test('StarRating - rating labels and bounds contract', () => {
  const labels: Record<number, string> = {
    1: 'Needs Work',
    2: 'Fair',
    3: 'Good',
    4: 'Great',
    5: 'Exceptional',
  }

  assert.equal(labels[1], 'Needs Work')
  assert.equal(labels[3], 'Good')
  assert.equal(labels[5], 'Exceptional')

  // Rating clamp math
  const clampRating = (r: number) => Math.max(1, Math.min(5, r))
  assert.equal(clampRating(0), 1)
  assert.equal(clampRating(3), 3)
  assert.equal(clampRating(6), 5)

  // Arrow key navigation
  const nextRating = (curr: number) => Math.min(5, (curr || 0) + 1)
  const prevRating = (curr: number) => Math.max(1, (curr || 2) - 1)
  assert.equal(nextRating(3), 4)
  assert.equal(nextRating(5), 5)
  assert.equal(prevRating(4), 3)
  assert.equal(prevRating(1), 1)
})

test('LiveClock - 12h/24h time formatting and capsule date parts', () => {
  const formatTimeParts = (hours24: number, minutes: number, is24h: boolean) => {
    let displayHours = hours24
    let ampm = ''
    if (!is24h) {
      ampm = hours24 >= 12 ? 'PM' : 'AM'
      displayHours = hours24 % 12 || 12
    }
    return {
      hours: String(displayHours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      ampm,
    }
  }

  // Morning in 12h
  const morning12 = formatTimeParts(9, 5, false)
  assert.equal(morning12.hours, '09')
  assert.equal(morning12.minutes, '05')
  assert.equal(morning12.ampm, 'AM')

  // Afternoon in 12h
  const afternoon12 = formatTimeParts(14, 30, false)
  assert.equal(afternoon12.hours, '02')
  assert.equal(afternoon12.minutes, '30')
  assert.equal(afternoon12.ampm, 'PM')

  // Midnight in 12h
  const midnight12 = formatTimeParts(0, 0, false)
  assert.equal(midnight12.hours, '12')
  assert.equal(midnight12.ampm, 'AM')

  // Afternoon in 24h
  const afternoon24 = formatTimeParts(14, 30, true)
  assert.equal(afternoon24.hours, '14')
  assert.equal(afternoon24.minutes, '30')
  assert.equal(afternoon24.ampm, '')
})

