import { createTheme } from '@mui/material/styles'
import {
  auroraColors,
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
      fontFamily: auroraTypography.fontFamily,
      allVariants: {
        fontFamily: auroraTypography.fontFamily,
      },
      h1: {
        fontFamily: auroraTypography.fontHeading,
        fontSize: '32px',
        fontWeight: 800,
        letterSpacing: '-0.025em',
      },
      h2: {
        fontFamily: auroraTypography.fontHeading,
        fontSize: '28px',
        fontWeight: 800,
        letterSpacing: '-0.02em',
      },
      h3: {
        fontFamily: auroraTypography.fontHeading,
        fontSize: '24px',
        fontWeight: 700,
        letterSpacing: '-0.015em',
      },
      h4: {
        fontFamily: auroraTypography.fontHeading,
        fontSize: '20px',
        fontWeight: 700,
        letterSpacing: '-0.01em',
      },
      h5: {
        fontFamily: auroraTypography.fontHeading,
        fontSize: '18px',
        fontWeight: 700,
      },
      h6: {
        fontFamily: auroraTypography.fontHeading,
        fontSize: '16px',
        fontWeight: 700,
      },
      subtitle1: {
        fontFamily: auroraTypography.fontBody,
        fontSize: '16px',
        fontWeight: 650,
      },
      subtitle2: {
        fontFamily: auroraTypography.fontBody,
        fontSize: '15px',
        fontWeight: 650,
      },
      body1: {
        fontFamily: auroraTypography.fontBody,
        fontSize: '15px',
        fontWeight: 400,
      },
      body2: {
        fontFamily: auroraTypography.fontBody,
        fontSize: '14px',
        fontWeight: 500,
      },
      button: {
        textTransform: 'none',
        fontSize: '14px',
        fontWeight: 700,
        fontFamily: auroraTypography.fontBody,
      },
      caption: {
        fontFamily: auroraTypography.fontBody,
        fontSize: '12.5px',
        fontWeight: 500,
      },
      overline: {
        fontFamily: auroraTypography.fontBody,
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.08em',
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
            fontFamily: auroraTypography.fontBody,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            padding: '8px 20px',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: auroraTypography.fontBody,
            transition: 'all 180ms ease',
            '&:focus-visible': {
              outline: `2px solid ${c.accentPurple}`,
              outlineOffset: 2,
            },
          },
          contained: {
            backgroundColor: c.accentPurple,
            color: '#FFFFFF',
            boxShadow: mode === 'dark'
              ? '0 1px 3px rgba(0, 0, 0, 0.25)'
              : '0 1px 2px rgba(0, 0, 0, 0.08)',
            '&:hover': {
              backgroundColor: mode === 'dark' ? '#AB75FC' : '#1E3694',
              boxShadow: mode === 'dark'
                ? '0 2px 6px rgba(0, 0, 0, 0.30)'
                : '0 2px 5px rgba(0, 0, 0, 0.12)',
              transform: 'translateY(-1px)',
            },
          },
          outlined: {
            borderColor: c.border,
            color: c.textPrimary,
            '&:hover': {
              borderColor: c.accentPurple,
              backgroundColor: mode === 'dark' ? 'rgba(49, 86, 216, 0.08)' : 'rgba(40, 71, 184, 0.06)',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            fontFamily: auroraTypography.fontBody,
            borderRadius: 10,
            backgroundColor: mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: c.border,
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: c.borderStrong,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: c.accentPurple,
              borderWidth: '1.5px',
            },
          },
          input: {
            fontFamily: auroraTypography.fontBody,
            fontSize: '14px',
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontFamily: auroraTypography.fontBody,
            fontSize: '14px',
            color: c.textSecondary,
            '&.Mui-focused': {
              color: c.accentPurple,
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: mode === 'dark' ? 'rgba(21, 28, 48, 0.94)' : 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            boxShadow: s.lg,
            fontFamily: auroraTypography.fontBody,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontFamily: auroraTypography.fontBody,
            fontSize: '13.5px',
            fontWeight: 600,
            padding: '8px 14px',
            borderRadius: 8,
            margin: '2px 6px',
            color: c.textPrimary,
            transition: 'background-color 150ms ease',
            '&:hover': {
              backgroundColor: mode === 'dark' ? 'rgba(49, 86, 216, 0.12)' : 'rgba(40, 71, 184, 0.08)',
            },
            '&.Mui-selected': {
              backgroundColor: mode === 'dark' ? 'rgba(49, 86, 216, 0.2)' : 'rgba(40, 71, 184, 0.12)',
              fontWeight: 700,
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: mode === 'dark' ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.97)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${c.border}`,
            borderRadius: 20,
            boxShadow: s.lg,
            fontFamily: auroraTypography.fontBody,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: auroraTypography.fontHeading,
            fontWeight: 800,
            fontSize: '18px',
            color: c.textPrimary,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: mode === 'dark' ? 'rgba(15, 23, 42, 0.96)' : 'rgba(30, 41, 59, 0.96)',
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            fontFamily: auroraTypography.fontBody,
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: s.md,
            padding: '6px 12px',
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            fontFamily: auroraTypography.fontBody,
          },
          indicator: {
            backgroundColor: c.accentPurple,
            height: 3,
            borderRadius: '3px 3px 0 0',
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            fontFamily: auroraTypography.fontBody,
            textTransform: 'none',
            fontSize: '14px',
            fontWeight: 700,
            color: c.textSecondary,
            '&.Mui-selected': {
              color: c.accentPurple,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontFamily: auroraTypography.fontBody,
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: 8,
          },
        },
      },
    },
  })
}

