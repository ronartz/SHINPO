export type ScheduleLayoutInput = {
  id: number
  startMinute: number
  durationMinutes: number
}

export type ScheduleLayoutPosition = {
  lane: number
  laneCount: number
  laneSpan: number
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
    const placed: Array<{ session: ScheduleLayoutInput; lane: number; end: number }> = []
    for (const session of cluster) {
      const start = session.startMinute
      const end = start + Math.max(1, session.durationMinutes)
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
      if (lane < 0) lane = laneEnds.length
      laneEnds[lane] = end
      placed.push({ session, lane, end })
    }
    for (const position of placed) {
      let laneSpan = 1
      for (let lane = position.lane + 1; lane < laneEnds.length; lane += 1) {
        const laneIsFree = placed
          .filter((candidate) => candidate.lane === lane)
          .every((candidate) => {
            const candidateStart = candidate.session.startMinute
            return position.session.startMinute >= candidate.end || candidateStart >= position.end
          })
        if (!laneIsFree) break
        laneSpan += 1
      }
      positions.set(position.session.id, { lane: position.lane, laneCount: laneEnds.length, laneSpan })
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
