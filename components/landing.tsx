"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { createRoom, joinRoom, verifyAdmin } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Tab = "join" | "create" | "observe"

export function Landing() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("join")

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <div className="mx-auto mb-4 flex w-fit items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 shadow-sm">
          <ColorDots />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Online</span>
        </div>
        <h1 className="text-balance font-serif text-4xl font-extrabold tracking-tight">Hues &amp; Cues</h1>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          Crie uma sala, compartilhe o código e adivinhem as cores juntos em tempo real. A pontuação é automática.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
        <TabButton active={tab === "join"} onClick={() => setTab("join")}>
          Entrar
        </TabButton>
        <TabButton active={tab === "create"} onClick={() => setTab("create")}>
          Criar sala
        </TabButton>
        <TabButton active={tab === "observe"} onClick={() => setTab("observe")}>
          Observar
        </TabButton>
      </div>

      <div className="rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
        {tab === "join" && <JoinForm router={router} />}
        {tab === "create" && <CreateForm router={router} />}
        {tab === "observe" && <ObserveForm router={router} />}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Prefere jogar todos no mesmo aparelho?{" "}
        <a href="/local" className="font-semibold text-foreground underline underline-offset-2">
          Abrir modo local
        </a>
      </p>
    </main>
  )
}

function ColorDots() {
  const colors = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899"]
  return (
    <span className="flex gap-1" aria-hidden="true">
      {colors.map((c) => (
        <span key={c} className="size-2 rounded-full" style={{ backgroundColor: c }} />
      ))}
    </span>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
        active ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        {...props}
        className="h-11 rounded-lg border bg-background px-3 text-sm font-medium outline-none ring-primary/40 transition focus-visible:ring-2"
      />
    </label>
  )
}

function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return <p className="text-sm font-medium text-destructive">{children}</p>
}

function JoinForm({ router }: { router: ReturnType<typeof useRouter> }) {
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="font-serif text-lg font-bold">Entrar em uma sala</h2>
      <Field
        label="Código da sala"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Ex: ABCD"
        maxLength={4}
        autoCapitalize="characters"
        required
      />
      <Field label="Seu nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como quer ser chamado?" maxLength={20} required />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={loading} className="h-11 w-full font-bold">
        {loading ? "Entrando..." : "Entrar na sala"}
      </Button>
    </form>
  )
}

function CreateForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await createRoom(password)
    if (!res.ok) {
      setError(res.error)
      setLoading(false)
      return
    }
    localStorage.setItem(`hnc:admin:${res.data.code}`, "1")
    router.push(`/admin/${res.data.code}`)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="font-serif text-lg font-bold">Criar sala como administrador</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Você receberá um código de 4 letras para compartilhar. Como admin, você observa a partida ao vivo — os jogadores entram só com o código e um nome.
      </p>
      <Field
        label="Senha de administrador"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Crie uma senha para observar depois"
        required
      />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={loading} className="h-11 w-full font-bold">
        {loading ? "Criando..." : "Criar sala"}
      </Button>
    </form>
  )
}

function ObserveForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await verifyAdmin(code, password)
    if (!res.ok) {
      setError(res.error)
      setLoading(false)
      return
    }
    const normalized = code.trim().toUpperCase()
    localStorage.setItem(`hnc:admin:${normalized}`, "1")
    router.push(`/admin/${normalized}`)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="font-serif text-lg font-bold">Observar como administrador</h2>
      <Field
        label="Código da sala"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Ex: ABCD"
        maxLength={4}
        required
      />
      <Field label="Senha de administrador" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={loading} className="h-11 w-full font-bold">
        {loading ? "Verificando..." : "Abrir painel"}
      </Button>
    </form>
  )
}
