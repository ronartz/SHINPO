import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { FocusContributionDay } from '../../utils/focusContributionData.ts'

type Cell = FocusContributionDay & { week: number; weekday: number; level: number }
type Point = { x: number; y: number }

const DAY = 86_400_000
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const ease = (value: number) => value < 0.5 ? 4 * value ** 3 : 1 - Math.pow(-2 * value + 2, 3) / 2
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function colorValue(value: string): [number, number, number] {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return [90, 120, 180]
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
  return [red, green, blue]
}

function rgb(color: [number, number, number], alpha = 1) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`
}

function sceneStats(cells: Cell[]) {
  const active = cells.filter((cell) => cell.count > 0)
  let longest = 0
  let current = 0
  for (const cell of cells) {
    current = cell.count > 0 ? current + 1 : 0
    longest = Math.max(longest, current)
  }
  const busiest = active.reduce<Cell | null>((best, cell) => !best || cell.count > best.count ? cell : best, null)
  return { total: active.reduce((sum, cell) => sum + cell.count, 0), longest, current, busiest }
}

export function FocusContributionSkyline({ data }: { data: FocusContributionDay[] }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const morphRef = useRef(0)
  const viewRef = useRef<'2d' | '3d'>('3d')
  const yawRef = useRef(0)
  const [view, setView] = useState<'2d' | '3d'>('3d')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [legendLevel, setLegendLevel] = useState(-1)
  const [announcement, setAnnouncement] = useState('')
  const [size, setSize] = useState({ width: 0, height: 276 })

  const cells = useMemo(() => {
    const today = new Date()
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const start = new Date(end)
    start.setDate(start.getDate() - 364)
    start.setDate(start.getDate() - start.getDay())
    const byDate = new Map(data.map((entry) => [entry.date, entry]))
    const result: Cell[] = []
    const maxDays = Math.ceil((end.getTime() - start.getTime()) / DAY) + 1
    for (let offset = 0; offset < maxDays; offset++) {
      const date = new Date(start)
      date.setDate(start.getDate() + offset)
      const key = dateKey(date)
      const entry = byDate.get(key)
      result.push({ date: key, count: entry?.count ?? 0, durationSeconds: entry?.durationSeconds ?? 0, week: Math.floor(offset / 7), weekday: offset % 7, level: 0 })
    }
    const sorted = result.map((cell) => cell.count).filter((count) => count > 0).sort((a, b) => a - b)
    const busy = sorted.length ? sorted[Math.floor((sorted.length - 1) * 0.95)] : 0
    for (const cell of result) cell.level = cell.count === 0 ? 0 : 1 + Math.min(3, Math.floor((cell.count / Math.max(1, busy)) * 4))
    return result
  }, [data])

  const stats = useMemo(() => sceneStats(cells), [cells])
  const weeks = Math.ceil(cells.length / 7)
  const levelColors = useRef<[number, number, number][]>([])

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !stage || !context || size.width <= 0) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = reducedMotion.matches
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const width = size.width
    const height = size.height
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const foreground = colorValue(getComputedStyle(stage).getPropertyValue('--text-1').trim() || '#334155')
    const updatePalette = () => {
      const styles = getComputedStyle(stage)
      const accent = colorValue(styles.getPropertyValue('--analytics-chart-bar').trim() || '#4D7C0F')
      const empty = colorValue(styles.getPropertyValue('--surface-hover').trim() || '#e5e7eb')
      levelColors.current = [empty, ...[0.24, 0.43, 0.68, 1].map((factor) => [
        Math.round(empty[0] + (accent[0] - empty[0]) * factor),
        Math.round(empty[1] + (accent[1] - empty[1]) * factor),
        Math.round(empty[2] + (accent[2] - empty[2]) * factor),
      ] as [number, number, number])]
    }
    updatePalette()

    const dpr = ratio
    const maxCount = Math.max(1, ...cells.map((cell) => cell.count))
    const widthForGrid = Math.max(0, width - 54)
    const widthLimitedCell = (widthForGrid - (weeks - 1) * 2) / Math.max(1, weeks)
    const cellSize = Math.max(1, Math.min(
      18,
      widthLimitedCell < 2 / 0.18
        ? widthLimitedCell
        : widthForGrid / Math.max(1, weeks + (weeks - 1) * 0.18),
      (height - 48) / 8,
    ))
    const gap = Math.max(2, cellSize * 0.18)
    const gridWidth = weeks * (cellSize + gap) - gap
    const gridHeight = 7 * (cellSize + gap) - gap
    const gridLeft = (width - gridWidth) / 2
    const gridTop = (height - gridHeight) / 2
    let yaw = Math.PI / 4 + yawRef.current
    const elevation = Math.PI / 5
    const worldCell = Math.min(12, cellSize * 0.76)
    const project3d = (week: number, day: number, z: number): Point => ({
      x: (week * worldCell * Math.cos(yaw) - day * worldCell * Math.sin(yaw)),
      y: (week * worldCell * Math.sin(yaw) + day * worldCell * Math.cos(yaw)) * Math.sin(elevation) - z * Math.cos(elevation),
    })
    const extentPoints = [project3d(0, 0, 0), project3d(weeks, 0, 0), project3d(0, 7, 0), project3d(weeks, 7, 0), project3d(weeks, 0, 48)]
    const minX = Math.min(...extentPoints.map((point) => point.x))
    const maxX = Math.max(...extentPoints.map((point) => point.x))
    const minY = Math.min(...extentPoints.map((point) => point.y))
    const maxY = Math.max(...extentPoints.map((point) => point.y))
    const isoScale = Math.min((width - 100) / Math.max(1, maxX - minX), (height - 56) / Math.max(1, maxY - minY))
    const isoOffsetX = (width - (maxX - minX) * isoScale) / 2 - minX * isoScale
    const isoOffsetY = (height - (maxY - minY) * isoScale) / 2 - minY * isoScale
    const iso = (week: number, day: number, z: number): Point => {
      const projected = project3d(week, day, z)
      return { x: isoOffsetX + projected.x * isoScale, y: isoOffsetY + projected.y * isoScale }
    }
    const hits: { index: number; x: number; y: number; radius: number }[] = []
    const started = performance.now()
    const from = morphRef.current
    const target = view === '3d' ? 1 : 0
    let frame = 0
    let disposed = false

    const draw = (progress: number) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      hits.length = 0
      const morph = reduced ? target : progress
      const palette = levelColors.current
      for (const cell of cells) {
        const x = gridLeft + cell.week * (cellSize + gap)
        const y = gridTop + cell.weekday * (cellSize + gap)
        const delay = cell.week / Math.max(1, weeks - 1) * 0.34
        const rise = target === 1 ? clamp((morph - delay) / 0.58, 0, 1) : clamp(1 - (1 - morph - delay) / 0.58, 0, 1)
        const barHeight = cell.count > 0 ? 5 + Math.sqrt(cell.count / maxCount) * 42 * (target === 1 ? ease(rise) : rise) : 1
        const flat = [
          { x, y }, { x: x + cellSize, y }, { x: x + cellSize, y: y + cellSize }, { x, y: y + cellSize },
        ]
        const top3 = [iso(cell.week, cell.weekday, barHeight), iso(cell.week + 0.88, cell.weekday, barHeight), iso(cell.week + 0.88, cell.weekday + 0.88, barHeight), iso(cell.week, cell.weekday + 0.88, barHeight)]
        const base3 = [iso(cell.week, cell.weekday, 0), iso(cell.week + 0.88, cell.weekday, 0), iso(cell.week + 0.88, cell.weekday + 0.88, 0), iso(cell.week, cell.weekday + 0.88, 0)]
        const blend = (a: Point, b: Point): Point => ({ x: a.x + (b.x - a.x) * morph, y: a.y + (b.y - a.y) * morph })
        const top = flat.map((point, index) => blend(point, top3[index]))
        const base = flat.map((point, index) => blend(point, base3[index]))
        const color = palette[cell.level] ?? palette[0]
        const isDimmed = legendLevel >= 0 && cell.level !== legendLevel
        context.globalAlpha = isDimmed ? 0.2 : 1
        if (morph > 0.04 && cell.count > 0) {
          context.beginPath()
          context.moveTo(base[2].x, base[2].y); context.lineTo(base[3].x, base[3].y); context.lineTo(top[3].x, top[3].y); context.lineTo(top[2].x, top[2].y)
          context.closePath(); context.fillStyle = rgb(color.map((value) => Math.round(value * 0.72)) as [number, number, number]); context.fill()
          context.beginPath()
          context.moveTo(base[1].x, base[1].y); context.lineTo(base[2].x, base[2].y); context.lineTo(top[2].x, top[2].y); context.lineTo(top[1].x, top[1].y)
          context.closePath(); context.fillStyle = rgb(color.map((value) => Math.round(value * 0.84)) as [number, number, number]); context.fill()
        }
        context.beginPath()
        context.moveTo(top[0].x, top[0].y)
        for (let index = 1; index < top.length; index++) context.lineTo(top[index].x, top[index].y)
        context.closePath()
        context.fillStyle = rgb(color)
        context.fill()
        context.strokeStyle = rgb(foreground, cell.count ? 0.14 : 0.06)
        context.lineWidth = 0.7
        context.stroke()
        const center = top.reduce((sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }), { x: 0, y: 0 })
        hits.push({ index: cells.indexOf(cell), x: center.x, y: center.y, radius: Math.max(cellSize, 10) })
      }
      context.globalAlpha = 1
      context.fillStyle = rgb(foreground, 0.75)
      context.font = '12px var(--font-family, sans-serif)'
      context.textBaseline = 'top'
      for (const cell of cells) {
        const date = new Date(`${cell.date}T12:00:00`)
        if (date.getDate() === 1) {
          context.fillText(date.toLocaleDateString(undefined, { month: 'short' }), gridLeft + cell.week * (cellSize + gap), 8)
        }
      }
      if (reduced || Math.abs(target - progress) <= 0.001) morphRef.current = target
    }
    const tick = (now: number) => {
      const amount = clamp((now - started) / 1250, 0, 1)
      const progress = from + (target - from) * ease(amount)
      morphRef.current = progress
      draw(progress)
      frame = amount < 1 && !reduced ? requestAnimationFrame(tick) : 0
    }
    const scheduleDraw = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(() => {
        frame = 0
        draw(morphRef.current)
      })
    }
    const onPointerMove = (event: PointerEvent) => {
      if (viewRef.current === '3d' && event.buttons === 1) {
        yawRef.current = clamp(yawRef.current + event.movementX * 0.003, -0.55, 0.55)
        yaw = Math.PI / 4 + yawRef.current
        scheduleDraw()
        return
      }
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const hit = hits.reduce<typeof hits[number] | null>((nearest, item) => {
        const distance = Math.hypot(item.x - x, item.y - y)
        if (distance > item.radius) return nearest
        return !nearest || distance < Math.hypot(nearest.x - x, nearest.y - y) ? item : nearest
      }, null)
      setActiveIndex(hit?.index ?? -1)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' '].includes(event.key)) return
      event.preventDefault()
      setActiveIndex((current) => {
        let next = current < 0 ? cells.length - 1 : current
        if (event.key === 'ArrowLeft') next = Math.max(0, next - 7)
        if (event.key === 'ArrowRight') next = Math.min(cells.length - 1, next + 7)
        if (event.key === 'ArrowUp') next = Math.max(0, next - 1)
        if (event.key === 'ArrowDown') next = Math.min(cells.length - 1, next + 1)
        if (event.key === 'Home') next = 0
        if (event.key === 'End') next = cells.length - 1
        const cell = cells[next]
        setAnnouncement(`${cell.count} completed Focus ${cell.count === 1 ? 'session' : 'sessions'} on ${cell.date}; ${cell.durationSeconds} seconds focused`)
        return next
      })
    }
    const onThemeChange = () => { updatePalette(); scheduleDraw() }
    const onMotionChange = () => { reduced = reducedMotion.matches; scheduleDraw() }
    const observer = new MutationObserver(onThemeChange)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-brand'] })
    const onPointerLeave = () => setActiveIndex(-1)
    const onDoubleClick = () => { yawRef.current = 0; yaw = Math.PI / 4; scheduleDraw() }
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('keydown', onKeyDown)
    canvas.addEventListener('dblclick', onDoubleClick)
    reducedMotion.addEventListener('change', onMotionChange)
    frame = requestAnimationFrame(tick)

    return () => {
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      reducedMotion.removeEventListener('change', onMotionChange)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('dblclick', onDoubleClick)
    }
  }, [cells, legendLevel, size, view])

  const active = activeIndex >= 0 ? cells[activeIndex] : null
  const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const date = (key: string | null) => key ? dateFormat.format(new Date(`${key}T12:00:00`)) : '—'
  let streakCursor = cells.length - 1
  if (streakCursor >= 0 && cells[streakCursor].count === 0) streakCursor--
  const streakEndIndex = streakCursor
  let currentStreak = 0
  while (streakCursor >= 0 && cells[streakCursor].count > 0) {
    currentStreak++
    streakCursor--
  }
  const streakEnd = currentStreak ? cells[streakEndIndex]?.date : null
  const metrics = [
    { label: 'Completed sessions · 12 months', value: String(stats.total), detail: 'verified records' },
    { label: 'Busiest Focus day', value: stats.busiest ? `${stats.busiest.count} ${stats.busiest.count === 1 ? 'session' : 'sessions'}` : '0 sessions', detail: stats.busiest ? date(stats.busiest.date) : 'No sessions yet' },
    { label: 'Longest streak', value: `${stats.longest} ${stats.longest === 1 ? 'day' : 'days'}`, detail: 'consecutive days' },
    { label: 'Current streak', value: `${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}`, detail: currentStreak ? `through ${date(streakEnd ?? null)}` : 'Complete a Focus session to begin' },
  ]

  return (
    <section className="analytics-panel focus-contribution-skyline" aria-labelledby="focus-skyline-title">
      <div className="focus-skyline-heading">
        <div>
          <span className="analytics-eyebrow">Last 12 months</span>
          <h2 id="focus-skyline-title">Focus contribution skyline</h2>
          <p>{stats.total} completed {stats.total === 1 ? 'session' : 'sessions'} · daily totals use your local calendar</p>
        </div>
        <div className="focus-skyline-switch" role="group" aria-label="Contribution chart view">
          <button type="button" aria-label="Flat heat map" aria-pressed={view === '2d'} onClick={() => setView('2d')}>2D</button>
          <button type="button" aria-label="3D skyline" aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D</button>
        </div>
      </div>
      <div ref={stageRef} className="focus-skyline-stage">
        <canvas ref={canvasRef} data-view={view} role="img" tabIndex={0} aria-label="Focus sessions across the last twelve months. Use arrow keys to inspect days." />
        {active && <div className="focus-skyline-tooltip" role="status">
          <strong>{date(active.date)}</strong><span>{active.count} completed {active.count === 1 ? 'session' : 'sessions'}</span><span>{active.durationSeconds}s focused</span>
        </div>}
      </div>
      <div className="focus-skyline-stats">
        {metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>)}
      </div>
      <div className="focus-skyline-footer">
        <span>{stats.total === 0 ? 'No completed Focus sessions in this period yet.' : 'Hover, tap or focus a day to inspect its session count and active duration.'}</span>
        <div className="focus-skyline-legend" aria-label="Activity level legend">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => <button key={level} type="button" aria-label={`Highlight level ${level}`} aria-pressed={legendLevel === level} onMouseEnter={() => setLegendLevel(level)} onMouseLeave={() => setLegendLevel(-1)} onFocus={() => setLegendLevel(level)} onBlur={() => setLegendLevel(-1)} style={{ '--activity-level': level } as CSSProperties} />)}
          <span>More</span>
        </div>
      </div>
      <span className="visually-hidden" aria-live="polite">{announcement}</span>
    </section>
  )
}
