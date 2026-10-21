import React, { useState } from 'react'
import {
  ShinpoSelect,
  ShinpoDatePicker,
  ShinpoTimePicker,
  ShinpoDialog,
  ShinpoConfirmDialog,
  ShinpoTextField,
  ShinpoTextArea,
  ShinpoButton,
  ShinpoCheckbox,
  ShinpoSwitch,
  ShinpoTooltip,
  ShinpoToast,
} from '../components/ui'
import type { SelectOption } from '../components/ui/Select/types'

const STATUS_OPTIONS: SelectOption<string>[] = [
  { value: 'ACTIVE', label: 'Active Execution', secondaryLabel: 'In progress' },
  { value: 'PAUSED', label: 'Paused Focus', secondaryLabel: 'On hold' },
  { value: 'COMPLETED', label: 'Completed Milestone', secondaryLabel: 'Finished' },
  { value: 'ABANDONED', label: 'Archived / Abandoned', disabled: true },
]

const POLICY_OPTIONS: SelectOption<string>[] = [
  { value: 'KILL', label: 'Emergency Kill Process (Hard Stop)', secondaryLabel: 'SIGKILL immediately' },
  { value: 'SUSPEND', label: 'Suspend Execution (SIGSTOP)', secondaryLabel: 'Freezes target thread' },
  { value: 'ALERT', label: 'Alert Cockpit & Log Event', secondaryLabel: 'Passive warning' },
  { value: 'ALLOW', label: 'Allow Unrestricted Execution', secondaryLabel: 'No restriction' },
]

const LONG_OPTIONS: SelectOption<string>[] = [
  {
    value: 'opt1',
    label: 'Cloud Infrastructure Observability Pipeline with Deep Tracing & OpenTelemetry Gateway',
  },
  {
    value: 'opt2',
    label: 'High-Throughput Reactive WebSocket Broker Architecture with Multi-Core Affinity',
  },
  {
    value: 'opt3',
    label: 'Low-Latency Native Memory Protection Shield with Real-Time Kernel Probe Telemetry',
  },
]

export const UiComponentGallery: React.FC = () => {
  // Theme and Motion state for interactive testing
  const [themeMode, setThemeMode] = useState<'aurora-dark' | 'aurora-light' | 'classic-dark' | 'classic-light'>('aurora-dark')
  const [reducedMotion, setReducedMotion] = useState(false)

  // Select States
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE')
  const [selectedPolicy, setSelectedPolicy] = useState<string>('KILL')
  const [selectedLong, setSelectedLong] = useState<string>('opt1')
  const [edgeSelectVal, setEdgeSelectVal] = useState<string>('ACTIVE')

  // Date Picker States
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-16')
  const [restrictedDate, setRestrictedDate] = useState<string>('2026-10-20')

  // Time Picker State
  const [selectedTime, setSelectedTime] = useState<string>('09:30')

  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogSelectVal, setDialogSelectVal] = useState('ACTIVE')
  const [dialogDateVal, setDialogDateVal] = useState('2026-10-16')
  const [dialogTimeVal, setDialogTimeVal] = useState('14:00')

  // Confirm Dialog State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDestructiveConfirm, setIsDestructiveConfirm] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Other form controls state
  const [textInputVal, setTextInputVal] = useState('Shinpo Personal OS')
  const [textAreaVal, setTextAreaVal] = useState('Designed for four-user private beta with zero defects.')
  const [checkboxVal, setCheckboxVal] = useState(true)
  const [switchVal, setSwitchVal] = useState(true)

  // Sync theme changes to document
  const handleThemeChange = (mode: 'aurora-dark' | 'aurora-light' | 'classic-dark' | 'classic-light') => {
    setThemeMode(mode)
    const isDark = mode.includes('dark')
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }

  const getWrapperClasses = () => {
    const isDark = themeMode.includes('dark')
    const isAurora = themeMode.includes('aurora')
    return `gallery-root ${isDark ? 'theme-dark' : 'theme-light'} ${isAurora ? 'theme-aurora aurora-viewport' : 'theme-classic'}`
  }

  return (
    <div
      className={getWrapperClasses()}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        color: 'var(--text)',
        padding: '32px 24px',
        fontFamily: 'inherit',
      }}
    >
      {/* Gallery Header & Controller */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 32,
          padding: '16px 20px',
          backgroundColor: 'var(--surface-card, #1D1E24)',
          border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.12))',
          borderRadius: 14,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            SHINPO UI Core Component Gallery
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-2, #B0B5C2)' }}>
            Authoritative test workbench for custom dropdowns, date/time pickers, dialogs, and form primitives.
          </p>
        </div>

        {/* Live Theme Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, backgroundColor: 'var(--surface-subtle, #24252D)', padding: 4, borderRadius: 8 }}>
            {(['aurora-dark', 'aurora-light', 'classic-dark', 'classic-light'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`shinpo-btn ${themeMode === t ? 'variant-primary' : 'variant-ghost'} size-sm`}
                onClick={() => handleThemeChange(t)}
                style={{ fontSize: 12, padding: '0 8px', height: 28 }}
              >
                {t.replace('-', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`shinpo-btn ${reducedMotion ? 'variant-primary' : 'variant-secondary'} size-sm`}
            onClick={() => setReducedMotion(!reducedMotion)}
            style={{ fontSize: 12, height: 28 }}
          >
            {reducedMotion ? 'Reduced Motion: ON' : 'Reduced Motion: OFF'}
          </button>
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* Card 1: Custom Select */}
        <div
          className="gallery-card"
          style={{
            backgroundColor: 'var(--surface-card, #1D1E24)',
            border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.12))',
            borderRadius: 14,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', paddingBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>1. Custom ShinpoSelect</h2>
            <span style={{ fontSize: 12, color: 'var(--text-3, #9096A4)' }}>
              Keyboard navigation (Up/Down/Home/End/Enter/Esc), zero OS popups, portals.
            </span>
          </div>

          {/* Standard Select */}
          <ShinpoSelect
            id="gallery-select-standard"
            label="Goal Status (Controlled Value)"
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={STATUS_OPTIONS}
            helperText="Currently active goal execution lifecycle status"
          />

          {/* Searchable Policy Select */}
          <ShinpoSelect
            id="gallery-select-policy"
            label="Sentinel Policy Action (Searchable Filter)"
            value={selectedPolicy}
            onChange={setSelectedPolicy}
            options={POLICY_OPTIONS}
            searchable
            helperText="Type to filter enforcement policies"
          />

          {/* Long Option Labels */}
          <ShinpoSelect
            id="gallery-select-long"
            label="Long Option Text Truncation & Tooltip"
            value={selectedLong}
            onChange={setSelectedLong}
            options={LONG_OPTIONS}
          />

          {/* Disabled & Error States */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ShinpoSelect
              id="gallery-select-disabled"
              label="Disabled Select"
              value="ACTIVE"
              onChange={() => {}}
              options={STATUS_OPTIONS}
              disabled
            />
            <ShinpoSelect
              id="gallery-select-error"
              label="Validation Error State"
              value=""
              onChange={() => {}}
              options={STATUS_OPTIONS}
              placeholder="Select required..."
              errorMessage="Status is mandatory"
              required
            />
          </div>
        </div>

        {/* Card 2: Custom Date & Time Pickers */}
        <div
          className="gallery-card"
          style={{
            backgroundColor: 'var(--surface-card, #1D1E24)',
            border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.12))',
            borderRadius: 14,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', paddingBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>2. Date & Time Pickers</h2>
            <span style={{ fontSize: 12, color: 'var(--text-3, #9096A4)' }}>
              7-column calendar grid, leap-year local math, 24h scroll columns.
            </span>
          </div>

          {/* Controlled Date Picker */}
          <ShinpoDatePicker
            id="gallery-datepicker"
            label="Target Completion Date (YYYY-MM-DD)"
            value={selectedDate}
            onChange={setSelectedDate}
            helperText={`Selected date: ${selectedDate || 'None'}`}
          />

          {/* Restricted Date Picker */}
          <ShinpoDatePicker
            id="gallery-datepicker-restricted"
            label="Restricted Window (Min: 2026-10-10, Max: 2026-10-25)"
            value={restrictedDate}
            onChange={setRestrictedDate}
            minDate="2026-10-10"
            maxDate="2026-10-25"
          />

          {/* Time Picker */}
          <ShinpoTimePicker
            id="gallery-timepicker"
            label="Scheduled Session Start Time (HH:mm 24h)"
            value={selectedTime}
            onChange={setSelectedTime}
            stepMinutes={15}
            helperText={`Selected start time: ${selectedTime}`}
          />
        </div>

        {/* Card 3: Dialogs & Nested Popovers */}
        <div
          className="gallery-card"
          style={{
            backgroundColor: 'var(--surface-card, #1D1E24)',
            border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.12))',
            borderRadius: 14,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', paddingBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>3. Dialogs & Nested Popups</h2>
            <span style={{ fontSize: 12, color: 'var(--text-3, #9096A4)' }}>
              Focus trapping, body scroll locking, z-index: 9500 for nested menus.
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              id="btn-open-gallery-dialog"
              type="button"
              className="shinpo-btn variant-primary size-md"
              onClick={() => setIsDialogOpen(true)}
            >
              Open Dialog with Nested Controls
            </button>

            <button
              id="btn-open-confirm-dialog"
              type="button"
              className="shinpo-btn variant-secondary size-md"
              onClick={() => {
                setIsDestructiveConfirm(false)
                setIsConfirmOpen(true)
              }}
            >
              Open Confirm Dialog
            </button>

            <button
              id="btn-open-destructive-confirm"
              type="button"
              className="shinpo-btn variant-danger size-md"
              onClick={() => {
                setIsDestructiveConfirm(true)
                setIsConfirmOpen(true)
              }}
            >
              Open Destructive Dialog
            </button>
          </div>

          {/* Edge Boundary Test Select */}
          <div
            style={{
              marginTop: 16,
              padding: 16,
              backgroundColor: 'rgba(0, 0, 0, 0.16)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-cyan, #1BC9DE)' }}>
              Viewport Edge Boundary Protection:
            </span>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: 180 }}>
                <ShinpoSelect
                  id="gallery-select-edge"
                  size="sm"
                  value={edgeSelectVal}
                  onChange={setEdgeSelectVal}
                  options={STATUS_OPTIONS}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Form Primitives & Buttons */}
        <div
          className="gallery-card"
          style={{
            backgroundColor: 'var(--surface-card, #1D1E24)',
            border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.12))',
            borderRadius: 14,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', paddingBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>4. Form Primitives & Feedback</h2>
            <span style={{ fontSize: 12, color: 'var(--text-3, #9096A4)' }}>
              Buttons, TextFields, TextAreas, Checkboxes, Switches, Tooltips, Toasts.
            </span>
          </div>

          <ShinpoTextField
            id="gallery-textfield"
            label="Application Name"
            value={textInputVal}
            onChange={(e) => setTextInputVal(e.target.value)}
          />

          <ShinpoTextArea
            id="gallery-textarea"
            label="System Mission Brief"
            value={textAreaVal}
            onChange={(e) => setTextAreaVal(e.target.value)}
            rows={2}
          />

          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <ShinpoCheckbox
              id="gallery-checkbox"
              label="Enable Autonomous Sentinel"
              checked={checkboxVal}
              onChange={setCheckboxVal}
            />

            <ShinpoSwitch
              id="gallery-switch"
              label="Strict Policy Enforcement"
              checked={switchVal}
              onChange={setSwitchVal}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <ShinpoTooltip content="Aurora Gradient Button with hover glow">
              <button type="button" className="shinpo-btn variant-primary size-sm">
                Hover for Tooltip
              </button>
            </ShinpoTooltip>

            <ShinpoButton variant="secondary" size="sm">
              Secondary
            </ShinpoButton>

            <ShinpoButton variant="ghost" size="sm">
              Ghost
            </ShinpoButton>

            <ShinpoButton variant="danger" size="sm">
              Danger
            </ShinpoButton>
          </div>

          <ShinpoToast
            type="success"
            title="System Operational"
            message="All UI Core components compiled and rendered cleanly."
          />
        </div>
      </div>

      {/* Modal Dialog with Nested Popups */}
      <ShinpoDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Schedule Deep Focus Session"
        description="Verify that nested dropdowns and date pickers appear on top of dialog card."
        size="md"
      >
        <ShinpoDialog.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ShinpoSelect
              id="dialog-nested-select"
              label="Target Goal Status"
              value={dialogSelectVal}
              onChange={setDialogSelectVal}
              options={STATUS_OPTIONS}
            />

            <ShinpoDatePicker
              id="dialog-nested-datepicker"
              label="Session Date"
              value={dialogDateVal}
              onChange={setDialogDateVal}
            />

            <ShinpoTimePicker
              id="dialog-nested-timepicker"
              label="Session Time"
              value={dialogTimeVal}
              onChange={setDialogTimeVal}
            />
          </div>
        </ShinpoDialog.Body>
        <ShinpoDialog.Footer>
          <button
            type="button"
            className="shinpo-btn variant-secondary size-md"
            onClick={() => setIsDialogOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="shinpo-btn variant-primary size-md"
            onClick={() => setIsDialogOpen(false)}
          >
            Save Session
          </button>
        </ShinpoDialog.Footer>
      </ShinpoDialog>

      {/* Accessible Confirmation Dialog */}
      <ShinpoConfirmDialog
        isOpen={isConfirmOpen}
        title={isDestructiveConfirm ? 'Permanently Delete Workspace?' : 'Confirm Session Launch'}
        message={
          isDestructiveConfirm
            ? 'This action cannot be undone. All temporary session checkpoints will be deleted.'
            : 'Start 25-minute deep focus block with Sentinel enforcement mode active?'
        }
        isDestructive={isDestructiveConfirm}
        isLoading={confirmLoading}
        confirmLabel={isDestructiveConfirm ? 'Delete Permanently' : 'Start Focus'}
        onConfirm={() => {
          setConfirmLoading(true)
          setTimeout(() => {
            setConfirmLoading(false)
            setIsConfirmOpen(false)
          }, 600)
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  )
}
export default UiComponentGallery

