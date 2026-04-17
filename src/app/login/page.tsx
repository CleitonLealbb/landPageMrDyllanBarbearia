"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, Lock, LogIn } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      })

      let data: any = {}

      const contentType = res.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        data = await res.json()
      } else {
        const text = await res.text()
        console.error("Resposta inesperada da API:", text)
        throw new Error("Resposta inválida da API")
      }

      if (!res.ok) {
        setError(data.error || "Erro ao fazer login")
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      console.error("Erro no login:", error)
      setError("Não foi possível conectar ao servidor")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center">
      <div className="absolute inset-0">
        <img
          src="/imagem-bg.jpg"
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 backdrop-blur-sm" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-[#111111] rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#C2A96A] flex items-center justify-center text-4xl font-bold text-black">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-12 h-12 mr-1"
            />
          </div>

          <h1 className="text-2xl font-bold text-white mt-4">Agendo Barber</h1>
          <p className="text-[#C2A96A] text-sm">Gerencie sua barbearia</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="text-sm text-gray-300 flex items-center gap-2 mb-2">
              <Mail size={16} className="text-[#C2A96A]" /> E-mail
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Digite seu e-mail"
              className="bg-[#b8a26975] border-[#b8a269] text-white"
            />
          </div>

          <div>
            <div className="flex justify-between text-sm text-gray-300 mb-2">
              <label className="flex items-center gap-2">
                <Lock size={16} className="text-[#C2A96A]" /> Senha
              </label>
              <a href="#" className="text-[#C2A96A] hover:underline">
                Esqueci minha senha
              </a>
            </div>

            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="bg-[#b8a26975] border-[#b8a269] text-white"
            />

            {error && (
              <div className="text-[#C2A96A] text-sm p-2">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-[#b8a269] border-gray-400 rounded"
            />
            <label htmlFor="remember" className="text-sm text-gray-400 ml-2">
              Lembrar-me
            </label>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C2A96A] text-black hover:bg-[#b89b58] font-semibold"
          >
            {loading ? "Entrando..." : "ACESSAR AGENDO"}
            <LogIn className="ml-1" size={16} />
          </Button>
        </form>
      </div>

      <p className="absolute bottom-1 text-xs text-gray-400">
        © 2025 Agendo Barber. Todos os direitos reservados.
      </p>
    </div>
  )
}