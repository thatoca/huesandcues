"use client"

import { BOARD_COLS, BOARD_ROWS, cellColor, chebyshevDistance } from "@/lib/board"
import type { Cell, Guess, Player } from "@/lib/types"
import { cn } from "@/lib/utils"

type GameBoardProps = {
  guesses: Guess[]
  players: Player[]
  target: Cell | null
  revealed: boolean
  // active guesser currently placing a pawn (guessing phase)
  activeGuess?: Cell | null
  onCellClick?: (cell: Cell) => void
  interactive?: boolean
}

export function GameBoard({
  guesses,
  players,
  target,
  revealed,
  activeGuess,
  onCellClick,
  interactive = false,
}: GameBoardProps) {
  const playerById = new Map(players.map((p) => [p.id, p]))

  return (
    <div className="w-full overflow-x-auto">
      <div
        className="relative mx-auto grid aspect-[30/16] w-full min-w-[560px] max-w-[900px] overflow-hidden rounded-xl border-4 border-foreground/10 shadow-lg"
        style={{
          gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${BOARD_ROWS}, minmax(0, 1fr))`,
        }}
        role="grid"
        aria-label="Tabuleiro de cores"
      >
        {Array.from({ length: BOARD_ROWS }).map((_, row) =>
          Array.from({ length: BOARD_COLS }).map((_, col) => {
            const inFrame = revealed && target && chebyshevDistance({ row, col }, target) <= 2
            const dist = target ? chebyshevDistance({ row, col }, target) : 99
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                disabled={!interactive}
                onClick={() => onCellClick?.({ row, col })}
                className={cn(
                  "relative outline-none transition-[transform,filter] duration-150",
                  interactive && "cursor-pointer hover:z-20 hover:scale-[1.35] focus-visible:z-20 focus-visible:scale-[1.35]",
                )}
                style={{ backgroundColor: cellColor(row, col) }}
                aria-label={`Linha ${row + 1}, coluna ${col + 1}`}
              >
                {/* Dim cells outside the scoring frame on reveal */}
                {revealed && target && dist > 2 && (
                  <span className="absolute inset-0 bg-background/70" aria-hidden="true" />
                )}
                {/* Scoring frame ring emphasis */}
                {inFrame && (
                  <span
                    className={cn(
                      "absolute inset-0",
                      dist === 0 && "ring-2 ring-inset ring-foreground",
                    )}
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          }),
        )}

        {/* Scoring frame overlay (5x5) */}
        {revealed && target && <FrameOverlay target={target} />}

        {/* Target marker */}
        {revealed && target && (
          <Marker row={target.row} col={target.col} kind="target" />
        )}

        {/* Active (in-progress) guess marker */}
        {!revealed && activeGuess && (
          <Marker row={activeGuess.row} col={activeGuess.col} kind="active" />
        )}

        {/* Placed pawns */}
        {guesses.map((g) => {
          const player = playerById.get(g.playerId)
          if (!player) return null
          return (
            <Pawn key={`${g.playerId}-${g.marker}`} row={g.row} col={g.col} player={player} marker={g.marker} />
          )
        })}
      </div>
    </div>
  )
}

function cellCenterStyle(row: number, col: number): React.CSSProperties {
  return {
    left: `${((col + 0.5) / BOARD_COLS) * 100}%`,
    top: `${((row + 0.5) / BOARD_ROWS) * 100}%`,
  }
}

function FrameOverlay({ target }: { target: Cell }) {
  // The 5x5 frame spans from target-2 to target+2 (clamped visually via percentages).
  const left = ((target.col - 2) / BOARD_COLS) * 100
  const top = ((target.row - 2) / BOARD_ROWS) * 100
  const width = (5 / BOARD_COLS) * 100
  const height = (5 / BOARD_ROWS) * 100
  return (
    <span
      className="pointer-events-none absolute z-10 rounded-md border-[3px] border-foreground shadow-[0_0_0_3px_rgba(255,255,255,0.6)] animate-in fade-in zoom-in-95 duration-500"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
      aria-hidden="true"
    />
  )
}

function Marker({
  row,
  col,
  kind,
}: {
  row: number
  col: number
  kind: "target" | "active"
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2",
        kind === "target" &&
          "size-4 rounded-full border-2 border-foreground bg-background shadow-md animate-in zoom-in duration-500 md:size-5",
        kind === "active" &&
          "size-3 rounded-full border-2 border-foreground/80 bg-background/90 shadow-sm md:size-4",
      )}
      style={cellCenterStyle(row, col)}
      aria-hidden="true"
    />
  )
}

function Pawn({ row, col, player, marker }: { row: number; col: number; player: Player; marker: 1 | 2 }) {
  const initials = player.name.slice(0, 2).toUpperCase()
  return (
    <span
      className="pointer-events-none absolute z-40 flex -translate-x-1/2 -translate-y-full flex-col items-center transition-all duration-500 ease-out"
      style={cellCenterStyle(row, col)}
    >
      <span
        className={cn("flex size-5 items-center justify-center rounded-full border-2 border-background text-[8px] font-bold text-background shadow-md md:size-6 md:text-[9px]", marker === 2 && "ring-2 ring-foreground ring-offset-1")}
        style={{ backgroundColor: player.color }}
        title={player.name}
      >
        {marker === 1 ? initials : "2"}
      </span>
      <span className="mt-px size-1.5 rotate-45 border-b-2 border-r-2 border-background" style={{ backgroundColor: player.color }} aria-hidden="true" />
    </span>
  )
}
