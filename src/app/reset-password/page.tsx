"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock } from "lucide-react"

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#111111] text-white">
          Carregando...
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage("")
    setError("")

    if (!token) {
      setError("Token invalido.")
      return
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.")
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas nao conferem.")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message ?? "Nao foi possivel atualizar a senha.")
        return
      }

      setMessage(data.message)

      setTimeout(() => {
        router.push("/login")
      }, 1200)
    } catch {
      setError("Nao foi possivel conectar ao servidor.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <div className="absolute inset-0">
        <img
          src="/imagem-bg.jpg"
          alt="Background"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 backdrop-blur-sm" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#111111] p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#C2A96A] text-4xl font-bold text-black">
            <img
              src="/logo.png"
              alt="Logo"
              className="mr-1 h-12 w-12"
            />
          </div>

          <h1 className="mt-4 text-2xl font-bold text-white">
            Nova senha
          </h1>
          <p className="text-sm text-[#C2A96A]">
            Crie uma nova senha de acesso
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm text-gray-300">
              <Lock size={16} className="text-[#C2A96A]" /> Nova senha
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              placeholder="Digite sua nova senha"
              className="border-[#b8a269] bg-[#b8a26975] text-white"
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm text-gray-300">
              <Lock size={16} className="text-[#C2A96A]" /> Confirmar senha
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              placeholder="Confirme sua nova senha"
              className="border-[#b8a269] bg-[#b8a26975] text-white"
            />
          </div>

          {message && (
            <div className="text-sm text-[#C2A96A]">
              {message}
            </div>
          )}

          {error && (
            <div className="text-sm text-[#C2A96A]">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C2A96A] font-semibold text-black hover:bg-[#b89b58]"
          >
            {loading ? "Salvando..." : "SALVAR NOVA SENHA"}
          </Button>

          <Link
            href="/login"
            className="block text-center text-sm text-[#C2A96A] hover:underline"
          >
            Voltar para o login
          </Link>
        </form>
      </div>
    </div>
  )
}
