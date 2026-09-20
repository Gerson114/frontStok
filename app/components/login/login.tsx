"use client"

import { login, pedirCodigoDeSenha, redefinirSenha } from "@/middleware/auth"
import { consultarMenu, consultarOfertaPublica, formatarPreco } from "@/middleware/assinatura"
import type { Oferta } from "@/app/type/type"
import { isValidEmail } from "@/security/validate"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
    FiEye,
    FiEyeOff,
    FiAlertCircle,
    FiArrowLeft,
    FiBox,
    FiCheckCircle,
    FiMapPin,
    FiShoppingCart,
} from "react-icons/fi"
import MolduraAuth, { type ItemMoldura } from "../auth/moldura"

const ITENS: ItemMoldura[] = [
    { texto: "Cada unidade com código próprio e etiqueta de código de barras.", Icone: FiBox },
    { texto: "Endereço de guarda de cada unidade, com transferência.", Icone: FiMapPin },
    { texto: "Pedidos da vitrine, vendidos, cancelados e avarias, cada um na sua tela.", Icone: FiShoppingCart },
]

type Campo = "" | "email" | "senha"

/**
 * As três telas que cabem neste formulário.
 *
 * Uma só porta para "entrar", e não uma página à parte para a recuperação:
 * quem esqueceu a senha já está aqui, e mandá-lo para outro endereço é a
 * chance de ele não voltar. O e-mail digitado acompanha os três passos, então
 * ninguém redigita nada.
 */
type Modo = "entrar" | "pedir" | "trocar"

export default function Login() {

    const [modo, setModo] = useState<Modo>("entrar")

    // O código de seis dígitos e a senha nova, do passo da recuperação.
    const [codigo, setCodigo] = useState("")
    const [senhaNova, setSenhaNova] = useState("")
    const [recado, setRecado] = useState("")
    const [email, setEmail] = useState("")
    const [pass, setPass] = useState("")
    const [mostrarSenha, setMostrarSenha] = useState(false)
    const [error, setError] = useState("")
    const [campoErro, setCampoErro] = useState<Campo>("")
    const [loading, setLoading] = useState(false)

    const emailRef = useRef<HTMLInputElement>(null)
    const senhaRef = useRef<HTMLInputElement>(null)

    // O preço da linha do rodapé vem do provedor de cobrança, como em todo
    // resto do sistema. Escrever o valor aqui foi o que deixou "a partir de
    // R$ 50" nesta tela por meses depois de o plano único de R$ 100 existir:
    // número escrito à mão é número que envelhece sozinho.
    const [oferta, setOferta] = useState<Oferta | null>(null)

    useEffect(() => {
        let cancelado = false

        consultarOfertaPublica()
            .then((dados) => {
                if (!cancelado) setOferta(dados.oferta ?? null)
            })
            .catch(() => { })

        return () => {
            cancelado = true
        }
    }, [])

    // Sem resposta do servidor, a nota fica sem preço em vez de chutar um.
    const nota = oferta?.preco
        ? `Painel de gestão para lojas de qualquer ramo. Uma assinatura só, de ${formatarPreco(oferta.preco)} por mês, com tudo incluído e cancelamento quando você quiser.`
        : "Painel de gestão para lojas de qualquer ramo. Uma assinatura mensal só, com tudo incluído e cancelamento quando você quiser."

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

            // Para onde ir depois de entrar não é mais uma resposta fixa.
            //
            // Produtos era o destino de todo mundo enquanto a loja tinha uma
            // conta só. Com funcionário isso deixou de valer: quem entra pode
            // não ter Produtos na lista dele, e cairia numa tela que a API
            // recusa — a primeira coisa que veria do sistema seria um erro.
            //
            // O menu é a resposta certa porque é a mesma lista que decide o
            // que a pessoa pode abrir: o primeiro item dele é, por
            // construção, uma tela que ela tem. Se o menu não vier, Produtos
            // continua sendo o palpite — para o dono ele está sempre certo.
            let destino = "/page/produtos"

            try {
                const menu = await consultarMenu()
                const primeiro = menu.find((item) => item.liberado) ?? menu[0]

                if (primeiro) destino = primeiro.rota
            } catch {
                // Sem menu, segue o palpite. Prender o login numa consulta
                // que falhou seria pior do que abrir na tela errada.
            }

            router.push(destino)

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

    /** Pede o código de seis dígitos para o e-mail digitado. */
    async function pedirCodigo(e: React.FormEvent) {

        e.preventDefault()
        setError("")
        setRecado("")

        if (!isValidEmail(email)) {
            setCampoErro("email")
            setError("Digite um e-mail válido")
            return
        }

        setLoading(true)

        try {
            // A frase vem do servidor de propósito: é a mesma exista ou não
            // conta com este e-mail, e escrevê-la aqui seria a chance de o
            // painel dizer mais do que o servidor quis dizer.
            setRecado(await pedirCodigoDeSenha(email))
            setModo("trocar")

        } catch (erro) {
            setError(erro instanceof Error ? erro.message : "Não foi possível pedir o código")
        } finally {
            setLoading(false)
        }
    }

    /** Troca a senha com o código na mão. */
    async function trocarSenha(e: React.FormEvent) {

        e.preventDefault()
        setError("")

        if (codigo.trim().length < 6) {
            setError("O código tem seis dígitos")
            return
        }

        setLoading(true)

        try {
            await redefinirSenha(email, codigo, senhaNova)

            // De volta ao começo, já com o e-mail preenchido: o passo seguinte
            // é entrar com a senha que ela acabou de escolher.
            setModo("entrar")
            setCodigo("")
            setSenhaNova("")
            setPass("")
            setRecado("Senha trocada. Entre com ela agora.")

        } catch (erro) {
            setError(erro instanceof Error ? erro.message : "Não foi possível trocar a senha")
        } finally {
            setLoading(false)
        }
    }

    return (
        <MolduraAuth
            etiqueta="Acesso ao painel"
            chamada="O estoque da sua loja, unidade a unidade."
            itens={ITENS}
            nota={nota}
        >

            <form
                onSubmit={modo === "entrar" ? handleSubmit : modo === "pedir" ? pedirCodigo : trocarSenha}
                noValidate
            >

                <h1 className="font-display text-[1.75rem] leading-tight text-[var(--ink)]">
                    {modo === "entrar"
                        ? "Entrar na sua conta"
                        : modo === "pedir"
                            ? "Esqueceu a senha?"
                            : "Crie uma senha nova"}
                </h1>

                <p className="mt-2 text-sm text-[var(--ink-2)]">
                    {modo === "entrar"
                        ? "Use o e-mail e a senha cadastrados para abrir o painel da loja."
                        : modo === "pedir"
                            ? "Digite o e-mail da conta. Mandamos um código de seis dígitos para ele."
                            : "Digite o código que chegou por e-mail e escolha a senha nova. Trocar a senha encerra as sessões abertas desta conta."}
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

                    {modo === "entrar" && (
                    <div>
                        <div className="flex items-baseline justify-between gap-3">
                            <label htmlFor="senha" className="rotulo">
                                Senha
                            </label>

                            {/* Fica ao lado do rótulo, e não perdido no rodapé:
                                quem clica aqui é quem acabou de errar a senha, e
                                está olhando exatamente para este campo. */}
                            <button
                                type="button"
                                onClick={() => {
                                    setModo("pedir")
                                    setError("")
                                    setRecado("")
                                }}
                                className="text-xs font-semibold text-[var(--azul)] hover:underline"
                            >
                                esqueci minha senha
                            </button>
                        </div>

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
                                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)]"
                            >
                                {mostrarSenha
                                    ? <FiEyeOff className="w-[1.05rem]" aria-hidden />
                                    : <FiEye className="w-[1.05rem]" aria-hidden />}
                            </button>
                        </div>
                    </div>
                    )}

                    {modo === "trocar" && (
                        <>
                            <div>
                                <label htmlFor="codigo" className="rotulo">
                                    Código de seis dígitos
                                </label>

                                <input
                                    id="codigo"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    placeholder="000000"
                                    className="field font-mono text-lg tracking-[0.35em]"
                                    disabled={loading}
                                    value={codigo}
                                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                />
                            </div>

                            <div>
                                <label htmlFor="senha-nova" className="rotulo">
                                    Senha nova
                                </label>

                                <input
                                    id="senha-nova"
                                    type={mostrarSenha ? "text" : "password"}
                                    autoComplete="new-password"
                                    placeholder="A senha que você vai usar daqui em diante"
                                    className="field"
                                    disabled={loading}
                                    value={senhaNova}
                                    onChange={(e) => setSenhaNova(e.target.value)}
                                />
                            </div>
                        </>
                    )}

                </div>

                {/* ERRO */}
                {error && (
                    <div
                        role="alert"
                        className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#FCC5C0] bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]"
                    >
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{error}</span>
                    </div>
                )}

                {recado && !error && (
                    <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-[#CDFEE1] px-4 py-3 text-sm font-semibold text-[var(--verde)]">
                        <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{recado}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primario mt-7 w-full py-3 text-base"
                >
                    {loading
                        ? "Aguarde..."
                        : modo === "entrar"
                            ? "Entrar"
                            : modo === "pedir"
                                ? "Mandar o código"
                                : "Trocar a senha"}
                </button>

                {modo === "entrar" ? (
                    <p className="mt-6 border-t border-[var(--linha-suave)] pt-6 text-center text-sm text-[var(--ink-2)]">
                        Ainda não tem uma conta?{" "}
                        <Link href="/cadastro" className="font-semibold text-[var(--azul)] hover:underline">
                            Criar conta
                        </Link>
                    </p>
                ) : (
                    <div className="mt-6 border-t border-[var(--linha-suave)] pt-6 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setModo("entrar")
                                setError("")
                                setRecado("")
                            }}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--azul)] hover:underline"
                        >
                            <FiArrowLeft className="w-3.5" aria-hidden />
                            voltar para entrar
                        </button>

                        {modo === "trocar" && (
                            <p className="mt-3 text-xs text-[var(--ink-3)]">
                                Não chegou? Volte e peça outro código — há um minuto de espera
                                entre dois pedidos.
                            </p>
                        )}
                    </div>
                )}

            </form>

        </MolduraAuth>
    )
}
