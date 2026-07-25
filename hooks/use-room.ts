"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { GuessRow, PlayerRow, RoomRow, RoomSnapshot } from "@/lib/types"

// Subscribes to a room and keeps a live snapshot (room + players + guesses).
export function useRoom(roomId: string | null) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  const refetch = useCallback(async () => {
    if (!roomId) return
    const [{ data: room }, { data: players }, { data: guesses }] = await Promise.all([
      supabase.from("rooms").select("*").eq("id", roomId).single(),
      supabase.from("players").select("*").eq("room_id", roomId).order("join_order", { ascending: true }),
      supabase.from("guesses").select("*").eq("room_id", roomId),
    ])
    if (room) {
      setSnapshot({
        room: room as RoomRow,
        players: (players ?? []) as PlayerRow[],
        guesses: (guesses ?? []) as GuessRow[],
      })
    }
    setLoading(false)
  }, [roomId, supabase])

  useEffect(() => {
    if (!roomId) return
    let active = true

    refetch()

    const channel = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () => {
        if (active) refetch()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` }, () => {
        if (active) refetch()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "guesses", filter: `room_id=eq.${roomId}` }, () => {
        if (active) refetch()
      })
      .subscribe()

    // Safety poll in case a realtime event is missed.
    const interval = setInterval(() => {
      if (active) refetch()
    }, 4000)

    return () => {
      active = false
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [roomId, supabase, refetch])

  return { snapshot, loading, refetch }
}
