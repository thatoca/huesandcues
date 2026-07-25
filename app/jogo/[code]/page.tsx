import { PlayerRoom } from "@/components/player-room"

export default async function JogoRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <PlayerRoom code={code.toUpperCase()} />
}
