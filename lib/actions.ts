"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { scoreRound } from "@/lib/board"
import type { Guess, Player } from "@/lib/types"

const COMMON_COLOR_NAMES = new Set(["azul", "vermelho", "verde", "amarelo", "laranja", "roxo", "violeta", "rosa", "marrom", "preto", "branco", "cinza", "bege", "turquesa", "anil", "indigo"])

function validateClue(text: string, maxWords: number): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return "Digite uma pista."
  if (words.length > maxWords) return `A pista pode ter no máximo ${maxWords} ${maxWords === 1 ? "palavra" : "palavras"}.`
  const normalized = words.map((word) => word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
  if (normalized.some((word) => COMMON_COLOR_NAMES.has(word))) return "Não use nomes comuns de cores na pista."
  if (/\d/.test(text) || /\b(linha|coluna|tabuleiro|casa|quadrado)\b/i.test(text)) return "A pista não pode fazer referência a números, letras ou posições do tabuleiro."
  return null
}

// Distinct pawn colors assigned by join order.
const PAWN_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ec4899", // pink
  "#14b8a6", // teal
  "#8b5cf6", // violet
  "#f97316", // orange
  "#0ea5e9", // sky
  "#84cc16", // lime
]

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// Create a new room with an admin password. Returns the room code.
export async function createRoom(adminPassword: string): Promise<ActionResult<{ code: string; roomId: string }>> {
  const pw = adminPassword.trim()
  if (pw.length < 3) return { ok: false, error: "A senha de admin precisa ter pelo menos 3 caracteres." }

  const supabase = createAdminClient()

  // Try a few times to avoid code collisions.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateCode()
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({ code, status: "lobby", current_round: 1 })
      .select("id, code")
      .single()

    if (error) {
      if (error.code === "23505") continue // unique violation on code
      return { ok: false, error: "Não foi possível criar a sala." }
    }

    const { error: secretError } = await supabase
      .from("room_secrets")
      .insert({ room_id: room.id, admin_password: pw })

    if (secretError) {
      await supabase.from("rooms").delete().eq("id", room.id)
      return { ok: false, error: "Não foi possível salvar a senha da sala." }
    }

    return { ok: true, data: { code: room.code, roomId: room.id } }
  }

  return { ok: false, error: "Não foi possível gerar um código único. Tente novamente." }
}

// Verify admin password for a room code. Returns roomId when valid.
export async function verifyAdmin(code: string, adminPassword: string): Promise<ActionResult<{ roomId: string }>> {
  const supabase = createAdminClient()
  const normalized = code.trim().toUpperCase()

  const { data: room } = await supabase.from("rooms").select("id").eq("code", normalized).single()
  if (!room) return { ok: false, error: "Sala não encontrada." }

  const { data: secret } = await supabase
    .from("room_secrets")
    .select("admin_password")
    .eq("room_id", room.id)
    .single()

  if (!secret || secret.admin_password !== adminPassword.trim()) {
    return { ok: false, error: "Senha de administrador incorreta." }
  }

  return { ok: true, data: { roomId: room.id } }
}

// Join a room as a player. Returns roomId + playerId.
export async function joinRoom(code: string, name: string): Promise<ActionResult<{ roomId: string; playerId: string }>> {
  const trimmedName = name.trim()
  if (trimmedName.length < 1) return { ok: false, error: "Digite um nome." }

  const supabase = createAdminClient()
  const normalized = code.trim().toUpperCase()

  const { data: room } = await supabase.from("rooms").select("id, status").eq("code", normalized).single()
  if (!room) return { ok: false, error: "Sala não encontrada." }
  if (room.status !== "lobby") return { ok: false, error: "A partida já começou. Não é possível entrar agora." }

  const { data: existing } = await supabase.from("players").select("id, name").eq("room_id", room.id)
  if (existing?.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
    return { ok: false, error: "Já existe um jogador com esse nome nessa sala." }
  }
  if ((existing?.length ?? 0) >= PAWN_COLORS.length) {
    return { ok: false, error: "A sala está cheia." }
  }

  const joinOrder = existing?.length ?? 0
  const color = PAWN_COLORS[joinOrder]

  const { data: player, error } = await supabase
    .from("players")
    .insert({ room_id: room.id, name: trimmedName, color, join_order: joinOrder })
    .select("id")
    .single()

  if (error || !player) return { ok: false, error: "Não foi possível entrar na sala." }

  return { ok: true, data: { roomId: room.id, playerId: player.id } }
}

async function touchRoom(supabase: ReturnType<typeof createAdminClient>, roomId: string, patch: Record<string, unknown>) {
  return supabase
    .from("rooms")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", roomId)
}

// Admin-only: fetch the current secret target color for a room, gated by the admin password.
export async function getRoomSecret(
  roomId: string,
  adminPassword: string,
): Promise<ActionResult<{ row: number; col: number } | null>> {
  const supabase = createAdminClient()

  const { data: secret } = await supabase
    .from("room_secrets")
    .select("admin_password, target_row, target_col")
    .eq("room_id", roomId)
    .single()

  if (!secret || secret.admin_password !== adminPassword.trim()) {
    return { ok: false, error: "Senha de administrador incorreta." }
  }

  if (secret.target_row == null || secret.target_col == null) {
    return { ok: true, data: null }
  }
  return { ok: true, data: { row: secret.target_row, col: secret.target_col } }
}

// Start the game: rotate to first clue giver, move to clue phase.
export async function startGame(roomId: string): Promise<ActionResult> {
  const supabase = createAdminClient()
  const { data: players } = await supabase
    .from("players")
    .select("id, join_order")
    .eq("room_id", roomId)
    .order("join_order", { ascending: true })

  if (!players || players.length < 3) {
    return { ok: false, error: "São necessários pelo menos 3 jogadores para começar." }
  }

  await touchRoom(supabase, roomId, {
    status: "clue",
    current_round: 1,
    clue_giver_id: players[0].id,
    clue_text: null,
    second_clue_text: null,
    round_phase: "selecting",
    reveal_row: null,
    reveal_col: null,
    round_results: null,
  })
  return { ok: true, data: undefined }
}

// Clue giver secretly picks the target color and submits a clue. Moves to guessing.
export async function submitClue(
  roomId: string,
  playerId: string,
  clueText: string,
  target: { row: number; col: number },
): Promise<ActionResult> {
  const clue = clueText.trim()
  const clueError = validateClue(clue, 1)
  if (clueError) return { ok: false, error: clueError }

  const supabase = createAdminClient()
  const { data: room } = await supabase.from("rooms").select("clue_giver_id, status").eq("id", roomId).single()
  if (!room) return { ok: false, error: "Sala não encontrada." }
  if (room.clue_giver_id !== playerId) return { ok: false, error: "Apenas o jogador da pista pode fazer isso." }

  await supabase
    .from("room_secrets")
    .update({ target_row: target.row, target_col: target.col })
    .eq("room_id", roomId)

  await touchRoom(supabase, roomId, { status: "guessing", clue_text: clue, round_phase: "first_guess" })
  return { ok: true, data: undefined }
}

export async function openSecondClue(roomId: string, playerId: string): Promise<ActionResult> {
  const supabase = createAdminClient()
  const { data: room } = await supabase.from("rooms").select("status, round_phase, current_round, clue_giver_id").eq("id", roomId).single()
  if (!room || room.clue_giver_id !== playerId) return { ok: false, error: "Apenas o jogador da pista pode decidir isso." }
  if (room.status !== "guessing" || room.round_phase !== "first_guess") return { ok: false, error: "A primeira fase de palpites não está ativa." }
  const [{ count: playerCount }, { count: guessCount }] = await Promise.all([
    supabase.from("players").select("id", { count: "exact", head: true }).eq("room_id", roomId),
    supabase.from("guesses").select("id", { count: "exact", head: true }).eq("room_id", roomId).eq("round", room.current_round).eq("marker", 1),
  ])
  if ((guessCount ?? 0) < Math.max(0, (playerCount ?? 0) - 1)) return { ok: false, error: "Aguarde todos posicionarem o primeiro marcador." }
  await touchRoom(supabase, roomId, { status: "clue", round_phase: "second_clue" })
  return { ok: true, data: undefined }
}

export async function submitSecondClue(roomId: string, playerId: string, clueText: string): Promise<ActionResult> {
  const clue = clueText.trim()
  const clueError = validateClue(clue, 2)
  if (clueError) return { ok: false, error: clueError }
  const supabase = createAdminClient()
  const { data: room } = await supabase.from("rooms").select("clue_giver_id, status, round_phase").eq("id", roomId).single()
  if (!room || room.clue_giver_id !== playerId) return { ok: false, error: "Apenas o jogador da pista pode fazer isso." }
  if (room.status !== "clue" || room.round_phase !== "second_clue") return { ok: false, error: "A segunda dica não está disponível agora." }
  await touchRoom(supabase, roomId, { status: "guessing", second_clue_text: clue, round_phase: "second_guess" })
  return { ok: true, data: undefined }
}

// A guesser places one immutable pawn for the current phase.
export async function placeGuess(
  roomId: string,
  playerId: string,
  cell: { row: number; col: number },
): Promise<ActionResult> {
  const supabase = createAdminClient()
  const { data: room } = await supabase
    .from("rooms")
    .select("status, round_phase, current_round, clue_giver_id")
    .eq("id", roomId)
    .single()

  if (!room) return { ok: false, error: "Sala não encontrada." }
  if (room.status !== "guessing") return { ok: false, error: "Não é possível posicionar agora." }
  if (room.clue_giver_id === playerId) return { ok: false, error: "O jogador da pista não posiciona peão." }

  const marker = room.round_phase === "first_guess" ? 1 : room.round_phase === "second_guess" ? 2 : null
  if (!marker) return { ok: false, error: "Não há uma fase de palpite ativa." }
  const { data: own } = await supabase.from("guesses").select("id").eq("room_id", roomId).eq("round", room.current_round).eq("player_id", playerId).eq("marker", marker).maybeSingle()
  if (own) return { ok: false, error: `Seu ${marker === 1 ? "primeiro" : "segundo"} marcador já está travado.` }
  if (marker === 2) {
    const { data: occupied } = await supabase.from("guesses").select("id").eq("room_id", roomId).eq("round", room.current_round).eq("row", cell.row).eq("col", cell.col).limit(1)
    if (occupied && occupied.length) return { ok: false, error: "O segundo marcador deve ser colocado em um espaço vazio." }
  }

  const { error } = await supabase
    .from("guesses")
    .insert({ room_id: roomId, round: room.current_round, player_id: playerId, row: cell.row, col: cell.col, marker })

  if (error) return { ok: false, error: "Não foi possível salvar o palpite." }
  return { ok: true, data: undefined }
}

// Reveal the target, compute scoring, and persist scores + round results.
export async function revealRound(roomId: string): Promise<ActionResult> {
  const supabase = createAdminClient()

  const { data: room } = await supabase
    .from("rooms")
    .select("current_round, clue_giver_id, status")
    .eq("id", roomId)
    .single()
  if (!room) return { ok: false, error: "Sala não encontrada." }
  if (!room.clue_giver_id) return { ok: false, error: "Rodada inválida." }

  const { data: secret } = await supabase
    .from("room_secrets")
    .select("target_row, target_col")
    .eq("room_id", roomId)
    .single()
  if (!secret || secret.target_row == null || secret.target_col == null) {
    return { ok: false, error: "A cor secreta ainda não foi definida." }
  }

  const { data: playerRows } = await supabase
    .from("players")
    .select("id, name, color, score")
    .eq("room_id", roomId)
  const { data: guessRows } = await supabase
    .from("guesses")
    .select("player_id, row, col, marker")
    .eq("room_id", roomId)
    .eq("round", room.current_round)

  const players: Player[] = (playerRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    score: p.score,
  }))
  const guesses: Guess[] = (guessRows ?? []).map((g) => ({
    playerId: g.player_id,
    row: g.row,
    col: g.col,
    marker: g.marker,
  }))

  const results = scoreRound({
    players,
    guesses,
    clueGiverId: room.clue_giver_id,
    target: { row: secret.target_row, col: secret.target_col },
  })

  // Persist updated cumulative scores.
  const pointsById = new Map(results.map((r) => [r.playerId, r.points]))
  await Promise.all(
    players.map((p) => {
      const gained = pointsById.get(p.id) ?? 0
      return supabase.from("players").update({ score: p.score + gained }).eq("id", p.id)
    }),
  )

  await touchRoom(supabase, roomId, {
    status: "reveal",
    reveal_row: secret.target_row,
    reveal_col: secret.target_col,
    round_results: results,
  })

  return { ok: true, data: undefined }
}

// Advance to the next round: rotate clue giver, clear the target, reset to clue phase.
export async function nextRound(roomId: string): Promise<ActionResult> {
  const supabase = createAdminClient()

  const { data: room } = await supabase
    .from("rooms")
    .select("current_round, clue_giver_id")
    .eq("id", roomId)
    .single()
  if (!room) return { ok: false, error: "Sala não encontrada." }

  const { data: players } = await supabase
    .from("players")
    .select("id, join_order")
    .eq("room_id", roomId)
    .order("join_order", { ascending: true })
  if (!players || players.length === 0) return { ok: false, error: "Sem jogadores." }

  const currentIndex = players.findIndex((p) => p.id === room.clue_giver_id)
  const nextGiver = players[(currentIndex + 1) % players.length]

  await supabase
    .from("room_secrets")
    .update({ target_row: null, target_col: null })
    .eq("room_id", roomId)

  await touchRoom(supabase, roomId, {
    status: "clue",
    current_round: room.current_round + 1,
    clue_giver_id: nextGiver.id,
    clue_text: null,
    second_clue_text: null,
    round_phase: "selecting",
    reveal_row: null,
    reveal_col: null,
    round_results: null,
  })

  return { ok: true, data: undefined }
}

// End the match.
export async function finishGame(roomId: string): Promise<ActionResult> {
  const supabase = createAdminClient()
  await touchRoom(supabase, roomId, { status: "finished" })
  return { ok: true, data: undefined }
}
