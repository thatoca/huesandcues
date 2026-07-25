"use client"

import { useMemo, useState } from "react"
import { BOARD_COLS, BOARD_ROWS, scoreRound } from "@/lib/board"
import type { Cell, Guess, Player, PlayerRoundResult } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { GameBoard } from "@/components/game-board"
import { ColorCard } from "@/components/color-card"
import { Scoreboard } from "@/components/scoreboard"
import { RoundResults } from "@/components/round-results"
import { SetupScreen } from "@/components/setup-screen"

type Phase = "setup" | "clue" | "guessing" | "reveal"

function randomCell(): Cell {
  // Keep the target away from the very edges so the 5x5 frame stays visible.
  const row = 2 + Math.floor(Math.random() * (BOARD_ROWS - 4))
  const col = 2 + Math.floor(Math.random() * (BOARD_COLS - 4))
  return { row, col }
}

export default function Page() {
  const [phase, setPhase] = useState<Phase>("setup")
  const [players, setPlayers] = useState<Player[]>([])
  const [round, setRound] = useState(1)
  const [clueGiverIndex, setClueGiverIndex] = useState(0)
  const [target, setTarget] = useState<Cell | null>(null)
  const [clue, setClue] = useState("")
  const [revealSecret, setRevealSecret] = useState(false)

  // guessing state
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [activeGuesserIdx, setActiveGuesserIdx] = useState(0)
  const [activeGuess, setActiveGuess] = useState<Cell | null>(null)

  // reveal state
  const [results, setResults] = useState<PlayerRoundResult[]>([])

  const clueGiver = players[clueGiverIndex]
  const guessers = useMemo(
    () => players.filter((p) => p.id !== clueGiver?.id),
    [players, clueGiver],
  )
  const activeGuesser = guessers[activeGuesserIdx]

  const roundPoints = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of results) map[r.playerId] = r.points
    return map
  }, [results])

  function startGame(newPlayers: Player[]) {
    setPlayers(newPlayers)
    setRound(1)
    setClueGiverIndex(0)
    beginRound(newPlayers, 0)
  }

  function beginRound(currentPlayers: Player[], nextClueGiverIdx: number) {
    setClueGiverIndex(nextClueGiverIdx)
    setTarget(randomCell())
    setClue("")
    setRevealSecret(false)
    setGuesses([])
    setActiveGuesserIdx(0)
    setActiveGuess(null)
    setResults([])
    setPhase("clue")
  }

  function confirmActiveGuess() {
    if (!activeGuess || !activeGuesser) return
    const newGuess: Guess = { ...activeGuess, playerId: activeGuesser.id }
    const nextGuesses = [...guesses.filter((g) => g.playerId !== activeGuesser.id), newGuess]
    setGuesses(nextGuesses)
    setActiveGuess(null)

    if (activeGuesserIdx + 1 < guessers.length) {
      setActiveGuesserIdx(activeGuesserIdx + 1)
    } else {
      reveal(nextGuesses)
    }
  }

  function reveal(finalGuesses: Guess[]) {
    if (!target || !clueGiver) return
    const roundResults = scoreRound({
      players,
      guesses: finalGuesses,
      clueGiverId: clueGiver.id,
      target,
    })
    setResults(roundResults)
    // Update overall scores
    setPlayers((prev) =>
      prev.map((p) => {
        const r = roundResults.find((x) => x.playerId === p.id)
        return r ? { ...p, score: p.score + r.points } : p
      }),
    )
    setPhase("reveal")
  }

  function nextRound() {
    const nextIdx = (clueGiverIndex + 1) % players.length
    setRound((r) => r + 1)
    beginRound(players, nextIdx)
  }

  function restartGame() {
    setPhase("setup")
    setPlayers([])
    setResults([])
    setTarget(null)
  }

  if (phase === "setup") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <SetupScreen onStart={startGame} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 pb-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-card-foreground shadow-sm">
          <div>
            <h1 className="font-serif text-xl font-extrabold tracking-tight">Hues &amp; Cues</h1>
            <p className="text-xs text-muted-foreground">Rodada {round}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Pista de</span>
            <span className="flex items-center gap-2 rounded-full bg-accent px-3 py-1 font-semibold text-accent-foreground">
              <span className="size-3 rounded-full" style={{ backgroundColor: clueGiver?.color }} aria-hidden="true" />
              {clueGiver?.name}
            </span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={restartGame}>
            Reiniciar
          </Button>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Board + phase controls */}
          <div className="flex flex-col gap-4">
            <GameBoard
              guesses={guesses}
              players={players}
              target={target}
              revealed={phase === "reveal"}
              activeGuess={phase === "guessing" ? activeGuess : null}
              interactive={phase === "guessing"}
              onCellClick={(cell) => phase === "guessing" && setActiveGuess(cell)}
            />

            {phase === "clue" && (
              <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <ColorCard target={target!} revealed={revealSecret} hidden={!revealSecret} />
                  <div className="flex flex-1 flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-card-foreground">{clueGiver?.name}</span>, veja a cor secreta em
                      segredo e escreva uma pista de uma palavra.
                    </p>
                    <Button
                      type="button"
                      variant={revealSecret ? "secondary" : "default"}
                      onClick={() => setRevealSecret((v) => !v)}
                    >
                      {revealSecret ? "Ocultar cor secreta" : "Ver cor secreta"}
                    </Button>
                    <input
                      value={clue}
                      onChange={(e) => setClue(e.target.value)}
                      placeholder="Digite a pista..."
                      className="h-11 rounded-xl border bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-2"
                      maxLength={40}
                    />
                    <Button
                      type="button"
                      className="h-11 font-bold"
                      disabled={!clue.trim()}
                      onClick={() => {
                        setRevealSecret(false)
                        setPhase("guessing")
                      }}
                    >
                      Iniciar palpites
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {phase === "guessing" && activeGuesser && (
              <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">
                    Pista: <span className="font-bold">{clue}</span>
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {activeGuesserIdx + 1} / {guessers.length}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2">
                  <span className="size-5 rounded-full border border-background" style={{ backgroundColor: activeGuesser.color }} aria-hidden="true" />
                  <p className="flex-1 text-sm font-semibold">
                    Vez de {activeGuesser.name} — toque numa cor do tabuleiro
                  </p>
                </div>
                <Button type="button" className="h-11 font-bold" disabled={!activeGuess} onClick={confirmActiveGuess}>
                  {activeGuess ? "Confirmar peão" : "Escolha uma cor"}
                </Button>
              </div>
            )}

            {phase === "reveal" && (
              <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm sm:flex-row sm:items-start">
                <ColorCard target={target!} revealed />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Pista era <span className="font-bold text-card-foreground">{clue}</span>. A moldura de pontuação
                    5×5 foi destacada no tabuleiro.
                  </p>
                  <Button type="button" className="mt-4 h-11 w-full font-bold sm:w-auto" onClick={nextRound}>
                    Próxima rodada
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="flex flex-col gap-4">
            {phase === "reveal" && (
              <RoundResults results={results} players={players} totalPlayers={players.length} />
            )}
            <Scoreboard
              players={players}
              clueGiverId={clueGiver?.id}
              roundPoints={phase === "reveal" ? roundPoints : undefined}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
