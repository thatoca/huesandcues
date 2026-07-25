import type { Cell, Guess, Player, PlayerRoundResult } from "./types"

// Board dimensions modeled after the physical Hues and Cues board.
export const BOARD_COLS = 30
export const BOARD_ROWS = 16

// Generate an HSL color for a given board cell.
// Horizontal axis = hue, vertical axis = light (top) to dark (bottom).
export function cellHsl(row: number, col: number): { h: number; s: number; l: number } {
  const h = Math.round((col / BOARD_COLS) * 360)
  const s = 82
  // Lightness ramps from ~88% (top) down to ~18% (bottom).
  const l = Math.round(88 - (row / (BOARD_ROWS - 1)) * 70)
  return { h, s, l }
}

export function cellColor(row: number, col: number): string {
  const { h, s, l } = cellHsl(row, col)
  return `hsl(${h} ${s}% ${l}%)`
}

// Convert a cell's HSL color to a HEX string (for the color card display).
export function cellHex(row: number, col: number): string {
  const { h, s, l } = cellHsl(row, col)
  return hslToHex(h, s, l)
}

export function cellRgb(row: number, col: number): { r: number; g: number; b: number } {
  const { h, s, l } = cellHsl(row, col)
  return hslToRgb(h, s, l)
}

function hslToRgb(h: number, s: number, l: number) {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4)),
  }
}

function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l)
  const toHex = (v: number) => v.toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

// Chebyshev distance: number of squares away in any direction (incl. diagonals).
export function chebyshevDistance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col))
}

// A cell is inside the 5x5 scoring frame when it is within 2 squares of the target.
export function isInsideFrame(cell: Cell, target: Cell): boolean {
  return chebyshevDistance(cell, target) <= 2
}

// Points awarded to a guessing player based on Chebyshev distance to the target.
// center (0) = 3, first ring (1) = 2, second ring (2) = 1, outside = 0.
export function pointsForDistance(distance: number): number {
  if (distance === 0) return 3
  if (distance === 1) return 2
  if (distance === 2) return 1
  return 0
}

/**
 * Compute the exact Hues and Cues round scoring.
 *
 * - Each guessing (non clue-giver) player scores by proximity to the target.
 * - The clue giver scores 1 point per other player's pawn inside the 5x5 frame,
 *   or 2 points per pawn inside the frame when there are exactly 3 players.
 */
export function scoreRound({
  players,
  guesses,
  clueGiverId,
  target,
}: {
  players: Player[]
  guesses: Guess[]
  clueGiverId: string
  target: Cell
}): PlayerRoundResult[] {
  const totalPlayers = players.length
  const clueGiverPerPawn = totalPlayers === 3 ? 2 : 1

  const results: PlayerRoundResult[] = []

  let pawnsInsideFrame = 0

  for (const guess of guesses) {
    if (guess.playerId === clueGiverId) continue
    const distance = chebyshevDistance(guess, target)
    const inside = distance <= 2
    if (inside) pawnsInsideFrame += 1

    results.push({
      playerId: guess.playerId,
      points: pointsForDistance(distance),
      ring: inside ? distance : -1,
      isClueGiver: false,
    })
  }

  results.push({
    playerId: clueGiverId,
    points: pawnsInsideFrame * clueGiverPerPawn,
    ring: -1,
    isClueGiver: true,
  })

  return results
}
