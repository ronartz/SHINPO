import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Icon } from './Icon'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('[SHINPO ErrorBoundary] Uncaught rendering exception:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          role="alert"
          style={{
            padding: '32px 24px',
            margin: '24px auto',
            maxWidth: '680px',
            background: 'color-mix(in srgb, var(--brand-primary) 8.0%, transparent)',
            border: '1px solid color-mix(in srgb, var(--brand-primary) 25.0%, transparent)',
            borderRadius: '16px',
            color: 'var(--text, #e7e7e7)',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Icon name="shield" size={22} />
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Something went wrong in this view
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-3, #5d5d5d)' }}>
                SHINPO captured this error without crashing the rest of your session.
              </p>
            </div>
          </div>

          {this.state.error && (
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(0,0,0, 0.4)',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '12.5px',
                color: 'var(--brand-primary)',
                marginBottom: '16px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.toString()}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: 'var(--primary-violet, var(--brand-primary))',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'rgba(255,255,255, 0.08)',
                color: 'var(--text, #e7e7e7)',
                border: '1px solid rgba(255,255,255, 0.15)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

