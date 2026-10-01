import { Client } from '@stomp/stompjs'
import { getAuthToken } from './auth'
import { getWsBaseUrl } from './config'

export interface SentinelQuarantineEvent {
  id: number
  userId: number | null
  focusSessionId: number | null
  processName: string
  pid: number
  reason: string
  enforcementAction: string
  platform: string
  timestamp: string
}

export interface SentinelStatusEvent {
  userId: number | null
  mode: string
  isLocked: boolean
  blockedCount: number
  allowedCount: number
  timestamp: string
}

export interface FocusSessionEvent {
  id: number
  userId: number
  missionId: number | null
  status: string
  startTime: string | null
  endTime: string | null
  plannedDurationMinutes: number
  actualDurationMinutes: number
  interruptionCount: number
  debriefNotes: string | null
  timestamp: string
}

export type QuarantineListener = (event: SentinelQuarantineEvent) => void
export type SentinelStatusListener = (event: SentinelStatusEvent) => void
export type FocusSessionListener = (event: FocusSessionEvent) => void
export type ConnectionListener = (connected: boolean) => void

class ShinpoWebSocketClient {
  private client: Client | null = null
  private quarantineListeners = new Set<QuarantineListener>()
  private statusListeners = new Set<SentinelStatusListener>()
  private focusSessionListeners = new Set<FocusSessionListener>()
  private connectionListeners = new Set<ConnectionListener>()
  private currentUserId: number | null = null
  private isConnecting = false

  public connect(userId: number) {
    if (this.client && this.client.active && this.currentUserId === userId) {
      return
    }

    this.disconnect()
    this.currentUserId = userId
    this.isConnecting = true

    const token = getAuthToken() || ''
    const brokerUrl = getWsBaseUrl()

    this.client = new Client({
      brokerURL: brokerUrl,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
        token: token,
      },
      debug: (msg: string) => {
        if (import.meta.env.DEV) {
          console.debug('[STOMP]', msg)
        }
      },
      reconnectDelay: 4000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    })

    this.client.onConnect = () => {
      this.isConnecting = false
      this.notifyConnection(true)
      console.log(`[STOMP] Connected to Shinpo Telemetry Broker for user #${userId}`)

      // 1. Subscribe to Quarantine Events (User-specific + Broadcast)
      this.client?.subscribe(`/topic/users/${userId}/sentinel/quarantine`, (message) => {
        try {
          const payload: SentinelQuarantineEvent = JSON.parse(message.body)
          this.quarantineListeners.forEach((listener) => listener(payload))
        } catch (err) {
          console.error('[STOMP] Failed to parse quarantine event:', err)
        }
      })

      // 2. Subscribe to Sentinel Status Events
      this.client?.subscribe(`/topic/users/${userId}/sentinel/status`, (message) => {
        try {
          const payload: SentinelStatusEvent = JSON.parse(message.body)
          this.statusListeners.forEach((listener) => listener(payload))
        } catch (err) {
          console.error('[STOMP] Failed to parse status event:', err)
        }
      })

      // 3. Subscribe to Focus Session Events (Real-time sprint lockdown sync across tabs)
      this.client?.subscribe(`/topic/users/${userId}/focus-session`, (message) => {
        try {
          const payload: FocusSessionEvent = JSON.parse(message.body)
          this.focusSessionListeners.forEach((listener) => listener(payload))
        } catch (err) {
          console.error('[STOMP] Failed to parse focus session event:', err)
        }
      })
    }

    this.client.onStompError = (frame) => {
      console.warn('[STOMP] Broker error:', frame.headers['message'], frame.body)
    }

    this.client.onWebSocketClose = () => {
      this.isConnecting = false
      this.notifyConnection(false)
    }

    this.client.activate()
  }

  public disconnect() {
    if (this.client) {
      try {
        this.client.deactivate()
      } catch (err) {
        console.warn('[STOMP] Error deactivating client:', err)
      }
      this.client = null
    }
    this.isConnecting = false
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

  public isConnected(): boolean {
    return !!this.client && this.client.connected
  }

  public isConnectingToBroker(): boolean {
    return this.isConnecting
  }
}

export const wsClient = new ShinpoWebSocketClient()
