"use client"

import { login } from "@/middleware/auth"
import { isValidEmail } from "@/security/validate"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function Login() {
    const [email, setEmail] = useState("")
    const [pass, setPass] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const router = useRouter()

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        setError("")

        // Validação no frontend
        if (!email) {
            setError("Digite seu e-mail")
            return
        }

        if (!isValidEmail(email)) {
            setError("Digite um e-mail válido")
            return
        }

        if (!pass) {
            setError("Digite sua senha")
            return
        }

        try {
            setLoading(true)

            await login(email, pass)

            // Login realizado
            router.push("/page/home")

        } catch (error) {
            console.error("Erro:", error)

            if (error instanceof Error) {
                setError(error.message)
            } else {
                setError("Erro ao fazer login")
            }

        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#F6F5F1] px-4">
            <div className="w-full max-w-md">

                <div className="mb-8 flex items-center justify-center gap-3">
                    <div className="font-display flex h-10 w-10 items-center justify-center rounded-lg bg-[#2F5D4E] text-lg font-semibold text-[#F6F5F1]">
                        M
                    </div>
                    <span className="font-display text-xl tracking-tight text-[#1C1B19]">
                        Minha Loja
                    </span>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="w-full space-y-7 rounded-2xl border border-[#EAE7DE] bg-white p-10"
                >

                    <div className="space-y-2">
                        <h1 className="font-display text-3xl font-medium text-[#1C1B19]">
                            Bem-vindo de volta
                        </h1>

                        <p className="text-sm text-[#8E8B80]">
                            Entre na sua conta para continuar
                        </p>
                    </div>

                    <div className="space-y-4">

                        <input
                            type="email"
                            placeholder="Seu e-mail"
                            className="field"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <input
                            type="password"
                            placeholder="Sua senha"
                            className="field"
                            value={pass}
                            onChange={(e) => setPass(e.target.value)}
                        />

                    </div>

                    {/* ERRO */}
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-[#2F5D4E] py-3.5 font-semibold text-white transition hover:bg-[#264C40] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? "Entrando..." : "Entrar"}
                    </button>

                </form>
            </div>
        </div>
    )
}
