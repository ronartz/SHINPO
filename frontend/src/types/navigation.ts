export type AppView =
  | 'Dashboard'
  | 'Goals & Missions'
  | 'Focus Engine'
  | 'Schedule'
  | 'Analytics'
  | 'Task Manager'
  | 'AI Assistant'

export type IconName =
  | 'dashboard'
  | 'quests'
  | 'schedule'
  | 'goals'
  | 'focus'
  | 'analytics'
  | 'apps'
  | 'journal'
  | 'rewards'
  | 'settings'
  | 'search'
  | 'bell'
  | 'moon'
  | 'sun'
  | 'chevron'
  | 'chevron-left'
  | 'chevron-right'
  | 'menu'
  | 'play'
  | 'pause'
  | 'check'
  | 'plus'
  | 'target'
  | 'clock'
  | 'xp'
  | 'close'
  | 'sparkle'
  | 'refresh'
  | 'arrow-up-right'
  | 'power'
  | 'trash'
  | 'edit'
  | 'zap'
  | 'shield'
  | 'lock'

export interface NavItemConfig {
  id: AppView
  icon: IconName
  label: string
  tut: string
  hasBadge?: boolean
}

export const NAVIGATION_ITEMS: readonly NavItemConfig[] = [
  { id: 'Dashboard', icon: 'dashboard', label: 'Dashboard', tut: 'nav-dashboard' },
  { id: 'Goals & Missions', icon: 'goals', label: 'Goals', tut: 'nav-goals' },
  { id: 'Focus Engine', icon: 'focus', label: 'Focus', tut: 'nav-focus' },
  { id: 'Schedule', icon: 'schedule', label: 'Calendar', tut: 'nav-schedule', hasBadge: true },
  { id: 'Analytics', icon: 'analytics', label: 'Analytics', tut: 'nav-analytics' },
  { id: 'Task Manager', icon: 'apps', label: 'Task Manager', tut: 'nav-tasks' },
  { id: 'AI Assistant', icon: 'sparkle', label: 'EONPAI', tut: 'nav-ai' },
] as const

export function getViewHeaderTitle(view: AppView): string {
  switch (view) {
    case 'AI Assistant':
      return 'EONPAI'
    case 'Focus Engine':
      return 'Focus'
    case 'Goals & Missions':
      return 'Goals & Tasks'
    case 'Schedule':
      return 'Calendar'
    case 'Dashboard':
      return 'Dashboard'
    default:
      return view
  }
}

