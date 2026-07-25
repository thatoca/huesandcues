"use client"

import type { Player, PlayerRoundResult } from "@/lib/types"
import { cn } from "@/lib/utils"

type RoundResultsProps = {
  results: PlayerRoundResult[]
  players: Player[]
  totalPlayers: number
}

const ringLabel: Record<number, string> = {
  0: "Centro • 3 pts",
  1: "1º anel • 2 pts",
  2: "2º anel • 1 pt",
}

export function RoundResults({ results, players, totalPlayers }: RoundResultsProps) {
  const playerById = new Map(players.map((p) => [p.id, p]))
  const clueGiverBonus = totalPlayers === 3 ? 2 : 1

  // Guessers first (by points desc), then clue giver last.
  const ordered = [...results].sort((a, b) => {
    if (a.isClueGiver !== b.isClueGiver) return a.isClueGiver ? 1 : -1
    return b.points - a.points
  })

  return (
    <div className="rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Pontos da rodada</h2>
      <ul className="flex flex-col gap-2">
        {ordered.map((result) => {
          const player = playerById.get(result.playerId)
          if (!player) return null
          return (
            <li
              key={result.playerId}
              className="flex items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2 animate-in fade-in slide-in-from-bottom-1 duration-500"
            >
              <span className="size-4 shrink-0 rounded-full border border-background" style={{ backgroundColor: player.color }} aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{player.name}</p>
                <p className="text-xs text-muted-foreground">
                  {result.isClueGiver
                    ? `Peões na moldura × ${clueGiverBonus} ponto(s)`
                    : result.ring >= 0
                      ? ringLabel[result.ring]
                      : "Fora da moldura • 0 pt"}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-extrabold tabular-nums",
                  result.points > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {`+${result.points}`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
