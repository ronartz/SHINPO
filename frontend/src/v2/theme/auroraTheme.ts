import { createTheme } from '@mui/material/styles'
import {
  auroraColors,
  auroraColorFallbacks,
  auroraShadows,
  auroraTypography,
} from './auroraTokens.ts'

export function getAuroraTheme(mode: 'dark' | 'light') {
  const tokens = auroraColors[mode]
  const fallback = auroraColorFallbacks[mode] as Record<string, string>
  const computed = typeof document === 'undefined' || document.documentElement.dataset.brand !== 'aurora'
    ? undefined
    : getComputedStyle(document.documentElement)
  const c = Object.fromEntries(Object.entries(tokens).map(([key, value]) => {
    const token = /^var\((--[\w-]+)/.exec(value)?.[1]
    return [key, (token ? computed?.getPropertyValue(token).trim() : value) || fallback[key]]
  })) as typeof fallback
  const s = mode === 'dark' ? auroraShadows.dark : auroraShadows.light

  return createTheme({
    palette: {
      mode,
      primary: {
        main: c.primaryBlue,
        light: c.primaryHover,
        dark: c.primaryBlue,
        contrastText: c.onPrimary,
      },
      secondary: {
        main: c.primaryBlue,
        light: c.primaryHover,
        dark: c.primaryBlue,
        contrastText: c.onPrimary,
      },
      info: {
        main: c.info,
        light: c.primaryBlue,
        dark: c.primaryBlue,
        contrastText: c.onPrimary,
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
        light: c.success,
        dark: c.success,
        contrastText: c.onSuccess,
      },
      warning: {
        main: c.warning,
        light: c.warning,
        dark: c.warning,
        contrastText: c.onWarning,
      },
      error: {
        main: c.error,
        light: c.error,
        dark: c.error,
        contrastText: c.onError,
      },
    },
    typography: {
      fontFamily: auroraTypography.fontFamily,
      allVariants: {
        fontFamily: auroraTypography.fontFamily,
      },
      h1: {
        fontFamily: auroraTypography.fontHeading,
        fontSize: '28px',
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
        fontSize: '22px',
        fontWeight: 700,
        letterSpacing: '-0.015em',
      },
      h4: {
        fontFamily: auroraTypography.fontHeading,
        fontSize: '18px',
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
              outline: `2px solid ${c.focusCyan}`,
              outlineOffset: 2,
            },
          },
          contained: {
            backgroundColor: c.primaryBlue,
            color: c.onPrimary,
            boxShadow: mode === 'dark'
              ? '0 1px 3px rgba(0,0,0, 0.25)'
              : '0 1px 2px rgba(0,0,0, 0.08)',
            '&:hover': {
              backgroundColor: c.primaryHover,
              color: c.onPrimary,
              boxShadow: mode === 'dark'
                ? '0 2px 6px rgba(0,0,0, 0.30)'
                : '0 2px 5px rgba(0,0,0, 0.12)',
              transform: 'translateY(-1px)',
            },
          },
          outlined: {
            borderColor: c.border,
            color: c.textPrimary,
            '&:hover': {
              borderColor: c.primaryBlue,
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            fontFamily: auroraTypography.fontBody,
            borderRadius: 10,
            backgroundColor: c.canvasSecondary,
            borderColor: c.border,
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: c.borderStrong,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: c.primaryBlue,
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
              color: c.primaryBlue,
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: c.canvasSecondary,
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
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
            },
            '&.Mui-selected': {
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
              fontWeight: 700,
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: c.card,
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
            backgroundColor: c.canvas,
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
            backgroundColor: c.primaryBlue,
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
              color: c.primaryBlue,
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

