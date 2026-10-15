import React, { useState, useMemo } from 'react'
import type { FocusSession } from '../api/focusSessions'
import type { AppView } from '../types/navigation'
import { Icon } from '../components/common/Icon'

const formatLocalCalendarDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const localCalendarDate = (date = new Date()): string => formatLocalCalendarDate(date)

const localCalendarDateFromInstant = (instant: string | null | undefined): string | null => {
  return instant ? localCalendarDate(new Date(instant)) : null
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
  sessions,
  selectedScheduleDate,
  setSelectedScheduleDate,
  setActiveTab,
  handleOpenBookingModal,
  handleStartFromSchedule,
  handleCancelFromSchedule,
  handleDeleteSession,
  handleEditSession,
}) => {
  trackRender('ScheduleView')
  const [scheduleWeekOffset, setScheduleWeekOffset] = useState<number>(0)
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL')

  const scheduleWeekDays = useMemo(() => {
    const base = new Date()
    base.setDate(base.getDate() + scheduleWeekOffset * 7)
    const currentDay = base.getDay()
    const distanceToMonday = (currentDay + 6) % 7
    const monday = new Date(base)
    monday.setDate(base.getDate() - distanceToMonday)
    monday.setHours(0, 0, 0, 0)

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const todayStr = localCalendarDate()

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = localCalendarDate(d)
      const count = sessions.filter((s) => {
        const sDate =
          localCalendarDateFromInstant(s.scheduledAt) ||
          localCalendarDateFromInstant(s.startedAt) ||
          localCalendarDateFromInstant(s.createdAt)
        return sDate === dateStr
      }).length

      return {
        date: d,
        dateStr,
        dayName: dayNames[i],
        dayNum: d.getDate(),
        monthName: monthNames[d.getMonth()],
        isToday: dateStr === todayStr,
        sessionCount: count,
      }
    })
  }, [scheduleWeekOffset, sessions])

  const selectedDaySessions = useMemo(() => {
    return sessions.filter((s) => {
      const sDate =
        localCalendarDateFromInstant(s.scheduledAt) ||
        localCalendarDateFromInstant(s.startedAt) ||
        localCalendarDateFromInstant(s.createdAt)
      if (sDate !== selectedScheduleDate) return false

      if (scheduleFilter === 'PENDING') {
        return s.status === 'SCHEDULED' || s.status === 'ACTIVE' || s.status === 'PAUSED'
      }
      if (scheduleFilter === 'COMPLETED') {
        return s.status === 'COMPLETED'
      }
      return true
    })
  }, [sessions, selectedScheduleDate, scheduleFilter])

  return (
    <div className="schedule-container">
      {/* Top Toolbar */}
      <div className="schedule-top-toolbar">
        <div className="schedule-nav-group">
          <button
            type="button"
            className="schedule-nav-btn"
            onClick={() => {
              setScheduleWeekOffset((prev) => prev - 1)
              const cur = new Date(`${selectedScheduleDate}T00:00:00`)
              cur.setDate(cur.getDate() - 7)
              setSelectedScheduleDate(formatLocalCalendarDate(cur))
            }}
            title="Previous Week"
          >
            <Icon name="chevron-left" size={14} />
            <span>Prev Week</span>
          </button>
          <button
            type="button"
            className="schedule-nav-btn"
            onClick={() => {
              setScheduleWeekOffset(0)
              setSelectedScheduleDate(localCalendarDate())
            }}
            title="Return to Current Day"
          >
            <span>Current Day</span>
          </button>
          <button
            type="button"
            className="schedule-nav-btn"
            onClick={() => {
              setScheduleWeekOffset((prev) => prev + 1)
              const cur = new Date(`${selectedScheduleDate}T00:00:00`)
              cur.setDate(cur.getDate() + 7)
              setSelectedScheduleDate(formatLocalCalendarDate(cur))
            }}
            title="Next Week"
          >
            <span>Next Week</span>
            <Icon name="chevron-right" size={14} />
          </button>
          <span className="schedule-week-range-label">
            {scheduleWeekDays[0].monthName} {scheduleWeekDays[0].dayNum} — {scheduleWeekDays[6].monthName} {scheduleWeekDays[6].dayNum}
          </span>
        </div>

        <button
          type="button"
          className="schedule-btn-book"
          onClick={() => handleOpenBookingModal()}
          data-tutorial="schedule-book-btn"
        >
          <Icon name="plus" size={14} />
          <span>Book Focus Session</span>
        </button>
      </div>

      {/* 7-Day Horizontal Strip */}
      <div className="schedule-week-strip">
        {scheduleWeekDays.map((d) => {
          const isSelected = d.dateStr === selectedScheduleDate
          return (
            <div
              key={d.dateStr}
              className={`schedule-day-tile ${isSelected ? 'selected' : ''} ${d.isToday ? 'is-today' : ''}`}
              onClick={() => setSelectedScheduleDate(d.dateStr)}
            >
              {d.isToday && <div className="schedule-today-pill" title="Today" />}
              <span className="schedule-day-name">{d.dayName}</span>
              <span className="schedule-day-number">{d.dayNum}</span>
              <span className="schedule-day-badge">
                {d.sessionCount === 1 ? '1 Session' : `${d.sessionCount} Sessions`}
              </span>
            </div>
          )
        })}
      </div>

      {/* Day Agenda Board */}
      <div className="schedule-agenda-board">
        <div className="schedule-agenda-header">
          <div className="schedule-agenda-title-group">
            <h2>
              {new Date(`${selectedScheduleDate}T00:00:00`).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h2>
            <p>
              {selectedDaySessions.length} session{selectedDaySessions.length === 1 ? '' : 's'} recorded for this date
            </p>
          </div>

          <div className="schedule-filter-tabs">
            {(['ALL', 'PENDING', 'COMPLETED'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                className={`schedule-filter-btn ${scheduleFilter === filter ? 'active' : ''}`}
                onClick={() => setScheduleFilter(filter)}
              >
                {filter === 'ALL' ? 'All' : filter === 'PENDING' ? 'Pending' : 'Completed'}
              </button>
            ))}
          </div>
        </div>

        {selectedDaySessions.length > 0 ? (
          <div className="schedule-session-list">
            {selectedDaySessions.map((session) => {
              const scheduledTime = session.scheduledAt
                ? new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : session.startedAt
                ? new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Flexible Slot'

              return (
                <div
                  key={session.id}
                  className={`schedule-session-item status-${session.status}`}
                >
                  <div className="schedule-session-left">
                    <div className="schedule-time-badge">
                      <span>{scheduledTime}</span>
                    </div>

                    <div className="schedule-session-info">
                      <div className="schedule-session-title-row">
                        <span className="schedule-session-title">{session.name}</span>
                        <span className={`schedule-status-pill ${session.status}`}>
                          {session.status}
                        </span>
                      </div>

                      <div className="schedule-session-meta">
                        <div className="schedule-session-meta-item">
                          <Icon name="clock" size={12} />
                          <span>{session.durationMinutes}m Duration</span>
                        </div>
                        {session.intention && (
                          <div className="schedule-session-meta-item">
                            <span>• Intention: {session.intention}</span>
                          </div>
                        )}
                        {session.result?.accomplishment && (
                          <div className="schedule-session-meta-item" style={{ color: '#34C759' }}>
                            <span>• Accomplished: {session.result.accomplishment}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="schedule-session-actions">
                    {session.status === 'SCHEDULED' && (
                      <>
                        <button
                          type="button"
                          className="schedule-btn-engage"
                          onClick={() => handleStartFromSchedule(session.id)}
                        >
                          <Icon name="play" size={13} />
                          <span>Start Now</span>
                        </button>
                        {handleEditSession && (
                          <button
                            type="button"
                            className="schedule-btn-edit"
                            title="Edit Session"
                            onClick={() => handleEditSession(session)}
                          >
                            <Icon name="edit" size={13} />
                            <span>Edit</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="schedule-btn-cancel"
                          onClick={() => handleCancelFromSchedule(session.id)}
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {(session.status === 'ACTIVE' || session.status === 'PAUSED') && (
                      <button
                        type="button"
                        className="schedule-btn-engage"
                        onClick={() => setActiveTab('Focus Engine')}
                      >
                        <span>Open Focus</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-icon-delete"
                      title="Delete Session"
                      onClick={() => handleDeleteSession(session.id)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="schedule-empty-box">
            <div className="schedule-empty-icon"><Icon name="schedule" size={36} /></div>
            <h3 className="schedule-empty-title">No Sessions Scheduled</h3>
            <p className="schedule-empty-desc">
              No focus sessions scheduled for this date. Book a session to plan your focus time.
            </p>
            <div className="schedule-empty-actions">
              <button
                type="button"
                className="schedule-btn-book"
                onClick={() => handleOpenBookingModal(selectedScheduleDate, 25, 'Classic Pomodoro')}
              >
                <Icon name="plus" size={14} />
                <span>Book Session for {selectedScheduleDate}</span>
              </button>
              <button
                type="button"
                className="schedule-quick-btn"
                onClick={() => handleOpenBookingModal(selectedScheduleDate, 50, 'Deep Work Sprint')}
              >
                50m Focus Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
