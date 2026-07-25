"use client"

import { useEffect, useMemo, useState } from "react"
import { useRoom } from "@/hooks/use-room"
import { openSecondClue, placeGuess, revealRound, submitClue, submitSecondClue } from "@/lib/actions"
import { BOARD_COLS, BOARD_ROWS, cellHex } from "@/lib/board"
import { cellColor } from "@/lib/board"
import type { Cell, Guess, Player } from "@/lib/types"
import { GameBoard } from "@/components/game-board"
import { ColorCard } from "@/components/color-card"
import { Scoreboard } from "@/components/scoreboard"
import { RoundResults } from "@/components/round-results"
import { Button } from "@/components/ui/button"

function randomCells(): Cell[] {
  const cells: Cell[] = []
  while (cells.length < 4) {
    const cell = { row: 2 + Math.floor(Math.random() * (BOARD_ROWS - 4)), col: 2 + Math.floor(Math.random() * (BOARD_COLS - 4)) }
    if (!cells.some((item) => item.row === cell.row && item.col === cell.col)) cells.push(cell)
  }
  return cells
}

export function PlayerRoom({ code }: { code: string }) {
  const [roomId, setRoomId] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Resolve the room id + saved player id from the code stored on join.
  useEffect(() => {
    const savedPlayer = localStorage.getItem(`hnc:player:${code}`)
    setPlayerId(savedPlayer)
    // We need the room id; fetch it once through the public client.
    import("@/lib/supabase/client").then(async ({ createClient }) => {
      const supabase = createClient()
      const { data } = await supabase.from("rooms").select("id").eq("code", code).single()
      if (data) setRoomId(data.id)
      else setNotFound(true)
    })
  }, [code])

  const { snapshot, loading } = useRoom(roomId)

  if (notFound) {
    return (
      <CenteredCard>
        <h1 className="font-serif text-2xl font-bold">Sala não encontrada</h1>
        <p className="text-sm text-muted-foreground">O código {code} não existe ou a partida foi encerrada.</p>
        <Button asChild className="mt-2">
          <a href="/jogo">Voltar</a>
        </Button>
      </CenteredCard>
    )
  }

  if (loading || !snapshot) {
    return (
      <CenteredCard>
        <p className="text-sm text-muted-foreground">Conectando à sala {code}...</p>
      </CenteredCard>
    )
  }

  return <PlayerRoomInner code={code} playerId={playerId} snapshot={snapshot} />
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center text-card-foreground shadow-sm">
        {children}
      </div>
    </main>
  )
}

function PlayerRoomInner({
  code,
  playerId,
  snapshot,
}: {
  code: string
  playerId: string | null
  snapshot: NonNullable<ReturnType<typeof useRoom>["snapshot"]>
}) {
  const { room, players: playerRows, guesses: guessRows } = snapshot

  const players: Player[] = playerRows.map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score }))
  const me = players.find((p) => p.id === playerId) ?? null

  // Only current-round guesses matter on the board.
  const guesses: Guess[] = guessRows
    .filter((g) => g.round === room.current_round)
    .map((g) => ({ playerId: g.player_id, row: g.row, col: g.col, marker: g.marker }))

  const clueGiver = players.find((p) => p.id === room.clue_giver_id) ?? null
  const isClueGiver = !!me && me.id === room.clue_giver_id
  const target: Cell | null =
    room.reveal_row != null && room.reveal_col != null ? { row: room.reveal_row, col: room.reveal_col } : null

  const roundPoints = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of room.round_results ?? []) map[r.playerId] = r.points
    return map
  }, [room.round_results])

  const activeMarker: 1 | 2 | null = room.round_phase === "first_guess" ? 1 : room.round_phase === "second_guess" ? 2 : null
  const myGuess = guesses.find((g) => g.playerId === playerId && g.marker === activeMarker) ?? null

  return (
    <main className="min-h-dvh bg-background p-4 pb-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <PlayerHeader code={code} round={room.current_round} me={me} clueGiver={clueGiver} status={room.status} />

        {room.status === "lobby" && <Lobby code={code} players={players} me={me} />}

        {room.status === "finished" && (
          <div className="rounded-2xl border bg-card p-6 text-center text-card-foreground shadow-sm">
            <h2 className="font-serif text-xl font-bold">Partida encerrada!</h2>
            <p className="mt-1 text-sm text-muted-foreground">Confira o placar final abaixo.</p>
          </div>
        )}

        {room.status !== "lobby" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-4">
              <GameBoard
                guesses={guesses}
                players={players}
                target={target}
                revealed={room.status === "reveal"}
                activeGuess={null}
                interactive={room.status === "guessing" && !isClueGiver && !!activeMarker && !myGuess}
                onCellClick={(cell) => {
                  if (room.status === "guessing" && !isClueGiver && playerId) {
                    placeGuess(room.id, playerId, cell)
                  }
                }}
              />

              {/* Clue phase */}
              {room.status === "clue" && (room.round_phase === "second_clue" ? (
                <SecondCluePanel roomId={room.id} isClueGiver={isClueGiver} clueGiverName={clueGiver?.name} playerId={playerId} />
              ) : <CluePanel roomId={room.id} isClueGiver={isClueGiver} clueGiverName={clueGiver?.name} playerId={playerId} />)}

              {/* Guessing phase */}
              {room.status === "guessing" && (
                <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
                  <p className="text-sm">
                    {activeMarker === 1 ? "Primeira pista" : "Segunda pista"}: <span className="font-bold">{activeMarker === 1 ? room.clue_text : room.second_clue_text}</span>
                  </p>
                  {isClueGiver ? (
                    activeMarker === 1 ? <div className="flex flex-col gap-2 rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground"><p>Após os primeiros palpites, escolha encerrar ou oferecer uma segunda dica.</p><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => playerId && openSecondClue(room.id, playerId)}>Dar segunda dica</Button><Button type="button" variant="outline" onClick={() => revealRound(room.id)}>Encerrar rodada</Button></div></div> : <p className="rounded-xl bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">Aguarde os jogadores posicionarem o segundo marcador.</p>
                  ) : myGuess ? (
                    <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                      {activeMarker === 1 ? "Primeiro" : "Segundo"} marcador posicionado e travado. O primeiro marcador permanece no tabuleiro.
                    </p>
                  ) : (
                    <p className="rounded-xl bg-secondary/60 px-3 py-2 text-sm font-semibold">
                      Toque numa cor do tabuleiro para posicionar o {activeMarker === 1 ? "primeiro" : "segundo"} marcador.
                    </p>
                  )}
                </div>
              )}

              {/* Reveal phase */}
              {room.status === "reveal" && target && (
                <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm sm:flex-row sm:items-start">
                  <ColorCard target={target} revealed />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      A pista era <span className="font-bold text-card-foreground">{room.clue_text}</span>. A cor
                      correta é <span className="font-mono font-bold text-card-foreground">{cellHex(target.row, target.col)}</span>.
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">Aguarde o organizador iniciar a próxima rodada.</p>
                  </div>
                </div>
              )}
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
        )}
      </div>
    </main>
  )
}

function PlayerHeader({
  code,
  round,
  me,
  clueGiver,
  status,
}: {
  code: string
  round: number
  me: Player | null
  clueGiver: Player | null
  status: string
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-card-foreground shadow-sm">
      <div>
        <h1 className="font-serif text-xl font-extrabold tracking-tight">Hues &amp; Cues</h1>
        <p className="text-xs text-muted-foreground">
          Sala <span className="font-bold tracking-widest">{code}</span>
          {status !== "lobby" && ` • Rodada ${round}`}
        </p>
      </div>
      {me && (
        <span className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm font-semibold">
          <span className="size-3 rounded-full" style={{ backgroundColor: me.color }} aria-hidden="true" />
          {me.name}
        </span>
      )}
      {status !== "lobby" && clueGiver && (
        <span className="flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
          <span className="size-3 rounded-full" style={{ backgroundColor: clueGiver.color }} aria-hidden="true" />
          Pista: {clueGiver.name}
        </span>
      )}
    </header>
  )
}

function Lobby({ code, players, me }: { code: string; players: Player[]; me: Player | null }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aguardando início</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {me ? "Você está na sala. " : ""}O organizador começará a partida quando todos entrarem.
        </p>
        <div className="mx-auto mt-3 w-fit rounded-xl border bg-background px-6 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Código</p>
          <p className="font-serif text-3xl font-extrabold tracking-[0.3em]">{code}</p>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Jogadores ({players.length})
        </p>
        <ul className="flex flex-wrap gap-2">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-full bg-secondary/60 px-3 py-1.5 text-sm font-semibold"
            >
              <span className="size-3 rounded-full" style={{ backgroundColor: p.color }} aria-hidden="true" />
              {p.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function CluePanel({
  roomId,
  isClueGiver,
  clueGiverName,
  playerId,
}: {
  roomId: string
  isClueGiver: boolean
  clueGiverName?: string
  playerId: string | null
}) {
  const [clue, setClue] = useState("")
  const [options] = useState<Cell[]>(() => randomCells())
  const [target, setTarget] = useState<Cell | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  if (!isClueGiver) {
    return (
      <div className="rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-card-foreground">{clueGiverName ?? "O jogador da pista"}</span> está
          escolhendo a cor secreta e escrevendo a pista. Aguarde...
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!playerId || !target) return
    setSubmitting(true)
    setError("")
    const res = await submitClue(roomId, playerId, clue, target)
    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <ColorCard target={target ?? { row: 8, col: 15 }} revealed={!!target} hidden={!target} />
        <div className="flex flex-1 flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            É a sua vez de dar a pista! Escolha a cor secreta e escreva uma pista de uma palavra. Só você vê a cor.
          </p>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Escolha uma das 4 cores sorteadas</p>
          <div className="grid grid-cols-4 gap-2">
            {options.map((option, index) => (
              <button key={`${option.row}-${option.col}`} type="button" onClick={() => setTarget(option)} className={`h-16 rounded-xl border-4 transition-transform hover:scale-105 ${target?.row === option.row && target.col === option.col ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: cellColor(option.row, option.col) }} aria-label={`Escolher cor ${index + 1}`} />
            ))}
          </div>
          <input
            value={clue}
            onChange={(e) => setClue(e.target.value)}
            placeholder="Digite a pista..."
            className="h-11 rounded-xl border bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-2"
            maxLength={40}
          />
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" className="h-11 font-bold" disabled={!clue.trim() || !target || submitting}>
            {submitting ? "Enviando..." : "Enviar pista e iniciar palpites"}
          </Button>
        </div>
      </div>
    </form>
  )
}

function SecondCluePanel({ roomId, isClueGiver, clueGiverName, playerId }: { roomId: string; isClueGiver: boolean; clueGiverName?: string; playerId: string | null }) {
  const [clue, setClue] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  if (!isClueGiver) return <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-sm"><span className="font-semibold text-card-foreground">{clueGiverName ?? "O jogador da pista"}</span> está decidindo a segunda dica. O primeiro marcador continua fixo no tabuleiro.</div>
  return <form onSubmit={async (event) => {
    event.preventDefault()
    if (!playerId) return
    setSubmitting(true); setError("")
    const result = await submitSecondClue(roomId, playerId, clue)
    if (!result.ok) { setError(result.error); setSubmitting(false) }
  }} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
    <p className="text-sm text-muted-foreground">Segunda dica: use uma ou duas palavras. Os primeiros marcadores permanecem travados.</p>
    <input value={clue} onChange={(event) => setClue(event.target.value)} maxLength={60} placeholder="Digite a segunda dica..." className="h-11 rounded-xl border bg-background px-3 text-sm outline-none ring-ring/50 focus-visible:ring-2" />
    {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    <Button type="submit" className="h-11 font-bold" disabled={!clue.trim() || submitting}>{submitting ? "Enviando..." : "Enviar segunda dica"}</Button>
  </form>
}
