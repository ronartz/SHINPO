import test from 'node:test'
import assert from 'node:assert/strict'
import { getRewardAnnouncement } from './progress.ts'

test('getRewardAnnouncement formats distinct event announcements accurately', () => {
  const sessionReward = getRewardAnnouncement('FOCUS_SESSION_COMPLETED', 15)
  assert.equal(sessionReward.headline, '+15 XP Earned • Focus Sprint Logged')
  assert.equal(sessionReward.detail, 'Deep focus period successfully completed and persisted.')

  const deepSessionReward = getRewardAnnouncement('FOCUS_SESSION_COMPLETED', 25)
  assert.equal(deepSessionReward.headline, '+25 XP Earned • Focus Sprint Logged')

  const taskReward = getRewardAnnouncement('MISSION_COMPLETED', 10)
  assert.equal(taskReward.headline, '+10 XP Earned • Task Completed')
  assert.equal(taskReward.detail, 'Execution objective achieved.')

  const goalReward = getRewardAnnouncement('GOAL_COMPLETED', 50)
  assert.equal(goalReward.headline, '+50 XP Earned • Goal Concluded')

  const streakReward = getRewardAnnouncement('STREAK_MILESTONE', 25)
  assert.equal(streakReward.headline, '+25 XP Earned • Consistency Milestone')

  const genericReward = getRewardAnnouncement('CUSTOM_EVENT', 5)
  assert.equal(genericReward.headline, '+5 Progress Points Earned')
})

