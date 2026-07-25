"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { joinRoom } from "@/lib/actions"
import { Button } from "@/components/ui/button"

export default function JogoEntryPage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await joinRoom(code, name)
    if (!res.ok) {
      setError(res.error)
      setLoading(false)
      return
    }
    const normalized = code.trim().toUpperCase()
    localStorage.setItem(`hnc:player:${normalized}`, res.data.playerId)
    router.push(`/jogo/${normalized}`)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <span className="mx-auto mb-4 flex w-fit gap-1" aria-hidden="true">
          {["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899"].map((c) => (
            <span key={c} className="size-2.5 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </span>
        <h1 className="text-balance font-serif text-3xl font-extrabold tracking-tight">Entrar na partida</h1>
        <p className="mx-auto mt-2 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
          Digite o código da sala que o organizador compartilhou e escolha seu nome.
        </p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Código da sala</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: ABCD"
            maxLength={4}
            autoCapitalize="characters"
            required
            className="h-12 rounded-lg border bg-background px-3 text-center text-lg font-bold tracking-[0.3em] outline-none ring-primary/40 transition focus-visible:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seu nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como quer ser chamado?"
            maxLength={20}
            required
            className="h-11 rounded-lg border bg-background px-3 text-sm font-medium outline-none ring-primary/40 transition focus-visible:ring-2"
          />
        </label>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="h-11 w-full font-bold">
          {loading ? "Entrando..." : "Entrar na sala"}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        É o organizador?{" "}
        <a href="/" className="font-semibold text-foreground underline underline-offset-2">
          Criar ou observar uma sala
        </a>
      </p>
    </main>
  )
}
