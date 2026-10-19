import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface PortalProps {
  children: React.ReactNode
  containerId?: string
}

export const Portal: React.FC<PortalProps> = ({ children, containerId = 'shinpo-portal-root' }) => {
  const [container] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null
    let el = document.getElementById(containerId)
    if (!el) {
      el = document.createElement('div')
      el.id = containerId
      document.body.appendChild(el)
    }
    return el
  })

  useEffect(() => {
    return () => {
      // Keep root container alive across popovers
    }
  }, [containerId])

  if (!container) return null
  return createPortal(children, container)
}

