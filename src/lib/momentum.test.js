import { describe, it, expect } from 'vitest'
import { projectDistance, projectPoint, releaseHitsRect } from './momentum.js'

// A wide, thin target along the bottom, like the revival zone
const zone = { left: 200, right: 1100, top: 800, bottom: 860 }

describe('projectDistance', () => {
  it('is proportional to velocity and keeps its direction', () => {
    expect(projectDistance(1000)).toBeCloseTo(99)
    expect(projectDistance(-1000)).toBeCloseTo(-99)
    expect(projectDistance(0)).toBe(0)
  })
})

describe('projectPoint', () => {
  it('projects each axis independently', () => {
    const p = projectPoint({ x: 100, y: 100 }, { x: 0, y: 1000 })
    expect(p.x).toBe(100)
    expect(p.y).toBeCloseTo(199)
  })
})

describe('releaseHitsRect', () => {
  const still = { x: 0, y: 0 }

  it('hits when released inside, even with no velocity', () => {
    expect(releaseHitsRect({ x: 500, y: 830 }, still, zone)).toBe(true)
  })

  it('misses when released still, just short of the target', () => {
    expect(releaseHitsRect({ x: 500, y: 780 }, still, zone)).toBe(false)
  })

  it('hits on a flick that ends inside', () => {
    expect(releaseHitsRect({ x: 500, y: 700 }, { x: 0, y: 1500 }, zone)).toBe(true)
  })

  it('hits on a flick hard enough to coast past a thin target', () => {
    expect(releaseHitsRect({ x: 500, y: 700 }, { x: 0, y: 6000 }, zone)).toBe(true)
  })

  it('misses a flick that is too weak to get there', () => {
    expect(releaseHitsRect({ x: 500, y: 400 }, { x: 0, y: 500 }, zone)).toBe(false)
  })

  it('misses a flick in the wrong direction', () => {
    expect(releaseHitsRect({ x: 500, y: 780 }, { x: 0, y: -2000 }, zone)).toBe(false)
  })

  it('misses a flick that travels beside the target', () => {
    expect(releaseHitsRect({ x: 100, y: 700 }, { x: 0, y: 2000 }, zone)).toBe(false)
  })
})
