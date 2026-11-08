import React, { useState } from 'react'

interface TaskItem {
  id: string
  title: string
  completed: boolean
  goalTitle: string
}

export const MobileGoalsView: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: '1', title: 'Refactor desktop and mobile presentation boundaries', completed: true, goalTitle: 'Architecture V2' },
    { id: '2', title: 'Verify CSS isolation between desktop and mobile', completed: true, goalTitle: 'Architecture V2' },
    { id: '3', title: 'Implement mobile touch navigation and views', completed: false, goalTitle: 'Architecture V2' },
    { id: '4', title: 'Complete 2 daily focus sessions', completed: false, goalTitle: 'Daily Execution' },
  ])
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    const newTask: TaskItem = {
      id: String(Date.now()),
      title: newTaskTitle.trim(),
      completed: false,
      goalTitle: 'Daily Execution',
    }
    setTasks((prev) => [newTask, ...prev])
    setNewTaskTitle('')
  }

  const completedCount = tasks.filter((t) => t.completed).length
  const progressPercent = Math.round((completedCount / tasks.length) * 100) || 0

  return (
    <div className="shinpo-mobile-goals">
      <h1 className="shinpo-mobile-heading">Goals & Tasks</h1>
      <p className="shinpo-mobile-subtitle">Track your high-impact deliverables.</p>

      {/* Goal Progress Summary Card */}
      <div className="shinpo-mobile-card">
        <div className="shinpo-mobile-card-header">
          <span className="shinpo-mobile-card-title">Overall Completion</span>
          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--brand-primary, #6366f1)' }}>
            {completedCount}/{tasks.length} Done ({progressPercent}%)
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', background: 'var(--surface-secondary, rgba(255,255,255,0.08))', borderRadius: '999px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--brand-primary, #6366f1), #8b5cf6)',
              borderRadius: '999px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Add Task Input */}
      <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          className="shinpo-mobile-input"
          placeholder="Add a new task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          aria-label="New task title"
        />
        <button
          type="submit"
          className="shinpo-mobile-btn shinpo-mobile-btn-primary"
          style={{ width: 'auto', padding: '0 18px', flexShrink: 0 }}
          aria-label="Add task"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </form>

      {/* Tasks List */}
      <div className="shinpo-mobile-card" style={{ padding: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', padding: '0 4px' }}>
          Active Missions
        </div>
        {tasks.map((task) => (
          <div
            key={task.id}
            className="shinpo-mobile-task-item"
            onClick={() => handleToggleTask(task.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') handleToggleTask(task.id)
            }}
            aria-label={`${task.completed ? 'Mark incomplete' : 'Mark complete'}: ${task.title}`}
          >
            <div className="shinpo-mobile-checkbox">
              <div className={`shinpo-mobile-checkbox-box ${task.completed ? 'checked' : ''}`}>
                {task.completed && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div className={`shinpo-mobile-task-text ${task.completed ? 'completed' : ''}`}>
                {task.title}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {task.goalTitle}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
