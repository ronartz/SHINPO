export type ScheduleLayoutInput = {
  id: number
  startMinute: number
  durationMinutes: number
}

export type ScheduleLayoutPosition = {
  lane: number
  laneCount: number
}

export function layoutOverlappingSessions(
  sessions: ScheduleLayoutInput[],
): Map<number, ScheduleLayoutPosition> {
  const sorted = [...sessions].sort((a, b) => a.startMinute - b.startMinute || a.id - b.id)
  const positions = new Map<number, ScheduleLayoutPosition>()
  let cluster: ScheduleLayoutInput[] = []
  let clusterEnd = Number.NEGATIVE_INFINITY

  const placeCluster = () => {
    const laneEnds: number[] = []
    const placed: Array<{ id: number; lane: number }> = []
    for (const session of cluster) {
      const start = session.startMinute
      const end = start + Math.max(1, session.durationMinutes)
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
      if (lane < 0) lane = laneEnds.length
      laneEnds[lane] = end
      placed.push({ id: session.id, lane })
    }
    for (const position of placed) {
      positions.set(position.id, { lane: position.lane, laneCount: laneEnds.length })
    }
    cluster = []
    clusterEnd = Number.NEGATIVE_INFINITY
  }

  for (const session of sorted) {
    if (cluster.length && session.startMinute >= clusterEnd) placeCluster()
    cluster.push(session)
    clusterEnd = Math.max(clusterEnd, session.startMinute + Math.max(1, session.durationMinutes))
  }
  if (cluster.length) placeCluster()
  return positions
}
