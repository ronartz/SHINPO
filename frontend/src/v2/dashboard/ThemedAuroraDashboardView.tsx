import { ThemeProvider } from '@mui/material'
import { getAuroraTheme } from '../theme/auroraTheme'
import { AuroraDashboardView } from './AuroraDashboardView'
import type { AuroraDashboardViewProps } from './AuroraDashboardView'

export function ThemedAuroraDashboardView(props: AuroraDashboardViewProps) {
  return (
    <ThemeProvider theme={getAuroraTheme(props.isDarkMode ? 'dark' : 'light')}>
      <AuroraDashboardView {...props} />
    </ThemeProvider>
  )
}
