export function guardianCapabilityLabel(capability?: string | null): string {
  switch (capability) {
    case 'STRICT_LINUX_COOPERATIVE_CLOSE':
    case 'STRICT_WARNING_ONLY': return 'Strict · warning-only; app closure disabled'
    case 'STANDARD_SAMPLED_RUNTIME_ALLOWANCE':
    case 'STANDARD_WARNING_ONLY': return 'Standard · warning-only'
    case 'STANDARD_COOPERATIVE_CLOSE_READY': return 'Standard · warning-only; app closure disabled'
    case 'BREAK_OBSERVATION_ONLY': return 'Break · observation only'
    case 'GRACE_WARNING_ONLY': return 'Grace period · warning only'
    case 'RETURN_REQUIRED_WARNING_ONLY': return 'Return required · warning only'
    case 'SESSION_PAUSED': return 'Paused with Focus'
    case 'INACTIVE': return 'Inactive'
    case 'MONITORING_DISABLED': return 'App observation is off'
    case 'EMERGENCY_STOPPED': return 'Stopped for this session'
    case 'LIMITED_OBSERVER_UNAVAILABLE': return 'Limited · observer unavailable'
    case 'LIMITED_OBSERVER_STARTING': return 'Starting app observation'
    case 'LIMITED_PLATFORM_UNSUPPORTED': return 'Limited · app intervention unavailable on this platform'
    case 'LIMITED_NO_CLOSURE_CONSENT': return 'Monitoring only · app closure disabled'
    case 'LIMITED_NO_RUNTIME_CONSENT': return 'Monitoring only · runtime allowance consent is off'
    case 'LOCKED': return 'Vault locked'
    default: return 'Monitoring · no app action confirmed'
  }
}

export function guardianInterventionDescription(capability?: string | null): string {
  switch (capability) {
    case 'STRICT_LINUX_COOPERATIVE_CLOSE':
    case 'STRICT_WARNING_ONLY':
      return 'Strict reports recognized app observations immediately. This release does not close applications.'
    case 'STANDARD_SAMPLED_RUNTIME_ALLOWANCE':
    case 'STANDARD_WARNING_ONLY':
      return 'Standard may sample recognized app-running time when enabled. This release reports warnings and does not close applications.'
    case 'STANDARD_COOPERATIVE_CLOSE_READY':
      return 'Monitoring only: application closure is disabled in this release.'
    case 'LIMITED_NO_CLOSURE_CONSENT':
      return 'Monitoring only: application closure is disabled in this release.'
    case 'LIMITED_NO_RUNTIME_CONSENT':
      return 'Monitoring only: Standard runtime-allowance consent is off.'
    case 'LIMITED_PLATFORM_UNSUPPORTED':
      return 'This platform supports observation only; app closure is unavailable.'
    case 'LIMITED_IDENTITY_UNVERIFIED':
      return 'Monitoring only: the observed process identity could not be verified.'
    case 'LIMITED_OBSERVER_UNAVAILABLE':
      return 'Monitoring is unavailable; no app action is being taken.'
    case 'BREAK_OBSERVATION_ONLY':
      return 'Break phase: apps are observed, and no close request is made.'
    case 'GRACE_WARNING_ONLY':
    case 'RETURN_REQUIRED_WARNING_ONLY':
      return 'Warning only during this Focus phase; no app close request is made.'
    case 'SESSION_PAUSED':
      return 'Focus is paused; app intervention is not active.'
    case 'EMERGENCY_STOPPED':
      return 'Guardian is stopped for this session; no app intervention is active.'
    case 'INACTIVE':
      return 'App observation and intervention begin only during an eligible Focus session.'
    case 'LOCKED':
      return 'The vault is locked; Guardian cannot observe or intervene.'
    default:
      return 'Monitoring only: current status does not confirm an app action.'
  }
}

export function guardianCanRequestClose(_capability?: string | null, _warningOnly?: boolean): boolean {
  return false
}

export function guardianOutcomeLabel(outcome?: string | null): string {
  switch (outcome) {
    case 'ALLOWED_BREAK': return 'Allowed during break'
    case 'WARNING_GRACE': return 'Warning during grace period'
    case 'WARNING_RETURN_REQUIRED': return 'Warning · return required'
    case 'WARNING_LIGHT': return 'Observed · Light mode'
    case 'WARNING_STANDARD': return 'Observed · Standard mode'
    case 'WARNING_STRICT': return 'Observed · Strict mode'
    case 'WARNING_STRICT_ENFORCEMENT_DISABLED': return 'Strict · warning only; no app closed'
    case 'WARNING_ALLOWANCE_ENFORCEMENT_DISABLED': return 'Standard · warning only; no app closed'
    case 'CLOSE_REQUESTED_UNCONFIRMED': return 'Graceful close requested · exit unconfirmed'
    case 'LIMITED_IDENTITY_UNVERIFIED': return 'Limited · process identity unverified'
    case 'LIMITED_NO_CLOSURE_CONSENT': return 'Limited · close consent is off'
    case 'LIMITED_CLOSE_UNAVAILABLE': return 'Limited · graceful close unavailable'
    default: return outcome?.replaceAll('_', ' ').toLowerCase() || 'Outcome unavailable'
  }
}

export function guardianObserverLabel(status?: string | null): string {
  switch (status) {
    case 'MONITORING': return 'Monitoring'
    case 'STARTING': return 'Starting'
    case 'DEGRADED': return 'Unavailable'
    case 'IDLE': return 'Off'
    case 'PAUSED': return 'Paused'
    case 'LOCKED': return 'Vault locked'
    default: return 'Status unavailable'
  }
}

export function guardianModeLabel(mode?: string | null): string {
  switch (mode) {
    case 'GUIDED': return 'Light'
    case 'PROTECTED': return 'Standard'
    case 'STRICT': return 'Strict'
    default: return 'Not set'
  }
}
