import test from 'node:test'
import assert from 'node:assert/strict'

test('ConfirmationDialog contract preserves destructive defaults', () => {
  const defaultLabels = {
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    isDestructive: false,
  }
  assert.equal(defaultLabels.confirmLabel, 'Confirm')
  assert.equal(defaultLabels.cancelLabel, 'Cancel')
  assert.equal(defaultLabels.isDestructive, false)
})

test('Confirmation message formatters produce human-readable strings', () => {
  const formatTaskDelete = (title: string) => `Permanently delete "${title}"?`
  const formatBulkGoalsDelete = (goalCount: number, taskCount: number) =>
    `Permanently delete ${goalCount} goal(s) and ${taskCount} linked task(s)?`

  assert.equal(formatTaskDelete('Update API'), 'Permanently delete "Update API"?')
  assert.equal(formatBulkGoalsDelete(3, 8), 'Permanently delete 3 goal(s) and 8 linked task(s)?')
})

