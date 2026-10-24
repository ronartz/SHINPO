import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  buildStudyResourceRequest,
  getOpenableResourceUrl,
  validateStudyResourceDraft,
} from '../../api/contextualFocus'
import type {
  AdapterCoverage,
  CompanionConnectionState,
  NativeShieldConnectionState,
  StudyFocusMode,
  StudyResource,
  StudyResourceDisposition,
  StudyResourceMatchType,
  StudyResourceType,
} from '../../api/contextualFocus'
import { useStudyResources } from '../../hooks/useStudyResources'
import { Icon } from '../common/Icon'
import { ShinpoButton, ShinpoSelect, ShinpoTextField } from '../ui'
import type { SelectOption } from '../ui/Select/types'

export interface StudyResourcesPanelProps {
  missionId?: number
  sessionId?: number
  taskTitle?: string | null
  surface?: 'card' | 'plain'
  showProtectionControls?: boolean
}

type ResourceScope = 'TASK' | 'SESSION'
type DurationOption = 'NONE' | '5' | '15' | '30' | '60'

const RESOURCE_TYPE_OPTIONS: SelectOption<StudyResourceType>[] = [
  { value: 'WEBSITE', label: 'Website or documentation' },
  { value: 'YOUTUBE_VIDEO', label: 'YouTube video' },
  { value: 'YOUTUBE_PLAYLIST', label: 'YouTube playlist' },
  { value: 'DISCORD_CHANNEL', label: 'Discord browser channel' },
  { value: 'TEMPORARY_SITE', label: 'Temporary website access' },
  { value: 'DESKTOP_PROCESS', label: 'Desktop application exception' },
]

const DISPOSITION_OPTIONS: SelectOption<StudyResourceDisposition>[] = [
  { value: 'APPROVED', label: 'Approve for study' },
  { value: 'BLOCKED', label: 'Restrict during focus' },
]

const DURATION_OPTIONS: SelectOption<DurationOption>[] = [
  { value: 'NONE', label: 'For this task/session' },
  { value: '5', label: '5 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
]

const MODE_DETAILS: Record<StudyFocusMode, { label: string; detail: string }> = {
  GUIDED: {
    label: 'Guided',
    detail: 'Normal browsing stays available, with gentle return-to-task prompts.',
  },
  PROTECTED: {
    label: 'Protected',
    detail: 'Applies your explicit site and route rules; uncertain destinations receive a warning.',
  },
  STRICT: {
    label: 'Strict',
    detail: 'Enforces configured restrictions while keeping approved study resources available.',
  },
}

const RESOURCE_LABELS: Record<StudyResourceType, string> = {
  WEBSITE: 'Website',
  YOUTUBE_VIDEO: 'YouTube video',
  YOUTUBE_PLAYLIST: 'YouTube playlist',
  DISCORD_CHANNEL: 'Discord channel',
  TEMPORARY_SITE: 'Temporary site',
  DESKTOP_PROCESS: 'Desktop app',
}

function matchOptionsFor(type: StudyResourceType): SelectOption<StudyResourceMatchType>[] {
  if (type === 'DESKTOP_PROCESS') return [{ value: 'PROCESS', label: 'Application/process' }]
  if (type === 'DISCORD_CHANNEL') return [{ value: 'BROWSER_CHANNEL', label: 'Exact browser channel' }]
  if (type === 'YOUTUBE_VIDEO' || type === 'YOUTUBE_PLAYLIST') {
    return [{ value: 'EXACT', label: 'Exact resource only' }]
  }
  return [
    { value: 'EXACT', label: 'Exact page' },
    { value: 'DOMAIN', label: 'Entire domain' },
    { value: 'URL_PATTERN', label: 'Validated URL pattern' },
  ]
}

function defaultMatchType(type: StudyResourceType): StudyResourceMatchType {
  if (type === 'DESKTOP_PROCESS') return 'PROCESS'
  if (type === 'DISCORD_CHANNEL') return 'BROWSER_CHANNEL'
  return 'EXACT'
}

function destinationPlaceholder(type: StudyResourceType, matchType: StudyResourceMatchType): string {
  if (type === 'DESKTOP_PROCESS') return 'e.g. code, obs64, firefox'
  if (type === 'DISCORD_CHANNEL') return 'https://discord.com/channels/123/456'
  if (type === 'YOUTUBE_VIDEO') return 'https://www.youtube.com/watch?v=...'
  if (type === 'YOUTUBE_PLAYLIST') return 'https://www.youtube.com/playlist?list=...'
  if (matchType === 'DOMAIN') return 'docs.spring.io'
  if (matchType === 'URL_PATTERN') return 'https://example.com/course/*'
  return 'https://example.com/study/resource'
}

function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  const parsed = new Date(expiresAt)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getTime() <= Date.now()
    ? 'Expired'
    : `Until ${parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function ConnectionBadge({
  label,
  state,
  detail,
}: {
  label: string
  state: CompanionConnectionState | NativeShieldConnectionState
  detail: string | null
}) {
  const tone = state === 'CONNECTED'
    ? 'connected'
    : state === 'UNSUPPORTED' || state === 'UNAVAILABLE'
      ? 'unavailable'
      : 'disconnected'

  return (
    <div className={`study-coverage-chip ${tone}`} title={detail ?? undefined}>
      <span className="study-coverage-dot" aria-hidden="true" />
      <span className="study-coverage-copy">
        <strong>{label}</strong>
        <span>{state.toLowerCase().replace('_', ' ')}</span>
      </span>
    </div>
  )
}

function AdapterBadge({ coverage, name }: { coverage: AdapterCoverage; name: string | null }) {
  if (coverage === 'FULL') {
    return <span className="study-adapter-badge supported">{name ?? 'Site adapter'} available</span>
  }
  if (coverage === 'LIMITED') {
    return <span className="study-adapter-badge limited">Site adapter limited{name ? ` · ${name}` : ''}</span>
  }
  return <span className="study-adapter-badge none">No site adapter coverage reported</span>
}

function ResourceRow({
  resource,
  removing,
  onRemove,
}: {
  resource: StudyResource
  removing: boolean
  onRemove: (resourceId: number) => void
}) {
  const openUrl = resource.disposition === 'APPROVED' ? getOpenableResourceUrl(resource) : null
  const expiry = formatExpiry(resource.expiresAt)
  const title = resource.displayName || resource.canonicalDestination || resource.destination

  return (
    <li className={`study-resource-row ${resource.disposition.toLowerCase()}`}>
      <div className="study-resource-mark" aria-hidden="true">
        <Icon name={resource.disposition === 'APPROVED' ? 'check' : 'lock'} size={14} />
      </div>
      <div className="study-resource-copy">
        <div className="study-resource-title-line">
          <strong title={title}>{title}</strong>
          <span className={`study-resource-disposition ${resource.disposition.toLowerCase()}`}>
            {resource.breakOnly ? 'Break only' : resource.disposition === 'APPROVED' ? 'Approved' : 'Restricted'}
          </span>
        </div>
        <div className="study-resource-meta">
          <span>{RESOURCE_LABELS[resource.resourceType]}</span>
          <span>·</span>
          <span>{resource.matchType.toLowerCase().replace('_', ' ')}</span>
          {expiry && <span className={expiry === 'Expired' ? 'is-expired' : ''}>· {expiry}</span>}
        </div>
        {resource.displayName && (
          <div className="study-resource-destination" title={resource.canonicalDestination}>
            {resource.canonicalDestination}
          </div>
        )}
      </div>
      <div className="study-resource-actions">
        {openUrl && (
          <a
            className="study-resource-open"
            href={openUrl}
            target="_blank"
            rel="noreferrer noopener"
            title="Open approved resource"
          >
            <Icon name="arrow-up-right" size={13} />
            <span>Open</span>
          </a>
        )}
        <button
          type="button"
          className="study-resource-remove"
          onClick={() => onRemove(resource.id)}
          disabled={removing}
          aria-label={`Remove ${title}`}
          title="Remove resource"
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
    </li>
  )
}

export function StudyResourcesPanel({
  missionId,
  sessionId,
  taskTitle,
  surface = 'card',
  showProtectionControls = true,
}: StudyResourcesPanelProps) {
  const {
    resources,
    restrictions,
    status,
    mode,
    hasTarget,
    loading,
    mutating,
    error,
    addResource,
    removeResource,
    setMode,
    reload,
  } = useStudyResources({ missionId, sessionId })

  const [showAddForm, setShowAddForm] = useState(false)
  const [resourceType, setResourceType] = useState<StudyResourceType>('WEBSITE')
  const [matchType, setMatchType] = useState<StudyResourceMatchType>('EXACT')
  const [disposition, setDisposition] = useState<StudyResourceDisposition>('APPROVED')
  const [breakOnly, setBreakOnly] = useState(false)
  const [scope, setScope] = useState<ResourceScope>(missionId ? 'TASK' : 'SESSION')
  const [duration, setDuration] = useState<DurationOption>('NONE')
  const [displayName, setDisplayName] = useState('')
  const [destination, setDestination] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const restrictionList = useMemo(() => {
    const byId = new Map<number, StudyResource>()
    for (const item of [...resources, ...status.restrictions, ...restrictions]) {
      if (item.disposition === 'BLOCKED') byId.set(item.id, item)
    }
    return [...byId.values()]
  }, [resources, restrictions, status.restrictions])

  const handleTypeChange = (nextType: StudyResourceType) => {
    setResourceType(nextType)
    setMatchType(defaultMatchType(nextType))
    if (nextType === 'TEMPORARY_SITE' && duration === 'NONE') setDuration('15')
    if (nextType === 'DESKTOP_PROCESS') setScope('SESSION')
    setFormError(null)
  }

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    const useTaskScope = scope === 'TASK' && missionId
    const draft = {
      ...(useTaskScope ? { missionId } : {}),
      ...(!useTaskScope && sessionId ? { focusSessionId: sessionId } : {}),
      resourceType,
      matchType,
      disposition,
      breakOnly: scope === 'SESSION' && disposition === 'APPROVED' && breakOnly,
      destination,
      displayName,
      durationMinutes: duration === 'NONE' ? null : Number(duration),
    }
    const validationError = validateStudyResourceDraft(draft)
    if (validationError) {
      setFormError(validationError)
      return
    }

    try {
      await addResource(buildStudyResourceRequest(draft))
      setDisplayName('')
      setDestination('')
      setBreakOnly(false)
      setFormError(null)
      setShowAddForm(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save study resource.'
      setFormError(msg)
    }
  }

  const handleModeChange = async (nextMode: StudyFocusMode) => {
    if (!sessionId || nextMode === mode) return
    try {
      await setMode(nextMode)
    } catch {
      // The hook keeps the last confirmed mode and displays the API error.
    }
  }

  const handleRemove = async (resourceId: number) => {
    try {
      await removeResource(resourceId)
    } catch {
      // The resource remains visible when deletion fails.
    }
  }

  const matchOptions = matchOptionsFor(resourceType)
  const scopeOptions: SelectOption<ResourceScope>[] = [
    ...(missionId ? [{ value: 'TASK' as const, label: 'This task' }] : []),
    ...(sessionId ? [{ value: 'SESSION' as const, label: 'This Focus session' }] : []),
  ]

  return (
    <section
      className={`study-resources-panel ${surface === 'card' ? 'bento-card' : 'is-plain'}`}
      data-tutorial="study-resources-panel"
    >
      <div className="study-resources-header">
        <div className="study-resources-heading">
          <span className="study-resources-icon"><Icon name="journal" size={17} /></span>
          <div>
            <div className="study-resources-title-line">
              <h3>Study Resources</h3>
              <span className="badge-tag blue">{resources.length}</span>
            </div>
            <p>{taskTitle ? `For ${taskTitle}` : 'Task-aware links and contextual protection'}</p>
          </div>
        </div>
        {hasTarget && (
          <ShinpoButton
            type="button"
            variant={showAddForm ? 'ghost' : 'secondary'}
            size="sm"
            leftIcon={<Icon name={showAddForm ? 'close' : 'plus'} size={13} />}
            onClick={() => {
              setShowAddForm((open) => !open)
              setFormError(null)
            }}
          >
            {showAddForm ? 'Cancel' : 'Add resource'}
          </ShinpoButton>
        )}
      </div>

      {!hasTarget ? (
        <div className="study-resources-empty-target">
          <Icon name="target" size={18} />
          <div>
            <strong>No Focus context selected</strong>
            <span>Start a Focus session, or open Resources from a task, to configure its study plan.</span>
          </div>
        </div>
      ) : (
        <>
          {sessionId && showProtectionControls && (
            <div className="study-protection-summary">
              <div className="study-coverage-row" aria-label="Protection coverage">
                <ConnectionBadge
                  label="Browser Companion"
                  state={status.browserCompanion.state}
                  detail={status.browserCompanion.detail}
                />
                <ConnectionBadge
                  label="Native Shield"
                  state={status.nativeShield.state}
                  detail={status.nativeShield.detail}
                />
                <AdapterBadge
                  coverage={status.browserCompanion.adapterCoverage}
                  name={status.browserCompanion.adapterName}
                />
              </div>
              {status.browserCompanion.state !== 'CONNECTED' && (
                <p className="study-degraded-note">
                  Browser rules are not active. SHINPO will not claim full page-level protection or close your browser as a fallback.
                </p>
              )}
            </div>
          )}

          {showProtectionControls && (
            <div className="study-mode-section">
              <div className="study-section-label-row">
                <div>
                  <span className="study-section-label">Study mode</span>
                  <span className="study-section-help">Separate from Native Shield process mode</span>
                </div>
                {status.policyRevision !== null && (
                  <span className="study-policy-revision">Policy r{status.policyRevision}</span>
                )}
              </div>
              <div className="study-mode-options">
                {(Object.keys(MODE_DETAILS) as StudyFocusMode[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`study-mode-option ${mode === option ? 'is-active' : ''}`}
                    aria-pressed={mode === option}
                    disabled={!sessionId || mutating}
                    onClick={() => void handleModeChange(option)}
                  >
                    <strong>{MODE_DETAILS[option].label}</strong>
                    <span>{MODE_DETAILS[option].detail}</span>
                  </button>
                ))}
              </div>
              {!sessionId && (
                <p className="study-mode-disabled-note">Study mode becomes available for an active or paused Focus session.</p>
              )}
              {sessionId && mode === null && (
                <p className="study-mode-disabled-note">Study mode status is unavailable; no active mode is being claimed.</p>
              )}
            </div>
          )}

          {showAddForm && (
            <form className="study-resource-form" onSubmit={handleAdd} noValidate>
              <div className="study-resource-form-grid">
                <ShinpoSelect<StudyResourceType>
                  label="Resource type"
                  value={resourceType}
                  options={RESOURCE_TYPE_OPTIONS.map((option) => ({
                    ...option,
                    disabled: option.value === 'DESKTOP_PROCESS' && !sessionId,
                  }))}
                  onChange={handleTypeChange}
                />
                <ShinpoSelect<StudyResourceDisposition>
                  label="Focus action"
                  value={disposition}
                  options={DISPOSITION_OPTIONS}
                  onChange={(value) => {
                    setDisposition(value)
                    if (value !== 'APPROVED') setBreakOnly(false)
                  }}
                />
                <ShinpoSelect<StudyResourceMatchType>
                  label="Coverage"
                  value={matchType}
                  options={matchOptions}
                  onChange={(value) => {
                    setMatchType(value)
                    setFormError(null)
                  }}
                />
                {scopeOptions.length > 1 && (
                  <ShinpoSelect<ResourceScope>
                    label="Save to"
                    value={scope}
                    options={scopeOptions}
                    onChange={(value) => {
                      setScope(value)
                      if (value !== 'SESSION') setBreakOnly(false)
                    }}
                    disabled={resourceType === 'DESKTOP_PROCESS'}
                  />
                )}
                <ShinpoSelect<DurationOption>
                  label="Optional duration"
                  value={duration}
                  options={DURATION_OPTIONS}
                  onChange={setDuration}
                />
                <ShinpoTextField
                  label="Label (optional)"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Spring Security guide"
                  maxLength={120}
                />
                <ShinpoTextField
                  className="study-destination-field"
                  label={resourceType === 'DESKTOP_PROCESS' ? 'Application/process' : 'Destination'}
                  value={destination}
                  onChange={(event) => {
                    setDestination(event.target.value)
                    setFormError(null)
                  }}
                  placeholder={destinationPlaceholder(resourceType, matchType)}
                  errorMessage={formError ?? undefined}
                  required
                  autoFocus
                />
              </div>
              {sessionId && scope === 'SESSION' && disposition === 'APPROVED' && (
                <label className="study-break-only-toggle">
                  <input type="checkbox" checked={breakOnly} onChange={(event) => setBreakOnly(event.target.checked)} />
                  <span>Allow only during scheduled breaks</span>
                </label>
              )}
              {formError && (
                <div className="study-resource-error" role="alert" style={{ marginTop: 8, marginBottom: 4 }}>
                  <span>{formError}</span>
                </div>
              )}
              <div className="study-resource-form-footer">
                <p>
                  Exact resources never approve lookalike hostnames. Browser channel coverage applies only where an adapter can identify the route.
                </p>
                <ShinpoButton
                  type="submit"
                  size="sm"
                  isLoading={mutating}
                  leftIcon={<Icon name="check" size={13} />}
                >
                  Save rule
                </ShinpoButton>
              </div>
            </form>
          )}

          {error && (
            <div className="study-resource-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => void reload()}>Retry</button>
            </div>
          )}

          <div className="study-resource-list-section">
            <div className="study-section-label-row">
              <div>
                <span className="study-section-label">Approved resources & rules</span>
                <span className="study-section-help">Only explicit approvals are treated as trusted</span>
              </div>
            </div>
            {loading ? (
              <div className="study-resource-loading" aria-live="polite">Loading study resources…</div>
            ) : resources.length === 0 ? (
              <div className="study-resource-empty">
                <Icon name="journal" size={18} />
                <span>No resources saved yet. Add only the pages, domains, or channels you intend to use.</span>
              </div>
            ) : (
              <ul className="study-resource-list">
                {resources.map((resource) => (
                  <ResourceRow
                    key={resource.id}
                    resource={resource}
                    removing={mutating}
                    onRemove={handleRemove}
                  />
                ))}
              </ul>
            )}
          </div>

          <details className="study-restrictions-review">
            <summary>
              <span><Icon name="shield" size={14} /> Review current restrictions</span>
              <span className="study-restriction-count">{restrictionList.length}</span>
            </summary>
            <div className="study-restrictions-body">
              {restrictionList.length === 0 ? (
                <p>No explicit browser-resource restrictions are configured for this context.</p>
              ) : (
                <ul>
                  {restrictionList.map((restriction) => (
                    <li key={restriction.id}>
                      <strong>{restriction.displayName || restriction.canonicalDestination}</strong>
                      <span>{RESOURCE_LABELS[restriction.resourceType]} · {restriction.matchType.toLowerCase().replace('_', ' ')}</span>
                    </li>
                  ))}
                </ul>
              )}
              {sessionId && status.browserCompanion.state !== 'CONNECTED' && (
                <p className="study-restriction-limitation">
                  These browser rules are saved but are not actively enforced while the Browser Companion is disconnected.
                </p>
              )}
              {resources.some((resource) => resource.resourceType === 'DISCORD_CHANNEL') && (
                <p className="study-restriction-limitation">
                  Discord channel rules cover browser routes only. The desktop Discord client is limited to app-level process treatment.
                </p>
              )}
            </div>
          </details>
        </>
      )}
    </section>
  )
}
