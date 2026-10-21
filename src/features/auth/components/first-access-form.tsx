"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export function FirstAccessForm() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#111111] text-white">
          Carregando...
        </main>
      }
    >
      <PrimeiroAcessoContent />
    </Suspense>
  )
}

function PrimeiroAcessoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const token = searchParams?.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!token) {
      toast.error("Token inválido.")
      return
    }

    if (!password.trim()) {
      toast.warning("Informe uma senha.")
      return
    }

    if (password.length < 6) {
      toast.warning("A senha deve ter pelo menos 6 caracteres.")
      return
    }

    if (password !== confirmPassword) {
      toast.warning("As senhas não conferem.")
      return
    }

    setLoading(true)

    const response = await fetch("/api/first-access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        password,
      }),
    })

    setLoading(false)

    const data = await response.json()

    if (!response.ok) {
      toast.error(data.message ?? "Erro ao criar senha.")
      return
    }

    toast.success("Senha criada com sucesso.")
    router.push("/login")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111111] px-4">
      <Card className="w-full max-w-md border-white/10 bg-[#171717] text-white">
        <CardHeader>
          <CardTitle>Criar senha de acesso</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <Input
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-500 text-black hover:bg-yellow-400"
            >
              {loading ? "Criando senha..." : "Criar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
