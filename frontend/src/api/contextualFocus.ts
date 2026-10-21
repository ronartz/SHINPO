import { apiClient } from './client.ts'

export type StudyFocusMode = 'GUIDED' | 'PROTECTED' | 'STRICT'

export type StudyResourceType =
  | 'WEBSITE'
  | 'YOUTUBE_VIDEO'
  | 'YOUTUBE_PLAYLIST'
  | 'DISCORD_CHANNEL'
  | 'TEMPORARY_SITE'
  | 'DESKTOP_PROCESS'

export type StudyResourceMatchType =
  | 'EXACT'
  | 'DOMAIN'
  | 'URL_PATTERN'
  | 'BROWSER_CHANNEL'
  | 'PROCESS'

export type StudyResourceDisposition = 'APPROVED' | 'BLOCKED'

export type CompanionConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'UNSUPPORTED'
export type AdapterCoverage = 'FULL' | 'LIMITED' | 'NONE'
export type NativeShieldConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'UNAVAILABLE'

export interface StudyResource {
  id: number
  userId: number
  missionId: number | null
  focusSessionId: number | null
  resourceType: StudyResourceType
  matchType: StudyResourceMatchType
  disposition: StudyResourceDisposition
  destination: string
  canonicalDestination: string
  displayName: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateStudyResourceRequest {
  missionId?: number
  focusSessionId?: number
  resourceType: StudyResourceType
  matchType: StudyResourceMatchType
  disposition: StudyResourceDisposition
  destination: string
  displayName?: string
  expiresAt?: string
}

export interface BrowserCompanionStatus {
  state: CompanionConnectionState
  adapterCoverage: AdapterCoverage
  adapterName: string | null
  detail: string | null
}

export interface ContextualNativeShieldStatus {
  state: NativeShieldConnectionState
  detail: string | null
}

export interface ContextualFocusStatus {
  sessionId: number | null
  sessionStatus: string | null
  mode: StudyFocusMode | null
  policyRevision: number | null
  browserCompanion: BrowserCompanionStatus
  nativeShield: ContextualNativeShieldStatus
  restrictions: StudyResource[]
}

export interface StudyResourceDraft {
  missionId?: number
  focusSessionId?: number
  resourceType: StudyResourceType
  matchType: StudyResourceMatchType
  disposition: StudyResourceDisposition
  destination: string
  displayName?: string
  durationMinutes?: number | null
}

const STUDY_MODES: readonly StudyFocusMode[] = ['GUIDED', 'PROTECTED', 'STRICT']
const COMPANION_STATES: readonly CompanionConnectionState[] = [
  'CONNECTED',
  'DISCONNECTED',
  'UNSUPPORTED',
]
const ADAPTER_COVERAGE: readonly AdapterCoverage[] = ['FULL', 'LIMITED', 'NONE']
const SHIELD_STATES: readonly NativeShieldConnectionState[] = [
  'CONNECTED',
  'DISCONNECTED',
  'UNAVAILABLE',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isMember<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T)
}

export const disconnectedContextualFocusStatus = (
  sessionId?: number,
): ContextualFocusStatus => ({
  sessionId: sessionId ?? null,
  sessionStatus: null,
  mode: null,
  policyRevision: null,
  browserCompanion: {
    state: 'DISCONNECTED',
    adapterCoverage: 'NONE',
    adapterName: null,
    detail: 'Companion status is unavailable. Browser enforcement is not being claimed.',
  },
  nativeShield: {
    state: 'UNAVAILABLE',
    detail: 'Native Shield status is unavailable.',
  },
  restrictions: [],
})

/**
 * Keep degraded states explicit even if a partial or older status payload is returned.
 * A missing positive connection signal is always represented as disconnected/unavailable.
 */
export function normalizeContextualFocusStatus(
  value: unknown,
  requestedSessionId?: number,
): ContextualFocusStatus {
  const fallback = disconnectedContextualFocusStatus(requestedSessionId)
  if (!isRecord(value)) return fallback

  const browserValue = isRecord(value.browserCompanion) ? value.browserCompanion : {}
  const shieldValue = isRecord(value.nativeShield) ? value.nativeShield : {}
  const rawRestrictions = Array.isArray(value.restrictions) ? value.restrictions : []

  const companionState = isMember(browserValue.state, COMPANION_STATES)
    ? browserValue.state
    : 'DISCONNECTED'
  const adapterCoverage = isMember(browserValue.adapterCoverage, ADAPTER_COVERAGE)
    ? browserValue.adapterCoverage
    : 'NONE'
  const shieldState = isMember(shieldValue.state, SHIELD_STATES)
    ? shieldValue.state
    : 'UNAVAILABLE'

  return {
    sessionId: asNullableNumber(value.sessionId) ?? requestedSessionId ?? null,
    sessionStatus: asNullableString(value.sessionStatus),
    mode: isMember(value.mode, STUDY_MODES) ? value.mode : null,
    policyRevision: asNullableNumber(value.policyRevision),
    browserCompanion: {
      state: companionState,
      adapterCoverage,
      adapterName: asNullableString(browserValue.adapterName),
      detail:
        asNullableString(browserValue.detail) ??
        (companionState === 'CONNECTED'
          ? null
          : 'Browser Companion is not connected; browser-level rules are not active.'),
    },
    nativeShield: {
      state: shieldState,
      detail:
        asNullableString(shieldValue.detail) ??
        (shieldState === 'CONNECTED' ? null : 'Native process protection is not connected.'),
    },
    restrictions: rawRestrictions.filter(isStudyResource),
  }
}

export function isStudyResource(value: unknown): value is StudyResource {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'number' &&
    typeof value.destination === 'string' &&
    typeof value.canonicalDestination === 'string' &&
    typeof value.resourceType === 'string' &&
    typeof value.matchType === 'string' &&
    (value.disposition === 'APPROVED' || value.disposition === 'BLOCKED')
  )
}

function parseHttpUrl(rawValue: string): URL | null {
  try {
    const parsed = new URL(rawValue)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (parsed.username || parsed.password) return null
    return parsed
  } catch {
    return null
  }
}

function parseDomain(rawValue: string): URL | null {
  const trimmed = rawValue.trim()
  if (!trimmed) return null
  const parsed = parseHttpUrl(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  if (!parsed || (parsed.pathname !== '/' && parsed.pathname !== '')) return null
  if (parsed.search || parsed.hash) return null
  return parsed
}

function hostMatches(hostname: string, expectedHost: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  return normalized === expectedHost || normalized.endsWith(`.${expectedHost}`)
}

function validateUrlPattern(rawValue: string): boolean {
  const trimmed = rawValue.trim()
  const authority = trimmed.match(/^https?:\/\/([^/]+)/i)?.[1] ?? ''
  if (!authority || authority.includes('*')) return false
  const parseable = trimmed.replaceAll('*', '__shinpo_wildcard__')
  return parseHttpUrl(parseable) !== null
}

export function validateStudyResourceDraft(draft: StudyResourceDraft): string | null {
  if (!draft.missionId && !draft.focusSessionId) {
    return 'Choose a task or active Focus session for this resource.'
  }
  if (draft.resourceType === 'DESKTOP_PROCESS' && !draft.focusSessionId) {
    return 'Desktop application exceptions require an active Focus session.'
  }

  const rawDestination = draft.destination.trim()
  if (!rawDestination) return 'Enter a destination or process name.'
  if (rawDestination.length > 2048) return 'Destination must be 2,048 characters or fewer.'

  if (draft.matchType === 'PROCESS') {
    if (draft.resourceType !== 'DESKTOP_PROCESS') {
      return 'Process matching is only available for desktop applications.'
    }
    return rawDestination.length >= 2 ? null : 'Enter at least two characters for a process name.'
  }

  const destination = !/^https?:\/\//i.test(rawDestination) ? `https://${rawDestination}` : rawDestination

  if (draft.matchType === 'DOMAIN') {
    if (!parseDomain(destination)) {
      return 'Enter one exact domain, such as docs.spring.io. Paths and wildcards are not allowed.'
    }
    return null
  }

  if (draft.matchType === 'URL_PATTERN') {
    if (!validateUrlPattern(destination)) {
      return 'Use a full http(s) URL pattern. Wildcards are allowed only after the hostname.'
    }
    return null
  }

  const url = parseHttpUrl(destination)
  if (!url) return 'Enter a complete http(s) URL without embedded credentials.'

  if (draft.matchType === 'BROWSER_CHANNEL' || draft.resourceType === 'DISCORD_CHANNEL') {
    if (!hostMatches(url.hostname, 'discord.com')) {
      return 'Browser channels currently require an exact discord.com channel URL.'
    }
    if (!/^\/channels\/\d+\/\d+(?:\/|$)/.test(url.pathname)) {
      return 'Use a Discord server/channel route such as discord.com/channels/123/456.'
    }
  }

  if (draft.resourceType === 'YOUTUBE_VIDEO') {
    const isWatchUrl = hostMatches(url.hostname, 'youtube.com') &&
      url.pathname === '/watch' && Boolean(url.searchParams.get('v'))
    const isShortUrl = url.hostname.toLowerCase() === 'youtu.be' && url.pathname.length > 1
    if (!isWatchUrl && !isShortUrl) return 'Enter an exact YouTube video URL.'
  }

  if (draft.resourceType === 'YOUTUBE_PLAYLIST') {
    const isPlaylist = hostMatches(url.hostname, 'youtube.com') &&
      Boolean(url.searchParams.get('list'))
    if (!isPlaylist) return 'Enter a YouTube URL containing a playlist ID.'
  }

  return null
}

export function buildStudyResourceRequest(
  draft: StudyResourceDraft,
  nowMs = Date.now(),
): CreateStudyResourceRequest {
  const validationError = validateStudyResourceDraft(draft)
  if (validationError) throw new Error(validationError)

  const duration = draft.durationMinutes
  const rawDest = draft.destination.trim()
  const isProcess = draft.resourceType === 'DESKTOP_PROCESS' || draft.matchType === 'PROCESS'
  const destination = !isProcess && !/^https?:\/\//i.test(rawDest) ? `https://${rawDest}` : rawDest

  return {
    ...(draft.missionId ? { missionId: draft.missionId } : {}),
    ...(draft.focusSessionId ? { focusSessionId: draft.focusSessionId } : {}),
    resourceType: draft.resourceType,
    matchType: draft.matchType,
    disposition: draft.disposition,
    destination,
    ...(draft.displayName?.trim() ? { displayName: draft.displayName.trim() } : {}),
    ...(duration && duration > 0
      ? { expiresAt: new Date(nowMs + duration * 60_000).toISOString() }
      : {}),
  }
}

export function getOpenableResourceUrl(resource: StudyResource): string | null {
  if (resource.resourceType === 'DESKTOP_PROCESS' || resource.matchType === 'PROCESS') return null

  const canonical = resource.canonicalDestination.trim()
  const youtubeVideo = canonical.match(/^youtube:video:([A-Za-z0-9_-]{6,64})$/)
  if (youtubeVideo) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeVideo[1])}`
  }

  const youtubePlaylist = canonical.match(/^youtube:playlist:([A-Za-z0-9_-]{6,128})$/)
  if (youtubePlaylist) {
    return `https://www.youtube.com/playlist?list=${encodeURIComponent(youtubePlaylist[1])}`
  }

  const discordChannel = canonical.match(/^discord:channel:(\d{1,32})\/(\d{1,32})$/)
  if (discordChannel) {
    return `https://discord.com/channels/${discordChannel[1]}/${discordChannel[2]}`
  }

  for (const candidate of [canonical, resource.destination.trim()]) {
    const domainCandidate = resource.matchType === 'DOMAIN' && !/^https?:\/\//i.test(candidate)
      ? `https://${candidate}`
      : candidate
    const parsed = parseHttpUrl(domainCandidate)
    if (parsed) return parsed.toString()
  }
  return null
}

export async function getStudyResources(params: {
  missionId?: number
  sessionId?: number
}): Promise<StudyResource[]> {
  return apiClient.get<StudyResource[]>('/contextual-focus/resources', { params })
}

export async function createStudyResource(
  request: CreateStudyResourceRequest,
): Promise<StudyResource> {
  return apiClient.post<StudyResource>('/contextual-focus/resources', request)
}

export async function deleteStudyResource(resourceId: number): Promise<void> {
  return apiClient.delete<void>(`/contextual-focus/resources/${resourceId}`)
}

export async function updateStudyFocusMode(
  sessionId: number,
  mode: StudyFocusMode,
): Promise<ContextualFocusStatus> {
  const response = await apiClient.patch<unknown>(
    `/contextual-focus/sessions/${sessionId}/mode`,
    { mode },
  )
  return normalizeContextualFocusStatus(response, sessionId)
}

export async function getContextualFocusStatus(
  sessionId: number,
): Promise<ContextualFocusStatus> {
  const response = await apiClient.get<unknown>('/contextual-focus/status', {
    params: { sessionId },
  })
  return normalizeContextualFocusStatus(response, sessionId)
}

export async function getFocusRestrictions(sessionId: number): Promise<StudyResource[]> {
  return apiClient.get<StudyResource[]>('/contextual-focus/restrictions', {
    params: { sessionId },
  })
}
