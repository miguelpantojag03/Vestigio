// ─── momentum ─────────────────────────────────────────────────────
// Where a released drag is heading, not just where it let go: a flick
// toward a target should count as reaching it. Exponential decay, the same
// form as scroll deceleration; 0.99 is the snappier of the usual rates, so
// only a real throw travels far.

const DECELERATION_RATE = 0.99
const PATH_SAMPLES = 16

/** Distance (px) something moving at `velocity` (px/s) coasts before stopping. */
export function projectDistance(velocity, rate = DECELERATION_RATE) {
  return (velocity / 1000) * rate / (1 - rate)
}

/** Where a drag released at `point` with `velocity` (both {x, y}) comes to rest. */
export function projectPoint(point, velocity) {
  return {
    x: point.x + projectDistance(velocity.x),
    y: point.y + projectDistance(velocity.y),
  }
}

export function isInsideRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}

/**
 * Whether a release lands in `rect`, or would pass through it on its way.
 * The whole path counts, so a hard flick that would coast beyond a thin
 * target still hits it.
 */
export function releaseHitsRect(point, velocity, rect) {
  const end = projectPoint(point, velocity)
  for (let i = 0; i <= PATH_SAMPLES; i++) {
    const t = i / PATH_SAMPLES
    if (isInsideRect({ x: point.x + (end.x - point.x) * t, y: point.y + (end.y - point.y) * t }, rect)) return true
  }
  return false
}
