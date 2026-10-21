export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return '__TAURI_INTERNALS__' in w || '__TAURI__' in w
}

export async function invokeTauriCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window === 'undefined') {
    throw new Error('Tauri invocation unavailable in non-browser context')
  }
  const w = window as unknown as {
    __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<T> }
    __TAURI__?: {
      core?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<T> }
      invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<T>
    }
  }

  if (w.__TAURI_INTERNALS__?.invoke) return w.__TAURI_INTERNALS__.invoke(cmd, args)
  if (w.__TAURI__?.core?.invoke) return w.__TAURI__.core.invoke(cmd, args)
  if (w.__TAURI__?.invoke) return w.__TAURI__.invoke(cmd, args)
  throw new Error(`Tauri invoke not found on window object for command: ${cmd}`)
}
