/**
 * SHINPO (進歩) — Standalone Native Telemetry & Event Dispatcher
 * In-process event bus for distraction warnings, Sentinel status, and Focus sessions.
 * Decoupled from legacy broker protocols and external network sockets.
 */

import { getAuthenticatedUserId } from './auth.ts'
import {
  normalizeFocusSessionEvent,
  normalizeSentinelQuarantineEvent,
  normalizeSentinelStatusEvent,
} from './eventNormalizer.ts'

export type {
  SentinelQuarantineEvent,
  SentinelStatusEvent,
  FocusSessionEvent,
  QuarantineListener,
  SentinelStatusListener,
  FocusSessionListener,
  ConnectionListener,
} from './eventTypes.ts'

import type {
  QuarantineListener,
  SentinelStatusListener,
  FocusSessionListener,
  ConnectionListener,
} from './eventTypes.ts'

class ShinpoTelemetryBus {
  private quarantineListeners = new Set<QuarantineListener>()
  private statusListeners = new Set<SentinelStatusListener>()
  private focusSessionListeners = new Set<FocusSessionListener>()
  private connectionListeners = new Set<ConnectionListener>()
  private currentUserId: number | null = null
  private connected = false

  public connect(userId?: number) {
    const targetUserId = userId ?? getAuthenticatedUserId()
    this.currentUserId = targetUserId ?? null
    this.connected = true
    this.notifyConnection(true)
  }

  public disconnect() {
    this.connected = false
    this.currentUserId = null
    this.notifyConnection(false)
  }

  private notifyConnection(connected: boolean) {
    this.connectionListeners.forEach((l) => l(connected))
  }

  public onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener)
    listener(this.isConnected())
    return () => this.connectionListeners.delete(listener)
  }

  public onQuarantine(listener: QuarantineListener): () => void {
    this.quarantineListeners.add(listener)
    return () => this.quarantineListeners.delete(listener)
  }

  public onSentinelStatus(listener: SentinelStatusListener): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  public onFocusSession(listener: FocusSessionListener): () => void {
    this.focusSessionListeners.add(listener)
    return () => this.focusSessionListeners.delete(listener)
  }

  public emitQuarantine(raw: unknown) {
    const payload = normalizeSentinelQuarantineEvent(raw)
    this.quarantineListeners.forEach((listener) => listener(payload))
  }

  public emitSentinelStatus(raw: unknown) {
    const payload = normalizeSentinelStatusEvent(raw)
    this.statusListeners.forEach((listener) => listener(payload))
  }

  public emitFocusSession(raw: unknown) {
    const payload = normalizeFocusSessionEvent(raw)
    this.focusSessionListeners.forEach((listener) => listener(payload))
  }

  public isConnected(): boolean {
    return this.connected
  }

  public getCurrentUserId(): number | null {
    return this.currentUserId
  }

  public isConnectingToBroker(): boolean {
    return false
  }
}

export const wsClient = new ShinpoTelemetryBus()
