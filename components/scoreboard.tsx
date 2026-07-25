"use client"

import type { Player } from "@/lib/types"
import { cn } from "@/lib/utils"

type ScoreboardProps = {
  players: Player[]
  clueGiverId?: string
  roundPoints?: Record<string, number>
}

export function Scoreboard({ players, clueGiverId, roundPoints }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const topScore = sorted.length ? sorted[0].score : 0
  const hasLeader = topScore > 0

  return (
    <div className="rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Placar geral</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((player, index) => {
          const isLeader = hasLeader && player.score === topScore
          const gained = roundPoints?.[player.id]
          return (
            <li
              key={player.id}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 transition-colors",
                isLeader ? "bg-primary/10 ring-1 ring-primary/30" : "bg-secondary/60",
              )}
            >
              <span className="w-5 text-center text-sm font-bold text-muted-foreground">{index + 1}</span>
              <span className="size-4 shrink-0 rounded-full border border-background" style={{ backgroundColor: player.color }} aria-hidden="true" />
              <span className="flex-1 truncate text-sm font-semibold">
                {player.name}
                {player.id === clueGiverId && (
                  <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">Pista</span>
                )}
                {isLeader && <span className="ml-2 text-xs" aria-label="Líder">👑</span>}
              </span>
              {typeof gained === "number" && gained > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">{`+${gained}`}</span>
              )}
              <span className="w-8 text-right text-base font-extrabold tabular-nums">{player.score}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
