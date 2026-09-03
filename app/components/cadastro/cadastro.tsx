"use client"

import { cadastro, irPagar } from "@/middleware/auth"
import { consultarOfertaPublica, formatarPreco } from "@/middleware/assinatura"
import { isValidEmail, isValidPassword } from "@/security/validate"
import { irParaPaginaExterna } from "@/security/navegacao"
import type { Oferta } from "@/app/type/type"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
    FiEye,
    FiEyeOff,
    FiAlertCircle,
    FiCheckCircle,
    FiCheck,
    FiCircle,
    FiCreditCard,
    FiPrinter,
    FiTag,
    FiArrowLeft,
    FiLock,
} from "react-icons/fi"
import MolduraAuth, { type ItemMoldura } from "../auth/moldura"

const ITENS: ItemMoldura[] = [
    { texto: "Cadastro em dois passos: seus dados e o pagamento da assinatura.", Icone: FiTag },
    { texto: "Etiqueta com código de barras pronta para imprimir por peça.", Icone: FiPrinter },
    { texto: "Assinatura mensal, cancelada por você mesmo quando quiser.", Icone: FiCreditCard },
]

type Campo = "" | "email" | "senha" | "confirmar"
type Passo = "dados" | "pagamento"

export default function Cadastro() {
    const [passo, setPasso] = useState<Passo>("dados")

    const [email, setEmail] = useState("")
    const [pass, setPass] = useState("")
    const [confirmarPass, setConfirmarPass] = useState("")
    const [mostrarSenha, setMostrarSenha] = useState(false)
    const [error, setError] = useState("")
    const [campoErro, setCampoErro] = useState<Campo>("")
    const [sucesso, setSucesso] = useState(false)
    const [loading, setLoading] = useState(false)

    // A oferta vem do backend — nenhum preço é escrito aqui, senão um dia a
    // tela mostra um valor e a fatura cobra outro.
    const [oferta, setOferta] = useState<Oferta | null>(null)
    const [enviando, setEnviando] = useState(false)

    const emailRef = useRef<HTMLInputElement>(null)
    const senhaRef = useRef<HTMLInputElement>(null)
    const confirmarRef = useRef<HTMLInputElement>(null)

    const router = useRouter()

    // Busca a oferta já na abertura para o preço aparecer antes mesmo de o
    // visitante preencher o formulário. Falhar aqui não atrapalha: o passo
    // seguinte a traz de novo.
    useEffect(() => {
        let cancelado = false

        consultarOfertaPublica()
            .then((dados) => {
                if (cancelado) return
                setOferta(dados.oferta ?? null)
            })
            .catch(() => { })

        return () => {
            cancelado = true
        }
    }, [])

    // Regras da senha mostradas enquanto o usuário digita — as mesmas que o
    // submit cobra, para o erro não chegar só depois de clicar em continuar.
    const regras = [
        { texto: "Entre 8 e 72 caracteres", ok: isValidPassword(pass) },
        { texto: "As duas senhas são iguais", ok: pass.length > 0 && pass === confirmarPass },
    ]

    const nota = oferta?.preco
        ? `${formatarPreco(oferta.preco)} por mês, com tudo incluído.`
        : "Uma assinatura mensal, com tudo incluído: o estoque da loja física, o balcão e a sua loja na internet."

    // Marca o campo culpado, mostra o aviso e devolve o cursor para lá.
    function falhar(campo: Exclude<Campo, "">, mensagem: string) {
        setCampoErro(campo)
        setError(mensagem)

        const alvo =
            campo === "email" ? emailRef
                : campo === "senha" ? senhaRef
                    : confirmarRef

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
            falhar("senha", "Digite uma senha")
            return
        }

        if (!isValidPassword(pass)) {
            falhar("senha", "A senha deve ter entre 8 e 72 caracteres")
            return
        }

        if (pass !== confirmarPass) {
            falhar("confirmar", "As senhas não coincidem")
            return
        }

        try {
            setLoading(true)

            const inicio = await cadastro(email, pass)

            // Servidor sem cobrança configurada (desenvolvimento): a conta já
            // foi criada e não há o que pagar.
            if (inicio.proximo_passo === "login") {
                setSucesso(true)
                setTimeout(() => router.push("/login"), 1500)
                return
            }

            if (inicio.oferta) setOferta(inicio.oferta)

            setPasso("pagamento")

        } catch (error) {
            console.error("Erro:", error)

            if (error instanceof Error) {
                setError(error.message)
            } else {
                setError("Erro ao criar conta")
            }

        } finally {
            setLoading(false)
        }
    }

    // O pagamento acontece fora daqui, na página do provedor de cobrança —
    // por isso a navegação é uma troca de endereço de verdade, e não
    // router.push.
    async function irParaPagamento() {
        setError("")
        setEnviando(true)

        try {
            irParaPaginaExterna(await irPagar())
        } catch (e) {
            setError(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento")
            setEnviando(false)
        }
    }

    return (
        <MolduraAuth
            etiqueta="Gestão de loja de roupas"
            chamada="Comece a controlar cada peça da sua loja."
            itens={ITENS}
            nota={nota}
        >

            {sucesso ? (

                <div className="text-center">

                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E0FFEE] text-[#08A022]">
                        <FiCheckCircle className="w-6" aria-hidden />
                    </div>

                    <h1 className="font-display mt-5 text-[1.75rem] leading-tight text-[#1E2428]">
                        Conta criada
                    </h1>

                    <p className="mt-3 text-sm leading-relaxed text-[#5A6469]">
                        Entre com seus dados para abrir o painel.
                    </p>

                    <p className="mt-6 text-sm font-semibold text-[#8C969B]">
                        Redirecionando para a identificação...
                    </p>

                </div>

            ) : passo === "pagamento" ? (

                <div>

                    <button
                        type="button"
                        onClick={() => { setPasso("dados"); setError("") }}
                        className="flex items-center gap-1.5 text-sm font-semibold text-[#5A6469] transition-colors hover:text-[#1E2428]"
                    >
                        <FiArrowLeft className="w-4" aria-hidden />
                        Corrigir meus dados
                    </button>

                    <h1 className="font-display mt-4 text-[1.75rem] leading-tight text-[#1E2428]">
                        Assine para criar a conta
                    </h1>

                    <p className="mt-2 text-sm text-[#5A6469]">
                        É uma assinatura só, com tudo dentro. A conta é criada assim que
                        o pagamento for confirmado.
                    </p>

                    <p className="mt-1 text-sm text-[#8C969B]">
                        Conta de <span className="font-semibold text-[#5A6469]">{email}</span>
                    </p>

                    <div className="mt-6 rounded-xl border border-[#E4E9EB] p-5">

                        <div className="flex items-baseline justify-between gap-3">
                            <h2 className="font-display text-lg text-[#1E2428]">
                                {oferta?.nome ?? "Arara"}
                            </h2>

                            <p className="shrink-0 text-right">
                                <span className="font-display text-xl text-[#1E2428]">
                                    {formatarPreco(oferta?.preco)}
                                </span>
                                <span className="block text-xs text-[#8C969B]">por mês</span>
                            </p>
                        </div>

                        {oferta?.descricao && (
                            <p className="mt-1.5 text-sm text-[#5A6469]">
                                {oferta.descricao}
                            </p>
                        )}

                        <ul className="mt-4 space-y-1.5">
                            {(oferta?.recursos ?? []).map((recurso) => (
                                <li key={recurso} className="flex items-start gap-2 text-sm text-[#5A6469]">
                                    <FiCheck className="mt-0.5 w-4 shrink-0 text-[#08A022]" aria-hidden />
                                    {recurso}
                                </li>
                            ))}
                        </ul>

                        <button
                            type="button"
                            disabled={enviando}
                            onClick={irParaPagamento}
                            className="btn btn-primario mt-5 w-full py-2.5"
                        >
                            {enviando ? "Abrindo pagamento..." : "Assinar e criar conta"}
                        </button>

                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#F5C6C0] bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]"
                        >
                            <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                            <span>{error}</span>
                        </div>
                    )}

                    <p className="mt-6 flex items-start gap-2 border-t border-[#E4E9EB] pt-6 text-xs leading-relaxed text-[#8C969B]">
                        <FiLock className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                        O cartão é digitado numa página segura do processador de
                        cobrança, nunca aqui. Sua conta é criada quando o pagamento
                        for confirmado.
                    </p>

                </div>

            ) : (

                <form onSubmit={handleSubmit} noValidate>

                    <h1 className="font-display text-[1.75rem] leading-tight text-[#1E2428]">
                        Criar conta
                    </h1>

                    <p className="mt-2 text-sm text-[#5A6469]">
                        Comece com seu e-mail e uma senha. No próximo passo você
                        assina — é uma assinatura só, com tudo incluído.
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
                                    autoComplete="new-password"
                                    placeholder="Mínimo de 8 caracteres"
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

                        <div>
                            <label htmlFor="confirmar-senha" className="rotulo">
                                Confirmar senha
                            </label>

                            <input
                                id="confirmar-senha"
                                ref={confirmarRef}
                                type={mostrarSenha ? "text" : "password"}
                                autoComplete="new-password"
                                placeholder="Digite a senha novamente"
                                className="field"
                                aria-invalid={campoErro === "confirmar"}
                                disabled={loading}
                                value={confirmarPass}
                                onChange={(e) => {
                                    setConfirmarPass(e.target.value)
                                    if (campoErro === "confirmar") setCampoErro("")
                                }}
                            />
                        </div>

                        {/* Regras da senha, marcadas conforme vão sendo atendidas. */}
                        {pass.length > 0 && (
                            <ul className="space-y-1.5 rounded-lg bg-[#F0F3F4] px-4 py-3">
                                {regras.map(({ texto, ok }) => (
                                    <li
                                        key={texto}
                                        className={`flex items-center gap-2 text-xs font-semibold ${ok ? "text-[#08A022]" : "text-[#5A6469]"}`}
                                    >
                                        {ok
                                            ? <FiCheck className="w-3.5 shrink-0" aria-hidden />
                                            : <FiCircle className="w-3.5 shrink-0" aria-hidden />}
                                        {texto}
                                    </li>
                                ))}
                            </ul>
                        )}

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
                        {loading ? "Aguarde..." : "Continuar"}
                    </button>

                    <p className="mt-6 border-t border-[#E4E9EB] pt-6 text-center text-sm text-[#5A6469]">
                        Já tem uma conta?{" "}
                        <Link href="/login" className="font-semibold text-[#0086FF] hover:underline">
                            Entrar
                        </Link>
                    </p>

                </form>

            )}

        </MolduraAuth>
    )
}
