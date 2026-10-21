import React, { useMemo, useState } from 'react'
import type { FocusSession } from '../api/focusSessions'
import type { AppView } from '../types/navigation'
import { Icon } from '../components/common/Icon'
import { trackRender } from '../utils/renderTracker'

const formatLocalCalendarDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const localCalendarDate = (date = new Date()): string => formatLocalCalendarDate(date)
const localCalendarDateFromInstant = (instant: string | null | undefined): string | null => instant ? localCalendarDate(new Date(instant)) : null
const sessionDate = (session: FocusSession) => localCalendarDateFromInstant(session.scheduledAt) || localCalendarDateFromInstant(session.startedAt) || localCalendarDateFromInstant(session.createdAt)
const dayStart = (date: Date) => {
  const start = new Date(date)
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  start.setHours(0, 0, 0, 0)
  return start
}
const changeDate = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  return formatLocalCalendarDate(date)
}

export interface ScheduleViewProps {
  sessions: FocusSession[]
  selectedScheduleDate: string
  setSelectedScheduleDate: (date: string) => void
  setActiveTab: (tab: AppView) => void
  handleOpenBookingModal: (defaultDate?: string, presetDuration?: number, presetPlan?: string) => void
  handleStartFromSchedule: (sessionId: number) => void
  handleCancelFromSchedule: (sessionId: number) => void
  handleDeleteSession: (sessionId: number) => void
  handleEditSession?: (session: FocusSession) => void
}

import { trackRender } from '../utils/renderTracker'

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  sessions, selectedScheduleDate, setSelectedScheduleDate, setActiveTab,
  handleOpenBookingModal, handleStartFromSchedule, handleCancelFromSchedule,
  handleDeleteSession, handleEditSession,
}) => {
  trackRender('ScheduleView')
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL')
  const [miniMonth, setMiniMonth] = useState(() => new Date(`${selectedScheduleDate}T00:00:00`))

  const weekDays = useMemo(() => {
    const monday = dayStart(new Date(`${selectedScheduleDate}T00:00:00`))
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      const dateStr = localCalendarDate(date)
      return { date, dateStr, dayName: date.toLocaleDateString('en-US', { weekday: 'short' }), dayNum: date.getDate(), isToday: dateStr === localCalendarDate() }
    })
  }, [selectedScheduleDate])

  const monthCells = useMemo(() => {
    const first = new Date(miniMonth.getFullYear(), miniMonth.getMonth(), 1)
    const start = new Date(first)
    start.setDate(1 - ((first.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const dateStr = localCalendarDate(date)
      return { dateStr, day: date.getDate(), inMonth: date.getMonth() === miniMonth.getMonth(), count: sessions.filter(s => sessionDate(s) === dateStr).length }
    })
  }, [miniMonth, sessions])

  const filteredSessions = useMemo(() => sessions.filter(session => {
    if (scheduleFilter === 'PENDING') return session.status === 'SCHEDULED' || session.status === 'ACTIVE' || session.status === 'PAUSED'
    if (scheduleFilter === 'COMPLETED') return session.status === 'COMPLETED'
    return true
  }), [sessions, scheduleFilter])
  const weekSessions = filteredSessions.filter(session => weekDays.some(day => sessionDate(session) === day.dateStr))
  const flexibleSessions = weekSessions.filter(session => !session.scheduledAt && !session.startedAt)
  const timedSessions = weekSessions.filter(session => session.scheduledAt || session.startedAt)
  const hours = Array.from({ length: 16 }, (_, index) => index + 6)
  const weekLabel = `${weekDays[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const monthLabel = miniMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const renderActions = (session: FocusSession) => (
    <div className="schedule-session-actions">
      {session.status === 'SCHEDULED' && <>
        <button type="button" className="schedule-btn-engage" onClick={() => handleStartFromSchedule(session.id)}><Icon name="play" size={12} /><span>Start</span></button>
        {handleEditSession && <button type="button" className="schedule-btn-edit" title="Edit Session" onClick={() => handleEditSession(session)}><Icon name="edit" size={12} /></button>}
        <button type="button" className="schedule-btn-cancel" onClick={() => handleCancelFromSchedule(session.id)}>Cancel</button>
      </>}
      {(session.status === 'ACTIVE' || session.status === 'PAUSED') && <button type="button" className="schedule-btn-engage" onClick={() => setActiveTab('Focus Engine')}>Open Focus</button>}
      <button type="button" className="btn-icon-delete" title="Delete Session" onClick={() => handleDeleteSession(session.id)}><Icon name="trash" size={13} /></button>
    </div>
  )

  const renderSession = (session: FocusSession, compact = false) => {
    const instant = session.scheduledAt || session.startedAt
    const date = instant ? new Date(instant) : null
    const time = date ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Flexible time'
    return <article key={session.id} className={`schedule-session-item status-${session.status}${compact ? ' is-compact' : ''}`}>
      <div className="schedule-session-info">
        <div className="schedule-session-title-row"><span className="schedule-session-title">{session.name}</span><span className={`schedule-status-pill ${session.status}`}>{session.status.toLowerCase()}</span></div>
        <div className="schedule-session-meta"><span><Icon name="clock" size={11} />{time} · {session.durationMinutes} min</span>{session.intention && <span>{session.intention}</span>}</div>
        {session.result?.accomplishment && <p className="schedule-session-outcome">{session.result.accomplishment}</p>}
      </div>
      {renderActions(session)}
    </article>
  }

  return <section className="schedule-container schedule-calendar-layout">
    <aside className="schedule-sidebar">
      <div className="schedule-mini-calendar">
        <div className="schedule-mini-heading">
          <div><span className="schedule-sidebar-eyebrow">YOUR CALENDAR</span><h2>{monthLabel}</h2></div>
          <div className="schedule-mini-nav">
            <button type="button" aria-label="Previous month" onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() - 1, 1))}><Icon name="chevron-left" size={15} /></button>
            <button type="button" aria-label="Next month" onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() + 1, 1))}><Icon name="chevron-right" size={15} /></button>
          </div>
        </div>
        <div className="schedule-month-grid schedule-month-weekdays">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <span key={`${day}${i}`}>{day}</span>)}</div>
        <div className="schedule-month-grid">
          {monthCells.map(cell => <button type="button" key={cell.dateStr} aria-label={`${cell.dateStr}${cell.count ? `, ${cell.count} sessions` : ''}`} className={`schedule-month-day${cell.inMonth ? '' : ' outside'}${cell.dateStr === selectedScheduleDate ? ' selected' : ''}${cell.dateStr === localCalendarDate() ? ' today' : ''}`} onClick={() => { setSelectedScheduleDate(cell.dateStr); if (!cell.inMonth) setMiniMonth(new Date(`${cell.dateStr}T00:00:00`)) }}>
            {cell.day}{cell.count > 0 && <i />}
          </button>)}
        </div>
        <button type="button" className="schedule-today-button" onClick={() => { const today = localCalendarDate(); setSelectedScheduleDate(today); setMiniMonth(new Date(`${today}T00:00:00`)) }}>Jump to today</button>
      </div>

      <div className="schedule-sidebar-section">
        <div className="schedule-sidebar-section-title"><span>MY SCHEDULE</span><span>{weekSessions.length}</span></div>
        {(['ALL', 'PENDING', 'COMPLETED'] as const).map(filter => <button type="button" key={filter} className={`schedule-sidebar-filter${scheduleFilter === filter ? ' active' : ''}`} onClick={() => setScheduleFilter(filter)}>
          <span className={`schedule-filter-dot ${filter.toLowerCase()}`} />{filter === 'ALL' ? 'All sessions' : filter === 'PENDING' ? 'Upcoming & active' : 'Completed'}<span className="schedule-filter-count">{filter === 'ALL' ? weekSessions.length : weekSessions.filter(s => filter === 'PENDING' ? s.status === 'SCHEDULED' || s.status === 'ACTIVE' || s.status === 'PAUSED' : s.status === 'COMPLETED').length}</span>
        </button>)}
      </div>

      <div className="schedule-sidebar-tip"><span className="schedule-sidebar-eyebrow">PLAN WITH INTENTION</span><p>Protect a little time for the work that matters most.</p><button type="button" className="schedule-sidebar-book" onClick={() => handleOpenBookingModal(selectedScheduleDate)}><Icon name="plus" size={14} />Book focus time</button></div>
    </aside>

    <div className="schedule-calendar-main">
      <header className="schedule-calendar-toolbar">
        <div className="schedule-toolbar-title"><span className="schedule-sidebar-eyebrow">WEEKLY VIEW</span><h1>{weekLabel}</h1><p>{weekSessions.length} session{weekSessions.length === 1 ? '' : 's'} scheduled this week</p></div>
        <div className="schedule-toolbar-actions"><div className="schedule-week-navigation">
          <button type="button" aria-label="Previous week" onClick={() => setSelectedScheduleDate(changeDate(selectedScheduleDate, -7))}><Icon name="chevron-left" size={16} /></button>
          <button type="button" onClick={() => { const today = localCalendarDate(); setSelectedScheduleDate(today); setMiniMonth(new Date(`${today}T00:00:00`)) }}>Today</button>
          <button type="button" aria-label="Next week" onClick={() => setSelectedScheduleDate(changeDate(selectedScheduleDate, 7))}><Icon name="chevron-right" size={16} /></button>
        </div><button type="button" className="schedule-btn-book" onClick={() => handleOpenBookingModal(selectedScheduleDate)} data-tutorial="schedule-book-btn"><Icon name="plus" size={14} /><span>Book session</span></button></div>
      </header>

      {flexibleSessions.length > 0 && <div className="schedule-flexible-row"><span>FLEXIBLE</span><div>{flexibleSessions.map(session => renderSession(session, true))}</div></div>}

      <div className="schedule-calendar-scroll">
        <div className="schedule-week-grid" style={{ '--schedule-hours': hours.length } as React.CSSProperties}>
          <div className="schedule-grid-corner">LOCAL TIME</div>
          {weekDays.map(day => <button type="button" key={day.dateStr} className={`schedule-grid-day-heading${day.dateStr === selectedScheduleDate ? ' selected' : ''}${day.isToday ? ' today' : ''}`} onClick={() => setSelectedScheduleDate(day.dateStr)}>
            <span>{day.dayName}</span><strong>{day.dayNum}</strong><small>{day.date.toLocaleDateString('en-US', { month: 'short' })}</small>
          </button>)}
          <div className="schedule-time-axis">{hours.map(hour => <div className="schedule-time-label" key={hour}>{new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' })}</div>)}</div>
          {weekDays.map(day => {
            const daySessions = timedSessions.filter(session => sessionDate(session) === day.dateStr)
            return <div className={`schedule-day-column${day.isToday ? ' today' : ''}`} key={day.dateStr}>
              {hours.map(hour => <div className="schedule-hour-cell" key={hour} />)}
              {daySessions.map(session => {
                const instant = session.scheduledAt || session.startedAt
                const date = new Date(instant!)
                const startMinutes = (date.getHours() - hours[0]) * 60 + date.getMinutes()
                const top = Math.max(0, startMinutes / 60 * 62)
                const height = Math.max(50, session.durationMinutes / 60 * 62)
                return <div key={session.id} className="schedule-grid-event" style={{ top, height: Math.min(height, hours.length * 62 - top) }}>
                  <div className="schedule-grid-event-accent" />{renderSession(session, true)}
                </div>
              })}
            </div>
          })}
        </div>
      </div>
      {weekSessions.length === 0 && <div className="schedule-week-empty"><span className="schedule-empty-icon"><Icon name="schedule" size={22} /></span><div><strong>Your week is open</strong><p>Book a focus block to make room for meaningful progress.</p></div><button type="button" className="schedule-btn-book" onClick={() => handleOpenBookingModal(selectedScheduleDate)}><Icon name="plus" size={13} />Plan a session</button></div>}
      <footer className="schedule-calendar-footer"><span>Showing {weekLabel}</span><span>Times shown in your local timezone</span></footer>
    </div>
  </section>
}
