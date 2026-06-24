"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage("")
    setError("")

    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message ?? "Nao foi possivel solicitar a recuperacao.")
        return
      }

      setMessage(data.message)
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
            Recuperar senha
          </h1>
          <p className="text-sm text-[#C2A96A]">
            Informe seu e-mail de acesso
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm text-gray-300">
              <Mail size={16} className="text-[#C2A96A]" /> E-mail
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder="Digite seu e-mail"
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
            {loading ? "Enviando..." : "ENVIAR INSTRUCOES"}
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
