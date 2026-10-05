/**
 * Dynamic SHINPO Execution & Motivational Messages
 *
 * Designed to embody the core identity of SHINPO:
 * - Decisive execution over hesitation
 * - Relentless small daily progress
 * - Focused attention vs distributed distraction
 * - Clean stoic discipline without patronizing cheerleading
 *
 * Supports:
 * - Daily rotation based on local calendar date
 * - Session/restart offset rotation
 * - Manual inline cycle/refresh
 */

export interface ShinpoMessage {
  id: number
  text: string
  subtext?: string
}

export const SHINPO_MESSAGES: readonly ShinpoMessage[] = [
  { id: 1, text: "Decide what matters. Then execute." },
  { id: 2, text: "Make progress before you make excuses." },
  { id: 3, text: "One focused hour beats a distracted afternoon." },
  { id: 4, text: "Small progress is still progress." },
  { id: 5, text: "Start with the next meaningful action." },
  { id: 6, text: "Clarity follows action, not endless contemplation." },
  { id: 7, text: "Protect your attention. It is your only non-renewable capital." },
  { id: 8, text: "Finish the current sprint before opening the next idea." },
  { id: 9, text: "Discipline is choosing between what you want now and what you want most." },
  { id: 10, text: "Eliminate friction. Begin the first minute." },
  { id: 11, text: "High friction today builds low effort tomorrow." },
  { id: 12, text: "A sprint completed is better than a grand vision untouched." },
  { id: 13, text: "Focus is the art of knowing what to ignore." },
  { id: 14, text: "Keep promises made to yourself in the morning." },
  { id: 15, text: "Action dissolves anxiety. Dive into the work." },
  { id: 16, text: "Build momentum one session at a time." },
  { id: 17, text: "When resistance appears, lean in." },
  { id: 18, text: "Simplicity of purpose breeds velocity of execution." },
  { id: 19, text: "Silence the noise. Lock the shield. Execute." },
  { id: 20, text: "Consistency compounds faster than intensity." },
  { id: 21, text: "Measure by output and depth, not elapsed hours." },
  { id: 22, text: "The obstacle in front of you is the training." },
  { id: 23, text: "Finish today cleanly so tomorrow starts with momentum." },
  { id: 24, text: "Deep work is a competitive advantage. Claim yours." },
] as const

const STORAGE_KEY_LAST_DATE = 'shinpo_message_last_date'
const STORAGE_KEY_CYCLE_INDEX = 'shinpo_message_cycle_index'
const SESSION_LAUNCHED_FLAG = 'shinpo_session_launched_flag'

/**
 * Deterministic hash from date string (YYYY-MM-DD) to quote index
 */
function getDailyBaseIndex(dateStr: string): number {
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % SHINPO_MESSAGES.length
}

/**
 * Retrieves the current dynamic SHINPO message with date rotation,
 * session-launch bump, and local persistence.
 */
export function getInitialShinpoMessage(): ShinpoMessage {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const storedDate = localStorage.getItem(STORAGE_KEY_LAST_DATE)
  const storedIndexStr = localStorage.getItem(STORAGE_KEY_CYCLE_INDEX)
  let currentIndex = storedIndexStr !== null ? parseInt(storedIndexStr, 10) : getDailyBaseIndex(todayStr)
  if (isNaN(currentIndex)) {
    currentIndex = getDailyBaseIndex(todayStr)
  }

  // If the date rolled over to a new day, advance or reset to that day's base
  if (storedDate !== todayStr) {
    currentIndex = getDailyBaseIndex(todayStr)
    localStorage.setItem(STORAGE_KEY_LAST_DATE, todayStr)
    localStorage.setItem(STORAGE_KEY_CYCLE_INDEX, currentIndex.toString())
  } else {
    // If it's a new session launch (browser tab / window reopened), rotate to the next message
    const sessionSeen = sessionStorage.getItem(SESSION_LAUNCHED_FLAG)
    if (!sessionSeen) {
      sessionStorage.setItem(SESSION_LAUNCHED_FLAG, 'true')
      currentIndex = (currentIndex + 1) % SHINPO_MESSAGES.length
      localStorage.setItem(STORAGE_KEY_CYCLE_INDEX, currentIndex.toString())
    }
  }

  return SHINPO_MESSAGES[currentIndex % SHINPO_MESSAGES.length]
}

/**
 * Cycle manually to the next SHINPO message (e.g. user clicks refresh button).
 */
export function getNextShinpoMessage(currentMessageId: number): ShinpoMessage {
  const currentIdx = SHINPO_MESSAGES.findIndex((m) => m.id === currentMessageId)
  const nextIdx = (currentIdx + 1) % SHINPO_MESSAGES.length
  localStorage.setItem(STORAGE_KEY_CYCLE_INDEX, nextIdx.toString())
  return SHINPO_MESSAGES[nextIdx]
}
