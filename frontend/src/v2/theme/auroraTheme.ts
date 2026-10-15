import { createTheme } from '@mui/material/styles'
import {
  auroraColors,
  auroraGradients,
  auroraShadows,
  auroraTypography,
} from './auroraTokens'

export function getAuroraTheme(mode: 'dark' | 'light') {
  const c = mode === 'dark' ? auroraColors.dark : auroraColors.light
  const s = mode === 'dark' ? auroraShadows.dark : auroraShadows.light

  return createTheme({
    palette: {
      mode,
      primary: {
        main: c.accentPurple,
        light: mode === 'dark' ? '#AB75FC' : '#8E4DF0',
        dark: mode === 'dark' ? '#813BF5' : '#5E1BBF',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: c.accentBlue,
        light: mode === 'dark' ? '#688CFA' : '#4871F5',
        dark: mode === 'dark' ? '#2955E6' : '#1D43B8',
        contrastText: '#FFFFFF',
      },
      info: {
        main: c.accentCyan,
        light: mode === 'dark' ? '#3CD6E8' : '#0EBAD0',
        dark: mode === 'dark' ? '#0EBAD0' : '#006C7E',
        contrastText: '#FFFFFF',
      },
      background: {
        default: c.canvas,
        paper: c.card,
      },
      text: {
        primary: c.textPrimary,
        secondary: c.textSecondary,
      },
      divider: c.border,
      success: {
        main: c.success,
      },
      warning: {
        main: c.warning,
      },
      error: {
        main: c.error,
      },
    },
    typography: {
      fontFamily: auroraTypography.fontBody,
      h1: {
        fontFamily: auroraTypography.fontHeading,
        fontWeight: 700,
        letterSpacing: '-0.03em',
      },
      h2: {
        fontFamily: auroraTypography.fontHeading,
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      h3: {
        fontFamily: auroraTypography.fontHeading,
        fontWeight: 600,
        letterSpacing: '-0.015em',
      },
      h4: {
        fontFamily: auroraTypography.fontHeading,
        fontWeight: 600,
        letterSpacing: '-0.01em',
      },
      h5: {
        fontFamily: auroraTypography.fontHeading,
        fontWeight: 600,
      },
      h6: {
        fontFamily: auroraTypography.fontHeading,
        fontWeight: 600,
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        fontFamily: auroraTypography.fontBody,
      },
    },
    shape: {
      borderRadius: 16,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: c.canvas,
            color: c.textPrimary,
            fontFamily: auroraTypography.fontBody,
            overflowX: 'hidden',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: c.card,
            backgroundImage: 'none',
            borderRadius: 18,
            border: `1px solid ${c.border}`,
            boxShadow: s.md,
            transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
            '&:hover': {
              borderColor: c.borderStrong,
              boxShadow: s.hoverTilt,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            padding: '10px 22px',
            fontSize: '14.5px',
            fontWeight: 600,
            transition: 'all 200ms ease',
          },
          contained: {
            background: auroraGradients.primary,
            color: '#FFFFFF',
            boxShadow: mode === 'dark'
              ? '0 4px 18px rgba(151, 87, 250, 0.35)'
              : '0 4px 16px rgba(77, 119, 249, 0.28)',
            '&:hover': {
              background: auroraGradients.primaryHover,
              boxShadow: mode === 'dark'
                ? '0 6px 24px rgba(151, 87, 250, 0.50)'
                : '0 6px 22px rgba(77, 119, 249, 0.40)',
              transform: 'translateY(-1px)',
            },
          },

        },
      },
    },
  })
}

