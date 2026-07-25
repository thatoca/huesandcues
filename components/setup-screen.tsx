"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { Player } from "@/lib/types"
import { cn } from "@/lib/utils"

const PAWN_COLORS = [
  "#E63946", // red
  "#457B9D", // blue
  "#2A9D8F", // green
  "#E9C46A", // yellow
  "#F4A261", // orange
  "#8E7DBE", // purple
]

type SetupScreenProps = {
  onStart: (players: Player[]) => void
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [names, setNames] = useState<string[]>(["", "", ""])

  const updateName = (index: number, value: string) => {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)))
  }

  const addPlayer = () => {
    if (names.length >= 6) return
    setNames((prev) => [...prev, ""])
  }

  const removePlayer = (index: number) => {
    if (names.length <= 3) return
    setNames((prev) => prev.filter((_, i) => i !== index))
  }

  const validNames = names.map((n) => n.trim())
  const canStart = validNames.filter(Boolean).length === names.length && names.length >= 3

  const handleStart = () => {
    if (!canStart) return
    const players: Player[] = validNames.map((name, i) => ({
      id: `p${i}`,
      name,
      color: PAWN_COLORS[i % PAWN_COLORS.length],
      score: 0,
    }))
    onStart(players)
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-3xl border bg-card p-6 text-card-foreground shadow-xl">
      <div className="text-center">
        <h1 className="text-balance font-serif text-3xl font-extrabold tracking-tight">Hues &amp; Cues</h1>
        <p className="mt-1 text-pretty text-sm text-muted-foreground">
          Adivinhe a cor pela pista. Mínimo de 3 jogadores para começar.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {names.map((name, index) => (
          <div key={index} className="flex items-center gap-3">
            <span
              className="size-8 shrink-0 rounded-full border-2 border-background shadow"
              style={{ backgroundColor: PAWN_COLORS[index % PAWN_COLORS.length] }}
              aria-hidden="true"
            />
            <input
              value={name}
              onChange={(e) => updateName(index, e.target.value)}
              placeholder={`Jogador ${index + 1}`}
              className="h-11 flex-1 rounded-xl border bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-2"
              maxLength={16}
            />
            <button
              type="button"
              onClick={() => removePlayer(index)}
              disabled={names.length <= 3}
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-lg text-muted-foreground transition-colors",
                names.length > 3 ? "hover:bg-destructive/10 hover:text-destructive" : "opacity-30",
              )}
              aria-label={`Remover jogador ${index + 1}`}
            >
              {"−"}
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Button type="button" variant="secondary" onClick={addPlayer} disabled={names.length >= 6}>
          + Adicionar jogador
        </Button>
        <Button type="button" onClick={handleStart} disabled={!canStart} className="h-12 text-base font-bold">
          Iniciar partida
        </Button>
        {!canStart && (
          <p className="text-center text-xs text-muted-foreground">Preencha o nome de todos os jogadores.</p>
        )}
      </div>
    </div>
  )
}
