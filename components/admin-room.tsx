"use client"

import { useEffect, useState } from "react"
import { useRoom } from "@/hooks/use-room"
import {
  finishGame,
  getRoomSecret,
  nextRound,
  openSecondClue,
  revealRound,
  startGame,
  verifyAdmin,
} from "@/lib/actions"
import { cellHex } from "@/lib/board"
import type { Cell, Guess, Player } from "@/lib/types"
import { GameBoard } from "@/components/game-board"
import { ColorCard } from "@/components/color-card"
import { Scoreboard } from "@/components/scoreboard"
import { RoundResults } from "@/components/round-results"
import { Button } from "@/components/ui/button"

const MIN_PLAYERS = 3

export function AdminRoom({ code }: { code: string }) {
  const [roomId, setRoomId] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [authed, setAuthed] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState("")
  const [checking, setChecking] = useState(false)

  // Try auto-auth if this browser created/opened the room and stored a password.
  useEffect(() => {
    const saved = localStorage.getItem(`hnc:adminpw:${code}`)
    if (!saved) return
    setChecking(true)
    verifyAdmin(code, saved).then((res) => {
      if (res.ok) {
        setRoomId(res.data.roomId)
        setPassword(saved)
        setAuthed(true)
      }
      setChecking(false)
    })
  }, [code])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setChecking(true)
    setError("")
    const res = await verifyAdmin(code, password)
    if (!res.ok) {
      setError(res.error)
      setChecking(false)
      return
    }
    localStorage.setItem(`hnc:adminpw:${code}`, password.trim())
    setRoomId(res.data.roomId)
    setAuthed(true)
    setChecking(false)
  }

  if (notFound) {
    return (
      <Centered>
        <h1 className="font-serif text-2xl font-bold">Sala não encontrada</h1>
        <Button asChild className="mt-2">
          <a href="/">Voltar ao início</a>
        </Button>
      </Centered>
    )
  }

  if (!authed) {
    return (
      <Centered>
        <h1 className="font-serif text-2xl font-extrabold">Painel do organizador</h1>
        <p className="text-sm text-muted-foreground">
          Sala <span className="font-bold tracking-widest">{code}</span>. Digite a senha de administrador.
        </p>
        <form onSubmit={submit} className="mt-2 flex w-full flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha de administrador"
            required
            className="h-11 rounded-lg border bg-background px-3 text-sm outline-none ring-primary/40 focus-visible:ring-2"
          />
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" disabled={checking} className="h-11 font-bold">
            {checking ? "Verificando..." : "Abrir painel"}
          </Button>
        </form>
      </Centered>
    )
  }

  return <AdminRoomInner code={code} roomId={roomId!} password={password} onNotFound={() => setNotFound(true)} />
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center text-card-foreground shadow-sm">
        {children}
      </div>
    </main>
  )
}

function AdminRoomInner({
  code,
  roomId,
  password,
  onNotFound,
}: {
  code: string
  roomId: string
  password: string
  onNotFound: () => void
}) {
  const { snapshot, loading } = useRoom(roomId)
  const [secret, setSecret] = useState<Cell | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const room = snapshot?.room

  // Keep the admin's view of the secret color in sync while a round is live.
  useEffect(() => {
    if (!room) return
    if (room.status === "guessing" || room.status === "clue") {
      getRoomSecret(roomId, password).then((res) => {
        if (res.ok) setSecret(res.data)
      })
    } else {
      setSecret(null)
    }
  }, [room?.status, room?.current_round, roomId, password])

  useEffect(() => {
    if (snapshot === null && !loading) onNotFound()
  }, [snapshot, loading, onNotFound])

  if (loading || !snapshot || !room) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">Carregando painel...</p>
      </Centered>
    )
  }

  const players: Player[] = snapshot.players.map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score }))
  const guesses: Guess[] = snapshot.guesses
    .filter((g) => g.round === room.current_round)
    .map((g) => ({ playerId: g.player_id, row: g.row, col: g.col, marker: g.marker }))
  const clueGiver = players.find((p) => p.id === room.clue_giver_id) ?? null

  const revealTarget: Cell | null =
    room.reveal_row != null && room.reveal_col != null ? { row: room.reveal_row, col: room.reveal_col } : null
  const boardTarget = room.status === "reveal" ? revealTarget : showSecret ? secret : null

  const guessersCount = players.filter((p) => p.id !== room.clue_giver_id).length
  const activeMarker = room.round_phase === "second_guess" ? 2 : 1
  const guessesIn = guesses.filter((g) => g.playerId !== room.clue_giver_id && g.marker === activeMarker).length
  const firstPhaseComplete = guesses.filter((g) => g.playerId !== room.clue_giver_id && g.marker === 1).length === guessersCount
  const pendingPlayers = players.filter((p) => p.id !== room.clue_giver_id && !guesses.some((g) => g.playerId === p.id && g.marker === activeMarker))

  const roundPoints: Record<string, number> = {}
  for (const r of room.round_results ?? []) roundPoints[r.playerId] = r.points

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true)
    setError("")
    const res = await fn()
    if (!res.ok && res.error) setError(res.error)
    setBusy(false)
  }

  return (
    <main className="min-h-dvh bg-background p-4 pb-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-card-foreground shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-xl font-extrabold tracking-tight">Painel do organizador</h1>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                Admin
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Sala <span className="font-bold tracking-widest">{code}</span>
              {room.status !== "lobby" && ` • Rodada ${room.current_round}`} • Status: {statusLabel(room.status)}
            </p>
          </div>
          {clueGiver && room.status !== "lobby" && room.status !== "finished" && (
            <span className="flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
              <span className="size-3 rounded-full" style={{ backgroundColor: clueGiver.color }} aria-hidden="true" />
              Pista: {clueGiver.name}
            </span>
          )}
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            {room.status !== "lobby" && (
              <GameBoard
                guesses={guesses}
                players={players}
                target={boardTarget}
                revealed={room.status === "reveal"}
                activeGuess={null}
                interactive={false}
              />
            )}

            {/* Controls */}
            <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
              {error && <p className="text-sm font-medium text-destructive">{error}</p>}

              {room.status === "lobby" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Compartilhe o código <span className="font-bold tracking-widest text-foreground">{code}</span> com
                    os jogadores. Eles entram em <span className="font-mono">/jogo</span>. Mínimo de {MIN_PLAYERS}{" "}
                    jogadores.
                  </p>
                  <Button
                    className="h-11 font-bold"
                    disabled={busy || players.length < MIN_PLAYERS}
                    onClick={() => run(() => startGame(roomId))}
                  >
                    {players.length < MIN_PLAYERS
                      ? `Aguardando jogadores (${players.length}/${MIN_PLAYERS})`
                      : "Iniciar partida"}
                  </Button>
                </>
              )}

              {room.status === "clue" && (
                <p className="rounded-xl bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{clueGiver?.name}</span> está escolhendo a cor
                  secreta e escrevendo a pista no aparelho dele. Aguarde.
                </p>
              )}

              {room.status === "guessing" && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm">
                      {activeMarker === 1 ? "Primeira pista" : "Segunda pista"}: <span className="font-bold">{activeMarker === 1 ? room.clue_text : room.second_clue_text}</span>
                    </p>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {guessesIn}/{guessersCount} {activeMarker === 1 ? "primeiros" : "segundos"} marcadores
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{pendingPlayers.length ? `Aguardando: ${pendingPlayers.map((player) => player.name).join(", ")}` : "Todos já posicionaram o marcador desta fase."}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" onClick={() => setShowSecret((v) => !v)}>
                      {showSecret ? "Ocultar cor secreta" : "Ver cor secreta"}
                    </Button>
                    {showSecret && secret && (
                      <span className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-mono font-semibold">
                        <span
                          className="size-4 rounded-full border"
                          style={{ backgroundColor: cellHex(secret.row, secret.col) }}
                          aria-hidden="true"
                        />
                        {cellHex(secret.row, secret.col)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {room.round_phase === "first_guess" && <Button className="h-11 font-bold" disabled={busy || !firstPhaseComplete} onClick={() => run(() => openSecondClue(roomId, room.clue_giver_id!))}>Dar segunda dica</Button>}
                    <Button variant={room.round_phase === "first_guess" ? "outline" : "default"} className="h-11 font-bold" disabled={busy || guessesIn === 0} onClick={() => run(() => revealRound(roomId))}>
                      {room.round_phase === "first_guess" ? "Encerrar rodada" : "Revelar cor e pontuar"}
                    </Button>
                  </div>
                </>
              )}

              {room.status === "reveal" && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  {revealTarget && <ColorCard target={revealTarget} revealed />}
                  <div className="flex flex-1 flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      Pista: <span className="font-bold text-foreground">{room.clue_text}</span>. Pontos aplicados ao
                      placar.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button className="h-11 font-bold" disabled={busy} onClick={() => run(() => nextRound(roomId))}>
                        Próxima rodada
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 font-bold"
                        disabled={busy}
                        onClick={() => run(() => finishGame(roomId))}
                      >
                        Encerrar partida
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {room.status === "finished" && (
                <div className="text-center">
                  <p className="font-serif text-lg font-bold">Partida encerrada</p>
                  <p className="mt-1 text-sm text-muted-foreground">Confira o placar final ao lado.</p>
                  <Button asChild variant="outline" className="mt-3">
                    <a href="/">Voltar ao início</a>
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {room.status === "reveal" && room.round_results && (
              <RoundResults results={room.round_results} players={players} totalPlayers={players.length} />
            )}
            <Scoreboard
              players={players}
              clueGiverId={room.clue_giver_id ?? undefined}
              roundPoints={room.status === "reveal" ? roundPoints : undefined}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

function statusLabel(status: string): string {
  switch (status) {
    case "lobby":
      return "Aguardando"
    case "clue":
      return "Pista"
    case "guessing":
      return "Palpites"
    case "reveal":
      return "Revelação"
    case "finished":
      return "Encerrada"
    default:
      return status
  }
}
