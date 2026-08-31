"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { concluirCadastro } from "@/middleware/auth"
import { consultarAssinatura } from "@/middleware/assinatura"
import { ApiError } from "@/middleware/client"
import { FiCheckCircle, FiClock, FiAlertCircle } from "react-icons/fi"

// O Stripe traz o lojista de volta assim que ele paga, mas a confirmação do
// pagamento pode levar alguns segundos. Por isso esta tela insiste algumas
// vezes antes de desistir: sem isso, quem acabou de pagar cairia numa tela de
// "não liberado" e acharia que o dinheiro sumiu.
const TENTATIVAS = 10
const INTERVALO_MS = 2000

// 402: pagamento ainda não confirmado — vale tentar de novo.
// 403: a sessão é de um lojista que já tinha conta (pagou pelo painel), e
//      não serve para criar conta nenhuma; nesse caso o caminho é o antigo,
//      esperar o webhook liberar a assinatura.
const AGUARDANDO_PAGAMENTO = 402
const SESSAO_DE_OUTRO_FLUXO = 403

type Estado = "verificando" | "entrando" | "liberada" | "demorou" | "erro"

export default function AssinaturaSucessoPage() {
    const [estado, setEstado] = useState<Estado>("verificando")
    const [erro, setErro] = useState("")
    const cancelado = useRef(false)
    const router = useRouter()

    useEffect(() => {
        cancelado.current = false

        // Lido de window, e não de useSearchParams, para esta página não
        // precisar de uma fronteira de Suspense só por causa da query.
        const sessao = new URLSearchParams(window.location.search).get("session_id") ?? ""

        async function esperar() {
            await new Promise((r) => setTimeout(r, INTERVALO_MS))
        }

        // Caminho de quem acabou de se cadastrar: a conta é criada agora, a
        // partir da sessão paga, e a sessão do lojista já vem aberta.
        async function concluirCadastroNovo(): Promise<boolean> {
            for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {

                if (cancelado.current) return true

                try {
                    await concluirCadastro(sessao)

                    if (cancelado.current) return true

                    setEstado("entrando")
                    router.replace("/page/produtos")
                    return true

                } catch (e) {
                    if (cancelado.current) return true

                    if (e instanceof ApiError && e.status === SESSAO_DE_OUTRO_FLUXO) {
                        // Não é um cadastro novo: segue pelo caminho de quem
                        // já tinha conta.
                        return false
                    }

                    if (e instanceof ApiError && e.status === AGUARDANDO_PAGAMENTO) {
                        await esperar()
                        continue
                    }

                    setErro(e instanceof Error ? e.message : "Não foi possível concluir o cadastro")
                    setEstado("erro")
                    return true
                }
            }

            if (!cancelado.current) setEstado("demorou")
            return true
        }

        // Caminho de quem já tinha conta e pagou pelo painel: quem libera é o
        // webhook, que chega ao backend por outro caminho.
        async function aguardarLiberacao() {
            for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {

                if (cancelado.current) return

                try {
                    const assinatura = await consultarAssinatura()

                    if (cancelado.current) return

                    if (assinatura.liberada) {
                        setEstado("liberada")
                        return
                    }
                } catch {
                    // Falha de rede numa das tentativas não é motivo para
                    // desistir: o webhook pode chegar na próxima volta.
                }

                await esperar()
            }

            if (!cancelado.current) setEstado("demorou")
        }

        async function executar() {
            if (sessao && await concluirCadastroNovo()) return

            await aguardarLiberacao()
        }

        executar()

        return () => {
            cancelado.current = true
        }
    }, [router])

    return (
        <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">

            <div className="card p-7 text-center sm:p-8">

                {estado === "liberada" ? (
                    <>
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F8EE] text-[#1E9E5A]">
                            <FiCheckCircle className="w-6" aria-hidden />
                        </div>

                        <h1 className="font-display mt-5 text-2xl text-[#1E2428]">
                            Pagamento confirmado
                        </h1>

                        <p className="mt-2 text-sm text-[#5A6469]">
                            Sua assinatura está ativa e o painel foi liberado.
                        </p>

                        <Link href="/page/produtos" className="btn btn-primario mt-6 w-full">
                            Ir para o painel
                        </Link>
                    </>
                ) : estado === "entrando" ? (
                    <>
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F8EE] text-[#1E9E5A]">
                            <FiCheckCircle className="w-6" aria-hidden />
                        </div>

                        <h1 className="font-display mt-5 text-2xl text-[#1E2428]">
                            Conta criada
                        </h1>

                        <p className="mt-2 text-sm text-[#5A6469]">
                            Tudo certo. Abrindo o seu painel...
                        </p>
                    </>
                ) : estado === "erro" ? (
                    <>
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FDECEA] text-[#D4351C]">
                            <FiAlertCircle className="w-6" aria-hidden />
                        </div>

                        <h1 className="font-display mt-5 text-2xl text-[#1E2428]">
                            Não conseguimos concluir aqui
                        </h1>

                        <p className="mt-2 text-sm text-[#5A6469]">
                            {erro} Se o pagamento foi aprovado, sua conta existe: entre
                            com o e-mail e a senha que você acabou de cadastrar.
                        </p>

                        <Link href="/login" className="btn btn-primario mt-6 w-full">
                            Ir para a identificação
                        </Link>
                    </>
                ) : estado === "demorou" ? (
                    <>
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F3F4] text-[#5A6469]">
                            <FiClock className="w-6" aria-hidden />
                        </div>

                        <h1 className="font-display mt-5 text-2xl text-[#1E2428]">
                            Ainda confirmando
                        </h1>

                        <p className="mt-2 text-sm text-[#5A6469]">
                            Recebemos seu pagamento, mas a confirmação do banco está
                            demorando mais que o normal. Isso costuma se resolver em
                            alguns minutos, e nada precisa ser pago de novo.
                        </p>

                        <Link href="/login" className="btn btn-secundario mt-6 w-full">
                            Ir para a identificação
                        </Link>
                    </>
                ) : (
                    <>
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F3F4] text-[#5A6469]">
                            <FiClock className="w-6" aria-hidden />
                        </div>

                        <h1 className="font-display mt-5 text-2xl text-[#1E2428]">
                            Confirmando pagamento
                        </h1>

                        <p className="mt-2 text-sm text-[#5A6469]">
                            Só um instante — estamos aguardando a confirmação.
                        </p>
                    </>
                )}

            </div>

        </main>
    )
}
