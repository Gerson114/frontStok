"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    FiAlertCircle,
    FiCheck,
    FiExternalLink,
    FiHome,
    FiLock,
    FiPlus,
    FiPower,
    FiSearch,
    FiUser,
    FiUsers,
    FiX,
} from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"
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
 * O ARRANJO é o mesmo da tela de Funcionários (referência: Google Workspace
 * Admin): a rede fica estreita à esquerda e a ficha da unidade escolhida ocupa
 * a área principal. É o arranjo certo para as duas porque a pergunta é a mesma
 * — uma lista curta de coisas parecidas, e um retrato de cada uma.
 *
 * A ficha responde de uma vez o que antes exigia abrir loja por loja: o
 * endereço da vitrine, quem gerencia e quem trabalha ali. Sem isso, "quem
 * responde pela Unidade Centro?" só se descobria trocando o painel para ela e
 * abrindo Funcionários.
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

/** Texto pronto para busca: minúsculo e sem acento. */
function comparavel(texto: string): string {
    return texto
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
}

/** A inicial que vai no círculo da equipe. */
function inicial(nome: string): string {
    return (nome.trim()[0] ?? "?").toUpperCase()
}

export default function Lojas() {

    const [rede, setRede] = useState<RedeDeLojas | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    const [busca, setBusca] = useState("")
    const [escolhida, setEscolhida] = useState<number | "nova" | null>(null)

    const [nome, setNome] = useState("")
    const [salvando, setSalvando] = useState(false)
    const [ocupada, setOcupada] = useState(0)

    useEffect(() => {

        let cancelado = false

        async function buscar() {
            try {
                const dados = await consultarRede()

                if (!cancelado) {
                    setRede(dados)

                    // A loja aberta no painel nasce escolhida: é a que o
                    // lojista está olhando, e abrir a tela numa ficha vazia
                    // seria pedir um clique para dizer o que já se sabe.
                    const aberta = dados.lojas.find((uma) => uma.aberta)

                    if (aberta) {
                        setEscolhida(aberta.id)
                        setNome(aberta.nome)
                    }
                }
            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof Error ? e.message : "Erro ao consultar as suas lojas")
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
            setErro(e instanceof Error ? e.message : "Erro ao consultar as suas lojas")
        }
    }

    const lojas = useMemo(() => rede?.lojas ?? [], [rede])

    const loja = useMemo(
        () => (typeof escolhida === "number" ? lojas.find((uma) => uma.id === escolhida) ?? null : null),
        [escolhida, lojas],
    )

    const listadas = useMemo(() => {

        const termo = comparavel(busca.trim())

        if (termo === "") return lojas

        return lojas.filter((uma) =>
            comparavel(uma.nome).includes(termo) || comparavel(uma.slug ?? "").includes(termo))
    }, [busca, lojas])

    function abrirFicha(uma: LojaDaRede) {
        setEscolhida(uma.id)
        setNome(uma.nome)
    }

    function abrirCadastro() {
        setEscolhida("nova")
        setNome("")
    }

    async function criar(evento: React.FormEvent) {
        evento.preventDefault()

        if (nome.trim() === "") return

        setSalvando(true)
        setErro("")

        try {
            const nova = await abrirLoja(nome.trim())
            await recarregar()
            setEscolhida(nova.id)
            setNome(nova.nome)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível abrir a loja")
        } finally {
            setSalvando(false)
        }
    }

    /**
     * Grava o nome ao sair do campo.
     *
     * Sem botão próprio: o nome é o único campo editável da ficha, e um
     * "Salvar" só para ele viraria um botão que quase nunca se usa — e que o
     * lojista esqueceria de apertar depois de digitar.
     */
    async function renomear(uma: LojaDaRede) {

        if (nome.trim() === "" || nome.trim() === uma.nome) return

        setOcupada(uma.id)
        setErro("")

        try {
            await mexerNaLoja(uma.id, { nome: nome.trim() })
            await recarregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível renomear")
        } finally {
            setOcupada(0)
        }
    }

    async function ligar(uma: LojaDaRede) {
        setOcupada(uma.id)
        setErro("")

        try {
            await mexerNaLoja(uma.id, { ativa: !uma.ativa })
            await recarregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível mudar a situação da loja")
        } finally {
            setOcupada(0)
        }
    }

    async function abrirNoPainel(uma: LojaDaRede) {

        if (uma.aberta) return

        setOcupada(uma.id)
        setErro("")

        try {
            await trocarDeLoja(uma.id)

            // Recarga de verdade, e não re-render: metade do painel é montada
            // no servidor, e as telas continuariam mostrando a loja anterior.
            window.location.reload()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível abrir esta loja")
            setOcupada(0)
        }
    }

    if (carregando) {
        return (
            <Pagina titulo="Minhas lojas">
                <div className="card p-8 text-center text-sm text-[var(--ink-2)]">Carregando as suas lojas...</div>
            </Pagina>
        )
    }

    const podeAbrir = rede?.pode_abrir ?? false
    const limite = rede?.limite ?? 1

    return (
        <Pagina
            titulo="Minhas lojas"
            descricao="Cada loja tem o seu estoque, caixa, vitrine e equipe — todas debaixo desta mesma conta. O painel mostra uma de cada vez."
            acoes={
                podeAbrir ? (
                    <button type="button" onClick={abrirCadastro} className="btn btn-primario">
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
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {/* O limite do plano dito em texto, e não só pela ausência do
                botão: quem não pode abrir precisa saber POR QUE, senão procura
                o botão que não existe. */}
            {!podeAbrir && (
                <p className="rounded-lg bg-[var(--amarelo-fundo)] px-4 py-3 text-sm text-[var(--amarelo)]">
                    O seu plano comporta {limite} loja{limite > 1 ? "s" : ""}.
                    O plano Pro abre mais unidades na mesma conta, com o mesmo login e a mesma equipe.
                </p>
            )}

            <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">

                {/* ---------------------------------------------------------
                    A REDE
                    --------------------------------------------------------- */}
                <section className="card flex max-h-[calc(100dvh-14rem)] flex-col overflow-hidden p-0">

                    {/* A busca só aparece quando há o que buscar: numa rede de
                        duas lojas ela é um campo a mais para ler. */}
                    {lojas.length > 4 && (
                        <div className="border-b border-[var(--linha-suave)] p-3">
                            <div className="relative">
                                <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 w-4 -translate-y-1/2 text-[var(--ink-3)]" aria-hidden />

                                <input
                                    type="search"
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                    placeholder="Buscar loja"
                                    aria-label="Buscar loja na rede"
                                    className="field w-full pl-8"
                                />
                            </div>
                        </div>
                    )}

                    <div className="min-h-0 flex-1 overflow-y-auto">

                        {listadas.length === 0 && (
                            <p className="px-4 py-6 text-center text-sm text-[var(--ink-2)]">
                                Nenhuma loja com esse nome.
                            </p>
                        )}

                        {listadas.map((uma) => {

                            const ativa = escolhida === uma.id

                            return (
                                <button
                                    key={uma.id}
                                    type="button"
                                    onClick={() => abrirFicha(uma)}
                                    aria-current={ativa ? "true" : undefined}
                                    className={`flex w-full items-center gap-3 border-b border-[var(--fundo)] px-3 py-2.5 text-left transition-colors last:border-b-0 ${
                                        ativa ? "bg-[var(--fundo)]" : "hover:bg-[var(--superficie-2)]"
                                    }`}
                                >
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                        uma.ativa ? "bg-[var(--azul)] text-white" : "bg-[var(--linha)] text-[var(--ink-3)]"
                                    }`}>
                                        <FiHome className="w-4" aria-hidden />
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                                            {uma.nome}
                                        </span>

                                        <span className="block truncate text-xs text-[var(--ink-2)]">
                                            {uma.principal ? "Matriz" : "Filial"}
                                            {!uma.ativa && " · fechada"}
                                            {uma.equipe && uma.equipe.length > 0 &&
                                                ` · ${uma.equipe.length} pessoa${uma.equipe.length > 1 ? "s" : ""}`}
                                        </span>
                                    </span>

                                    {uma.aberta && <span className="shrink-0 tag tag-info">Aqui</span>}
                                </button>
                            )
                        })}
                    </div>
                </section>

                {/* ---------------------------------------------------------
                    A FICHA
                    --------------------------------------------------------- */}
                <section className="card p-6">

                    {escolhida === "nova" && (
                        <form onSubmit={criar} className="space-y-5">

                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-display text-lg text-[var(--ink)]">Nova loja</p>

                                    <p className="mt-1 text-sm text-[var(--ink-2)]">
                                        Ela nasce vazia e separada: estoque, vitrine, caixa e equipe
                                        próprios. Nada da loja principal é copiado nem alterado.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setEscolhida(null)}
                                    aria-label="Cancelar"
                                    className="rounded-lg p-1.5 text-[var(--ink-2)] hover:bg-[var(--fundo)]"
                                >
                                    <FiX className="w-4" aria-hidden />
                                </button>
                            </div>

                            <div className="max-w-sm">
                                <label htmlFor="nome-novo" className="rotulo">Nome da loja</label>

                                <input
                                    id="nome-novo"
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    maxLength={120}
                                    placeholder="Unidade Centro"
                                    className="field w-full"
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-2 border-t border-[var(--linha-suave)] pt-4">
                                <button type="button" onClick={() => setEscolhida(null)} className="btn btn-neutro">
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    disabled={salvando || nome.trim() === ""}
                                    className="btn btn-primario"
                                >
                                    {salvando ? "Abrindo..." : "Abrir loja"}
                                </button>
                            </div>
                        </form>
                    )}

                    {escolhida === null && (
                        <div className="flex min-h-[18rem] flex-col items-center justify-center text-center">
                            <FiHome className="w-8 text-[var(--ink-4)]" aria-hidden />

                            <p className="mt-3 font-display text-base text-[var(--ink)]">
                                Escolha uma loja na lista
                            </p>

                            <p className="mt-1 max-w-sm text-sm text-[var(--ink-2)]">
                                A ficha mostra o endereço da vitrine, quem gerencia a unidade e
                                quem trabalha nela.
                            </p>
                        </div>
                    )}

                    {loja && (
                        <div className="space-y-6">

                            {/* Identidade e situação */}
                            <div className="flex items-start gap-3">
                                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                                    loja.ativa ? "bg-[var(--azul)] text-white" : "bg-[var(--linha)] text-[var(--ink-3)]"
                                }`}>
                                    <FiHome className="w-5" aria-hidden />
                                </span>

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            value={nome}
                                            onChange={(e) => setNome(e.target.value)}
                                            onBlur={() => renomear(loja)}
                                            maxLength={120}
                                            aria-label="Nome da loja"
                                            className="field w-full sm:max-w-sm"
                                        />

                                        {ocupada === loja.id && (
                                            <span className="text-xs text-[var(--ink-2)]">salvando…</span>
                                        )}
                                    </div>

                                    <p className="mt-1.5 text-sm text-[var(--ink-2)]">
                                        {loja.slug ? (
                                            <span className="inline-flex items-center gap-1">
                                                <FiExternalLink className="w-3.5" aria-hidden />
                                                /{loja.slug}
                                            </span>
                                        ) : (
                                            "Sem endereço de vitrine ainda"
                                        )}
                                    </p>
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                    {loja.principal && <span className="tag tag-neutral">Matriz</span>}

                                    {loja.aberta && (
                                        <span className="tag tag-info">
                                            <FiCheck className="w-3.5" aria-hidden />
                                            No painel agora
                                        </span>
                                    )}

                                    {!loja.ativa && <span className="tag tag-neutral">Fechada</span>}
                                </div>
                            </div>

                            {/* ------------------------------------------------
                                A EQUIPE DESTA UNIDADE
                                ------------------------------------------------ */}
                            <div>
                                <p className="text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                                    Quem trabalha aqui
                                </p>

                                {loja.equipe && loja.equipe.length > 0 ? (
                                    <ul className="mt-2 divide-y divide-[var(--linha-suave)] border-y border-[var(--linha-suave)]">
                                        {loja.equipe.map((pessoa) => (
                                            <li key={pessoa.email} className="flex items-center gap-3 py-2.5">

                                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                                    pessoa.ativo ? "bg-[var(--azul)] text-white" : "bg-[var(--linha)] text-[var(--ink-3)]"
                                                }`}>
                                                    {inicial(pessoa.nome)}
                                                </span>

                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                                                        {pessoa.nome}
                                                    </span>

                                                    <span className="block truncate text-xs text-[var(--ink-2)]">
                                                        {pessoa.email}
                                                    </span>
                                                </span>

                                                {pessoa.gerente && (
                                                    <span className="shrink-0 tag tag-info">
                                                        <FiUser className="w-3.5" aria-hidden />
                                                        Gerente
                                                    </span>
                                                )}

                                                {!pessoa.ativo && (
                                                    <span className="shrink-0 tag tag-neutral">Sem acesso</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-2 rounded-lg bg-[var(--fundo)] px-4 py-3 text-sm text-[var(--ink-2)]">
                                        Ninguém cadastrado nesta loja — só você a administra.
                                    </p>
                                )}

                                {/* O cadastro acontece na loja ABERTA: é a
                                    regra do servidor, e dizê-la aqui evita a
                                    volta mais cara desta tela — cadastrar o
                                    gerente da filial dentro da matriz. */}
                                <p className="mt-2 text-xs text-[var(--ink-3)]">
                                    {loja.aberta ? (
                                        <>
                                            Esta é a loja aberta no painel, então{" "}
                                            <Link href="/page/funcionarios" className="font-semibold text-[var(--azul)] hover:underline">
                                                Funcionários
                                            </Link>{" "}
                                            cadastra gente aqui dentro.
                                        </>
                                    ) : (
                                        "Para cadastrar alguém nesta unidade, abra-a no painel primeiro — quem você cadastra nasce na loja aberta."
                                    )}
                                </p>
                            </div>

                            {/* ------------------------------------------------
                                O QUE DÁ PARA FAZER COM A UNIDADE
                                ------------------------------------------------ */}
                            <div className="flex flex-wrap gap-2 border-t border-[var(--linha-suave)] pt-5">

                                {!loja.aberta && loja.ativa && (
                                    <button
                                        type="button"
                                        onClick={() => abrirNoPainel(loja)}
                                        disabled={ocupada === loja.id}
                                        className="btn btn-primario"
                                    >
                                        <FiUsers className="w-4" aria-hidden />
                                        <span>{ocupada === loja.id ? "Abrindo…" : "Abrir no painel"}</span>
                                    </button>
                                )}

                                {/* A matriz não fecha: é a que abre por padrão e
                                    a que sobra se o plano cair para o base.
                                    Fechá-la deixaria o dono sem loja para
                                    entrar — e sem esta tela, que vive dentro de
                                    uma loja aberta. */}
                                {!loja.principal && (
                                    <button
                                        type="button"
                                        onClick={() => ligar(loja)}
                                        disabled={ocupada === loja.id}
                                        className={`btn btn-neutro ${loja.ativa ? "text-[var(--vermelho)]" : "text-[var(--verde)]"}`}
                                    >
                                        <FiPower className="w-4" aria-hidden />
                                        <span>{loja.ativa ? "Fechar loja" : "Reabrir loja"}</span>
                                    </button>
                                )}
                            </div>

                            <p className="text-xs text-[var(--ink-3)]">
                                Fechar não apaga nada: a vitrine sai do ar, a loja some do seletor e
                                libera a vaga do plano — o estoque, os pedidos e o histórico
                                continuam onde estão.
                            </p>
                        </div>
                    )}
                </section>
            </div>

        </Pagina>
    )
}
