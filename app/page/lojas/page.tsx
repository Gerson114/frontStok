"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
    FiAlertCircle,
    FiCheck,
    FiEdit2,
    FiExternalLink,
    FiHome,
    FiLock,
    FiPlus,
    FiPower,
    FiX,
} from "react-icons/fi"
import { Pagina, Secao, Estado } from "@/app/components/pagina/pagina"
import { abrirLoja, consultarRede, mexerNaLoja, trocarDeLoja } from "@/middleware/lojas"
import type { LojaDaRede, RedeDeLojas } from "@/app/type/type"

/**
 * As lojas do lojista.
 *
 * O que esta tela resolve: até aqui uma conta era uma loja. O dono que abrisse
 * a segunda unidade tinha de criar outra conta, com outro e-mail — e aí não
 * havia como olhar as duas juntas, nem como o mesmo funcionário atender as
 * duas. Aqui as lojas são da CONTA: cada uma com o seu estoque, caixa, vitrine
 * e equipe, e todas debaixo do mesmo login.
 *
 * O que ela NÃO faz, de propósito: apagar loja. Fechar tira a vitrine do ar,
 * some do seletor e libera a vaga do plano — o estoque, os pedidos e o
 * histórico continuam onde estão. Uma loja fechada ainda tem nota fiscal a
 * explicar e cliente a responder.
 *
 * Trocar de loja recarrega a página inteira, e não só re-renderiza: metade do
 * painel é montada no servidor, e o que está em memória continuaria sendo o da
 * loja anterior — o lojista veria o estoque de uma unidade com o faturamento
 * de outra.
 */
export default function Lojas() {

    const [rede, setRede] = useState<RedeDeLojas | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    const [criando, setCriando] = useState(false)
    const [nome, setNome] = useState("")
    const [salvando, setSalvando] = useState(false)

    const [editando, setEditando] = useState<number | null>(null)
    const [nomeEditado, setNomeEditado] = useState("")
    const [ocupada, setOcupada] = useState(0)

    useEffect(() => {

        let cancelado = false

        async function buscar() {
            try {
                const dados = await consultarRede()

                if (!cancelado) setRede(dados)
            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof Error ? e.message : "Não foi possível listar as suas lojas.")
                }
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [])

    async function recarregar() {
        try {
            setRede(await consultarRede())
            setErro("")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível listar as suas lojas.")
        }
    }

    async function criar(evento: React.FormEvent) {

        evento.preventDefault()

        if (nome.trim() === "" || salvando) return

        setSalvando(true)
        setErro("")

        try {
            await abrirLoja(nome.trim())
            setNome("")
            setCriando(false)
            await recarregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível abrir a loja.")
        } finally {
            setSalvando(false)
        }
    }

    async function renomear(id: number) {

        if (nomeEditado.trim() === "") return

        setOcupada(id)
        setErro("")

        try {
            await mexerNaLoja(id, { nome: nomeEditado.trim() })
            setEditando(null)
            await recarregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível salvar o nome.")
        } finally {
            setOcupada(0)
        }
    }

    async function ligar(loja: LojaDaRede) {

        setOcupada(loja.id)
        setErro("")

        try {
            await mexerNaLoja(loja.id, { ativa: !loja.ativa })
            await recarregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível mudar a loja.")
        } finally {
            setOcupada(0)
        }
    }

    async function abrir(loja: LojaDaRede) {

        setOcupada(loja.id)
        setErro("")

        try {
            await trocarDeLoja(loja.id)

            // Recarga DURA, e não router.push: metade do painel é montada no
            // servidor, e uma navegação do Next reaproveitaria o que já está
            // em memória — as telas continuariam mostrando a loja anterior. É
            // a mesma escolha do redirecionamento de assinatura em
            // middleware/client.ts, e pelo mesmo motivo: o que mudou não foi a
            // rota, foi o contexto inteiro da sessão.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign("/page/inicio")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível abrir esta loja.")
            setOcupada(0)
        }
    }

    if (carregando) {
        return (
            <Pagina titulo="Minhas lojas">
                <div className="h-40 animate-pulse rounded-xl bg-[#F1F1F1]" />
            </Pagina>
        )
    }

    const lojas = rede?.lojas ?? []

    return (
        <Pagina
            titulo="Minhas lojas"
            descricao="Cada loja tem o seu estoque, caixa, vitrine e equipe — todas debaixo desta mesma conta. O painel mostra uma de cada vez."
            acoes={
                rede?.pode_abrir ? (
                    <button
                        type="button"
                        onClick={() => setCriando((v) => !v)}
                        className="btn btn-primario"
                    >
                        <FiPlus className="w-4" aria-hidden />
                        <span>Abrir loja</span>
                    </button>
                ) : (
                    <Link href="/page/assinatura" className="btn btn-neutro">
                        <FiLock className="w-4" aria-hidden />
                        <span>Abrir mais lojas</span>
                    </Link>
                )
            }
        >
            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {/* O limite do plano dito em texto, e não só pela ausência do
                botão: quem não pode abrir precisa saber POR QUE, senão
                procura o botão que não existe. */}
            {!rede?.pode_abrir && (
                <p className="rounded-lg bg-[#FFF1E3] px-4 py-3 text-sm text-[#5E4200]">
                    O seu plano comporta {rede?.limite ?? 1} loja{(rede?.limite ?? 1) > 1 ? "s" : ""}.
                    O plano Pro abre mais unidades na mesma conta, com o mesmo login e a mesma equipe.
                </p>
            )}

            {criando && (
                <Secao
                    titulo="Nova loja"
                    descricao="Ela nasce vazia: estoque, vitrine e equipe próprios. O endereço público você escolhe depois, na tela da loja."
                >
                    <form onSubmit={criar} className="flex flex-wrap items-end gap-3">

                        <div className="min-w-[16rem] flex-1">
                            <label htmlFor="nome" className="mb-1.5 block text-sm font-semibold text-[#303030]">
                                Nome da loja
                            </label>

                            <input
                                id="nome"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                maxLength={120}
                                placeholder="Unidade Centro"
                                className="field w-full"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={salvando || nome.trim() === ""}
                            className="btn btn-primario"
                        >
                            {salvando ? "Abrindo…" : "Abrir loja"}
                        </button>

                        <button type="button" onClick={() => setCriando(false)} className="btn btn-neutro">
                            Cancelar
                        </button>
                    </form>
                </Secao>
            )}

            {lojas.length === 0 ? (
                <Estado
                    Icone={FiHome}
                    tom="erro"
                    titulo="Nenhuma loja nesta conta"
                    texto="Isso não deveria acontecer — conta e loja nascem juntas. Fale com o suporte."
                />
            ) : (
                <div className="space-y-3">
                    {lojas.map((loja) => (
                        <Secao key={loja.id}>
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">

                                <div className="min-w-0 flex-1">

                                    {editando === loja.id ? (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <label htmlFor={`nome-${loja.id}`} className="sr-only">
                                                Nome da loja
                                            </label>

                                            <input
                                                id={`nome-${loja.id}`}
                                                value={nomeEditado}
                                                onChange={(e) => setNomeEditado(e.target.value)}
                                                maxLength={120}
                                                className="field min-w-[14rem] flex-1"
                                            />

                                            <button
                                                type="button"
                                                onClick={() => renomear(loja.id)}
                                                disabled={ocupada === loja.id}
                                                className="btn btn-primario px-3 py-1.5 text-xs"
                                            >
                                                <FiCheck className="w-3.5" aria-hidden />
                                                <span>Salvar</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setEditando(null)}
                                                aria-label="Cancelar"
                                                className="rounded-lg p-1.5 text-[#616161] hover:bg-[#F1F1F1]"
                                            >
                                                <FiX className="w-4" aria-hidden />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="flex flex-wrap items-center gap-2">
                                                <span className="font-display text-base text-[#303030]">
                                                    {loja.nome}
                                                </span>

                                                {loja.aberta && (
                                                    <span className="tag tag-info">
                                                        <FiHome className="w-3.5" aria-hidden />
                                                        No painel agora
                                                    </span>
                                                )}

                                                {loja.principal && (
                                                    <span className="tag tag-neutral">Principal</span>
                                                )}

                                                {!loja.ativa && (
                                                    <span className="tag tag-neutral">Fechada</span>
                                                )}
                                            </p>

                                            <p className="mt-0.5 text-sm text-[#616161]">
                                                {loja.slug ? (
                                                    <span className="inline-flex items-center gap-1">
                                                        <FiExternalLink className="w-3.5" aria-hidden />
                                                        /{loja.slug}
                                                    </span>
                                                ) : (
                                                    "Sem endereço de vitrine ainda"
                                                )}
                                            </p>
                                        </>
                                    )}
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center gap-2">

                                    {!loja.aberta && loja.ativa && (
                                        <button
                                            type="button"
                                            onClick={() => abrir(loja)}
                                            disabled={ocupada === loja.id}
                                            className="btn btn-primario px-3 py-1.5 text-xs"
                                        >
                                            {ocupada === loja.id ? "Abrindo…" : "Abrir no painel"}
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNomeEditado(loja.nome)
                                            setEditando(loja.id)
                                        }}
                                        aria-label={`Renomear ${loja.nome}`}
                                        className="rounded-lg p-2 text-[#616161] transition-colors hover:bg-[#F1F1F1]"
                                    >
                                        <FiEdit2 className="w-4" aria-hidden />
                                    </button>

                                    {/* A principal não fecha: é a que abre por
                                        padrão e a que sobra se o plano cair para
                                        o base. Fechá-la deixaria o dono sem loja
                                        para entrar — e sem esta tela, que vive
                                        dentro de uma loja aberta. */}
                                    {!loja.principal && (
                                        <button
                                            type="button"
                                            onClick={() => ligar(loja)}
                                            disabled={ocupada === loja.id}
                                            aria-label={loja.ativa ? `Fechar ${loja.nome}` : `Reabrir ${loja.nome}`}
                                            title={loja.ativa ? "Fechar loja" : "Reabrir loja"}
                                            className={`rounded-lg p-2 transition-colors ${
                                                loja.ativa
                                                    ? "text-[#8E1F0B] hover:bg-[#FEE9E8]"
                                                    : "text-[#0C5132] hover:bg-[#CDFEE1]"
                                            }`}
                                        >
                                            <FiPower className="w-4" aria-hidden />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Secao>
                    ))}
                </div>
            )}
        </Pagina>
    )
}
