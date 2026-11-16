import { useEffect, useState } from 'react'
import { updaterService } from './updaterService.ts'
import type { UpdaterState } from './updaterTypes.ts'

export function useUpdater(): UpdaterState {
  const [state, setState] = useState<UpdaterState>(() => updaterService.getState())

  useEffect(() => {
    return updaterService.subscribe((next) => {
      setState(next)
    })
  }, [])

  return state
}
