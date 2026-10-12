import React from 'react'
import { Sidebar } from './Sidebar'
import type { SidebarProps } from './Sidebar'
import { TopBar } from './TopBar'
import type { TopBarProps } from './TopBar'

export interface AppShellProps {
  isDarkMode: boolean
  sidebarExpanded: boolean
  sidebarProps: SidebarProps
  topBarProps: TopBarProps
  children: React.ReactNode
  modals?: React.ReactNode
}

export const AppShell: React.FC<AppShellProps> = ({
  isDarkMode,
  sidebarExpanded,
  sidebarProps,
  topBarProps,
  children,
  modals,
}) => {
  return (
    <div className={`app-shell ${isDarkMode ? '' : 'theme-light'}`}>
      <Sidebar {...sidebarProps} />
      <main className={`app-main ${sidebarExpanded ? 'sidebar-expanded' : ''}`}>
        <TopBar {...topBarProps} />
        {children}
      </main>
      {modals}
    </div>
  )
}

