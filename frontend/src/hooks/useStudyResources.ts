import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createStudyResource,
  deleteStudyResource,
  disconnectedContextualFocusStatus,
  getContextualFocusStatus,
  getFocusRestrictions,
  getStudyResources,
  updateStudyFocusMode,
} from '../api/contextualFocus'
import type {
  ContextualFocusStatus,
  CreateStudyResourceRequest,
  StudyFocusMode,
  StudyResource,
} from '../api/contextualFocus'
import {
  getNativeGuardianStatus,
} from '../api/nativeShield'
import { isLocalVaultSession } from '../api/auth'

export interface UseStudyResourcesOptions {
  missionId?: number
  sessionId?: number
  enabled?: boolean
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The contextual Focus service is unavailable.'
}

export function useStudyResources({
  missionId,
  sessionId,
  enabled = true,
}: UseStudyResourcesOptions) {
  const [resources, setResources] = useState<StudyResource[]>([])
  const [restrictions, setRestrictions] = useState<StudyResource[]>([])
  const [status, setStatus] = useState<ContextualFocusStatus>(() =>
    disconnectedContextualFocusStatus(sessionId),
  )
  const [loading, setLoading] = useState(false)
  const [mutating, setMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const hasTarget = Boolean(missionId || sessionId)

  const applyLocalShieldStatus = useCallback(
    async (baseStatus: ContextualFocusStatus): Promise<ContextualFocusStatus> => {
      if (!isLocalVaultSession()) return baseStatus

      let localStatus
      try {
        localStatus = await getNativeGuardianStatus()
      } catch {
        return {
          ...baseStatus,
          nativeShield: {
            state: 'DISCONNECTED',
            detail: 'The desktop app could not read the encrypted Guardian status.',
          },
        }
      }
      if (!localStatus) return baseStatus

      return {
        ...baseStatus,
        nativeShield: {
          state: localStatus.status === 'LOCKED' ? 'DISCONNECTED' : 'CONNECTED',
          detail: localStatus.status === 'LOCKED'
            ? 'Guardian monitoring is paused while the encrypted vault is locked.'
            : `Automatic ${localStatus.guardianMode ?? 'Standard'} Guardian · ${localStatus.focusPhase ?? 'idle'} · warning only; apps are never closed.`,
        },
      }
    },
    [],
  )

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current

    if (!enabled || !hasTarget) {
      setResources([])
      setRestrictions([])
      setStatus(disconnectedContextualFocusStatus(sessionId))
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [resourcesResult, statusResult, restrictionsResult] = await Promise.allSettled([
      getStudyResources({ missionId, sessionId }),
      sessionId
        ? getContextualFocusStatus(sessionId)
        : Promise.resolve(disconnectedContextualFocusStatus()),
      sessionId ? getFocusRestrictions(sessionId) : Promise.resolve([]),
    ])

    if (requestId !== requestIdRef.current) return

    if (resourcesResult.status === 'fulfilled') {
      setResources(resourcesResult.value)
    } else {
      setResources([])
      setError(errorMessage(resourcesResult.reason))
    }

    if (restrictionsResult.status === 'fulfilled') {
      setRestrictions(restrictionsResult.value)
    } else {
      setRestrictions([])
    }

    const remoteStatus = statusResult.status === 'fulfilled'
      ? statusResult.value
      : disconnectedContextualFocusStatus(sessionId)
    const nextStatus = await applyLocalShieldStatus(remoteStatus)
    if (requestId === requestIdRef.current) {
      setStatus(nextStatus)
      setLoading(false)
    }
  }, [applyLocalShieldStatus, enabled, hasTarget, missionId, sessionId])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void reload(), 0)
    return () => {
      window.clearTimeout(initialLoad)
      requestIdRef.current += 1
    }
  }, [reload])

  const addResource = useCallback(async (request: CreateStudyResourceRequest) => {
    setMutating(true)
    setError(null)
    try {
      const created = await createStudyResource(request)
      setResources((current) => [created, ...current.filter((item) => item.id !== created.id)])
      if (created.disposition === 'BLOCKED') {
        setRestrictions((current) => [
          created,
          ...current.filter((item) => item.id !== created.id),
        ])
      }
      return created
    } catch (requestError) {
      setError(errorMessage(requestError))
      throw requestError
    } finally {
      setMutating(false)
    }
  }, [])

  const removeResource = useCallback(async (resourceId: number) => {
    setMutating(true)
    setError(null)
    try {
      await deleteStudyResource(resourceId)
      setResources((current) => current.filter((item) => item.id !== resourceId))
      setRestrictions((current) => current.filter((item) => item.id !== resourceId))
    } catch (requestError) {
      setError(errorMessage(requestError))
      throw requestError
    } finally {
      setMutating(false)
    }
  }, [])

  const setMode = useCallback(async (mode: StudyFocusMode) => {
    if (!sessionId) throw new Error('Start a Focus session before changing study mode.')
    setMutating(true)
    setError(null)
    try {
      const nextStatus = await updateStudyFocusMode(sessionId, mode)
      setStatus((current) => ({
        ...current,
        ...nextStatus,
        mode,
        browserCompanion: nextStatus.browserCompanion.state === 'DISCONNECTED' &&
          current.browserCompanion.state === 'CONNECTED'
          ? current.browserCompanion
          : nextStatus.browserCompanion,
        nativeShield: nextStatus.nativeShield.state === 'UNAVAILABLE'
          ? current.nativeShield
          : nextStatus.nativeShield,
      }))
    } catch (requestError) {
      setError(errorMessage(requestError))
      throw requestError
    } finally {
      setMutating(false)
    }
  }, [sessionId])

  return {
    resources,
    restrictions,
    status,
    mode: status.mode,
    hasTarget,
    loading,
    mutating,
    error,
    addResource,
    removeResource,
    setMode,
    reload,
  }
}
