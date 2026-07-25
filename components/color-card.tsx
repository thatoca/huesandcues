"use client"

import { cellColor, cellHex, cellRgb } from "@/lib/board"
import type { Cell } from "@/lib/types"
import { cn } from "@/lib/utils"

type ColorCardProps = {
  target: Cell
  revealed: boolean
  hidden?: boolean
}

export function ColorCard({ target, revealed, hidden = false }: ColorCardProps) {
  const hex = cellHex(target.row, target.col)
  const { r, g, b } = cellRgb(target.row, target.col)

  if (hidden) {
    return (
      <div className="flex aspect-[3/4] w-40 flex-col items-center justify-center rounded-2xl border-4 border-foreground/15 bg-secondary text-center shadow-md">
        <span className="text-4xl" aria-hidden="true">
          {"?"}
        </span>
        <span className="mt-2 px-4 text-xs font-medium text-muted-foreground">Cor secreta</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "aspect-[3/4] w-40 overflow-hidden rounded-2xl border-4 border-foreground/15 shadow-lg",
        revealed && "animate-in fade-in zoom-in-95 duration-500",
      )}
    >
      <div className="h-1/2 w-full" style={{ backgroundColor: cellColor(target.row, target.col) }} />
      <div className="flex h-1/2 flex-col justify-center gap-1 bg-card px-3 py-2 text-card-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cor correta</p>
        <p className="font-mono text-sm font-bold">{hex}</p>
        <p className="font-mono text-xs text-muted-foreground">{`rgb(${r}, ${g}, ${b})`}</p>
      </div>
    </div>
  )
}
