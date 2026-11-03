type Rect = { top: number; left: number; right: number; bottom: number; width: number; height: number }
type Size = { width: number; height: number }
type Placement = 'top' | 'bottom' | 'left' | 'right'

export function getCoachmarkPosition(target: Rect, panel: Size, viewport: Size, preferred: Placement, margin = 16, gap = 16) {
  const candidates: Record<Placement, { top: number; left: number }> = {
    top: { top: target.top - panel.height - gap, left: target.left + (target.width - panel.width) / 2 },
    bottom: { top: target.bottom + gap, left: target.left + (target.width - panel.width) / 2 },
    left: { top: target.top + (target.height - panel.height) / 2, left: target.left - panel.width - gap },
    right: { top: target.top + (target.height - panel.height) / 2, left: target.right + gap },
  }
  const placements = [...new Set<Placement>([preferred, 'top', 'bottom', 'left', 'right'])]
  const maxLeft = Math.max(margin, viewport.width - panel.width - margin)
  const maxTop = Math.max(margin, viewport.height - panel.height - margin)

  return placements.map((placement, order) => {
    const raw = candidates[placement]
    const left = Math.max(margin, Math.min(maxLeft, raw.left))
    const top = Math.max(margin, Math.min(maxTop, raw.top))
    const overlapWidth = Math.max(0, Math.min(left + panel.width, target.right) - Math.max(left, target.left))
    const overlapHeight = Math.max(0, Math.min(top + panel.height, target.bottom) - Math.max(top, target.top))
    const overlapArea = overlapWidth * overlapHeight
    const clampDistance = Math.abs(raw.left - left) + Math.abs(raw.top - top)
    return { position: { top, left }, score: overlapArea * 1_000_000 + clampDistance * 10 + order }
  }).sort((a, b) => a.score - b.score)[0].position
}
