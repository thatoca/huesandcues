export type Cell = {
  row: number
  col: number
}

export type Player = {
  id: string
  name: string
  color: string // hex identity color for the pawn
  score: number
}

// Guess placed by a player on the board
export type Guess = Cell & {
  playerId: string
  marker?: 1 | 2
}

// Result computed for a single player at the end of a round
export type PlayerRoundResult = {
  playerId: string
  points: number
  // distance ring: 0 = center, 1 = first ring, 2 = second ring, -1 = outside / clue giver
  ring: number
  isClueGiver: boolean
}

export type GamePhase = "setup" | "clue" | "guessing" | "reveal"

// ---- Multiplayer (Supabase) row shapes ----

export type RoomStatus = "lobby" | "clue" | "guessing" | "reveal" | "finished"

export type RoomRow = {
  id: string
  code: string
  status: RoomStatus
  current_round: number
  clue_giver_id: string | null
  clue_text: string | null
  second_clue_text: string | null
  round_phase: "selecting" | "first_guess" | "second_clue" | "second_guess" | null
  reveal_row: number | null
  reveal_col: number | null
  round_results: PlayerRoundResult[] | null
  created_at: string
  updated_at: string
}

export type PlayerRow = {
  id: string
  room_id: string
  name: string
  color: string
  score: number
  join_order: number
  created_at: string
}

export type GuessRow = {
  id: string
  room_id: string
  round: number
  player_id: string
  marker: 1 | 2
  row: number
  col: number
  created_at: string
}

// Full realtime snapshot of a room
export type RoomSnapshot = {
  room: RoomRow
  players: PlayerRow[]
  guesses: GuessRow[]
}
