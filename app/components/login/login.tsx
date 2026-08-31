"use client"

import { login } from "@/middleware/auth"
import { isValidEmail } from "@/security/validate"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import {
    FiEye,
    FiEyeOff,
    FiAlertCircle,
    FiBox,
    FiMapPin,
    FiShoppingCart,
} from "react-icons/fi"
import MolduraAuth, { type ItemMoldura } from "../auth/moldura"

const ITENS: ItemMoldura[] = [
    { texto: "Cada peça com código próprio e etiqueta de código de barras.", Icone: FiBox },
    { texto: "Endereço de guarda de cada peça, com transferência.", Icone: FiMapPin },
    { texto: "Pedidos da vitrine, vendidos, cancelados e avarias, cada um na sua tela.", Icone: FiShoppingCart },
]

type Campo = "" | "email" | "senha"

export default function Login() {
    const [email, setEmail] = useState("")
    const [pass, setPass] = useState("")
    const [mostrarSenha, setMostrarSenha] = useState(false)
    const [error, setError] = useState("")
    const [campoErro, setCampoErro] = useState<Campo>("")
    const [loading, setLoading] = useState(false)

    const emailRef = useRef<HTMLInputElement>(null)
    const senhaRef = useRef<HTMLInputElement>(null)

    const router = useRouter()

    // Marca o campo culpado, mostra o aviso e devolve o cursor para lá — sem
    // isso o usuário lê o erro no topo e precisa procurar sozinho onde clicar.
    function falhar(campo: Exclude<Campo, "">, mensagem: string) {
        setCampoErro(campo)
        setError(mensagem)

        const alvo = campo === "email" ? emailRef : senhaRef
        alvo.current?.focus()
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        setError("")
        setCampoErro("")

        // Validação no frontend
        if (!email) {
            falhar("email", "Digite seu e-mail")
            return
        }

        if (!isValidEmail(email)) {
            falhar("email", "Digite um e-mail válido")
            return
        }

        if (!pass) {
            falhar("senha", "Digite sua senha")
            return
        }

        try {
            setLoading(true)

            await login(email, pass)

            // Login realizado
            router.push("/page/produtos")

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
        <MolduraAuth
            etiqueta="Acesso ao painel"
            chamada="O estoque da sua loja, peça a peça."
            itens={ITENS}
            nota="Painel de gestão para lojas de roupa. Dois planos mensais, a partir de R$ 50, com cancelamento quando você quiser."
        >

            <form onSubmit={handleSubmit} noValidate>

                <h1 className="font-display text-[1.75rem] leading-tight text-[#1E2428]">
                    Entrar na sua conta
                </h1>

                <p className="mt-2 text-sm text-[#5A6469]">
                    Use o e-mail e a senha cadastrados para abrir o painel da loja.
                </p>

                <div className="mt-8 space-y-5">

                    <div>
                        <label htmlFor="email" className="rotulo">
                            E-mail
                        </label>

                        <input
                            id="email"
                            ref={emailRef}
                            type="email"
                            autoComplete="email"
                            autoFocus
                            placeholder="voce@sualoja.com.br"
                            className="field"
                            aria-invalid={campoErro === "email"}
                            disabled={loading}
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value)
                                if (campoErro === "email") setCampoErro("")
                            }}
                        />
                    </div>

                    <div>
                        <label htmlFor="senha" className="rotulo">
                            Senha
                        </label>

                        <div className="relative">
                            <input
                                id="senha"
                                ref={senhaRef}
                                type={mostrarSenha ? "text" : "password"}
                                autoComplete="current-password"
                                placeholder="Digite sua senha"
                                className="field pr-11"
                                aria-invalid={campoErro === "senha"}
                                disabled={loading}
                                value={pass}
                                onChange={(e) => {
                                    setPass(e.target.value)
                                    if (campoErro === "senha") setCampoErro("")
                                }}
                            />

                            <button
                                type="button"
                                onClick={() => setMostrarSenha((v) => !v)}
                                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                            >
                                {mostrarSenha
                                    ? <FiEyeOff className="w-[1.05rem]" aria-hidden />
                                    : <FiEye className="w-[1.05rem]" aria-hidden />}
                            </button>
                        </div>
                    </div>

                </div>

                {/* ERRO */}
                {error && (
                    <div
                        role="alert"
                        className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#F5C6C0] bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]"
                    >
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{error}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primario mt-7 w-full py-3 text-base"
                >
                    {loading ? "Entrando..." : "Entrar"}
                </button>

                <p className="mt-6 border-t border-[#E4E9EB] pt-6 text-center text-sm text-[#5A6469]">
                    Ainda não tem uma conta?{" "}
                    <Link href="/cadastro" className="font-semibold text-[#0086FF] hover:underline">
                        Criar conta
                    </Link>
                </p>

            </form>

        </MolduraAuth>
    )
}
