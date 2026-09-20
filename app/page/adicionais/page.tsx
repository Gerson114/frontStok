"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { FiAlertCircle, FiCheck, FiLayers, FiPlus, FiTrash2, FiX } from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"
import { formatarMoeda } from "@/app/components/preco/preco"
import {
    consultarAdicionais,
    criarGrupo,
    criarOpcao,
    excluirGrupo,
    excluirOpcao,
    salvarGrupo,
    salvarOpcao,
} from "@/middleware/adicionais"
import type { CatalogoDeAdicionais, GrupoDeAdicional } from "@/app/type/type"

/**
 * O que o cliente escolhe junto do produto.
 *
 * O que esta tela resolve: até aqui o item do pedido era produto, quantidade e
 * preço. Uma pizzaria não vende assim — "borda recheada", "sem cebola" e
 * "ponto da carne" não são produtos diferentes no estoque, são escolhas sobre
 * o MESMO produto. Sem elas, o pedido que chega na cozinha não diz o que
 * fazer.
 *
 * O ARRANJO é uma lista de grupos com as opções dentro, e não duas telas
 * ligadas por um seletor: o lojista monta "Borda" e as seis bordas na mesma
 * sentada, e separar isso em dois lugares faria ele navegar seis vezes para
 * cadastrar seis linhas.
 *
 * A decisão de modelo que se vê aqui: o grupo é da LOJA, não do produto. A
 * pizzaria com vinte pizzas monta as seis bordas UMA vez, e mudar o preço da
 * borda é uma edição em vez de vinte. Quais produtos fazem cada pergunta se
 * escolhe na ficha do produto, que é onde o lojista está quando pensa nisso.
 *
 * O mínimo e o máximo dizem sozinhos o que o grupo é, e é por isso que não há
 * um interruptor "obrigatório": mínimo 1 é obrigatório, mínimo 0 é opcional,
 * máximo 1 é escolha única. Um campo a mais seria uma segunda forma de dizer
 * a mesma coisa — e duas formas divergem.
 */

export default function Adicionais() {

    const [catalogo, setCatalogo] = useState<CatalogoDeAdicionais | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [ocupado, setOcupado] = useState(false)

    // O grupo aberto para edição, e o rascunho do que está sendo digitado.
    const [aberto, setAberto] = useState<number | "novo" | null>(null)
    const [nome, setNome] = useState("")
    const [minimo, setMinimo] = useState(0)
    const [maximo, setMaximo] = useState(1)

    // O rascunho da opção nova, por grupo: cada linha tem o seu, senão digitar
    // em um grupo apagaria o que estava escrito no outro.
    const [novaOpcao, setNovaOpcao] = useState<Record<number, { nome: string; preco: string }>>({})

    useEffect(() => {

        let cancelado = false

        async function buscar() {
            try {
                const dados = await consultarAdicionais()
                if (!cancelado) setCatalogo(dados)
            } catch (e) {
                if (!cancelado) setErro(e instanceof Error ? e.message : "Erro ao consultar os adicionais")
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
            setCatalogo(await consultarAdicionais())
            setErro("")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Erro ao consultar os adicionais")
        }
    }

    const grupos = useMemo(() => catalogo?.grupos ?? [], [catalogo])

    // Quantos produtos fazem cada pergunta. Dito na linha do grupo porque é a
    // resposta para "posso apagar isto?" — apagar um grupo ligado a dezoito
    // produtos muda dezoito fichas de uma vez.
    const produtosPorGrupo = useMemo(() => {

        const conta: Record<number, number> = {}

        for (const ligacao of catalogo?.ligacoes ?? []) {
            conta[ligacao.grupo_id] = (conta[ligacao.grupo_id] ?? 0) + 1
        }

        return conta
    }, [catalogo])

    function abrirNovo() {
        setAberto("novo")
        setNome("")
        setMinimo(0)
        setMaximo(1)
    }

    function abrirGrupo(grupo: GrupoDeAdicional) {
        setAberto(grupo.id)
        setNome(grupo.nome)
        setMinimo(grupo.minimo)
        setMaximo(grupo.maximo)
    }

    async function guardarGrupo(evento: React.FormEvent) {
        evento.preventDefault()

        if (nome.trim() === "" || ocupado) return

        setOcupado(true)
        setErro("")

        try {
            const dados = { nome: nome.trim(), minimo, maximo }

            if (aberto === "novo") {
                await criarGrupo(dados)
            } else if (typeof aberto === "number") {
                await salvarGrupo(aberto, dados)
            }

            await recarregar()
            setAberto(null)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível salvar o grupo")
        } finally {
            setOcupado(false)
        }
    }

    async function apagarGrupo(grupo: GrupoDeAdicional) {

        setOcupado(true)
        setErro("")

        try {
            await excluirGrupo(grupo.id)
            await recarregar()
            if (aberto === grupo.id) setAberto(null)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível excluir o grupo")
        } finally {
            setOcupado(false)
        }
    }

    async function acrescentarOpcao(grupo: GrupoDeAdicional) {

        const rascunho = novaOpcao[grupo.id]

        if (!rascunho || rascunho.nome.trim() === "" || ocupado) return

        setOcupado(true)
        setErro("")

        try {
            await criarOpcao({
                grupo_id: grupo.id,
                nome: rascunho.nome.trim(),
                preco: precoDigitado(rascunho.preco),
            })

            setNovaOpcao((atual) => ({ ...atual, [grupo.id]: { nome: "", preco: "" } }))
            await recarregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível acrescentar a opção")
        } finally {
            setOcupado(false)
        }
    }

    async function alternarOpcao(id: number, nomeDaOpcao: string, preco: number, ativa: boolean) {

        setOcupado(true)
        setErro("")

        try {
            await salvarOpcao(id, { nome: nomeDaOpcao, preco, ativa })
            await recarregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível mudar a opção")
        } finally {
            setOcupado(false)
        }
    }

    async function apagarOpcao(id: number) {

        setOcupado(true)
        setErro("")

        try {
            await excluirOpcao(id)
            await recarregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível excluir a opção")
        } finally {
            setOcupado(false)
        }
    }

    return (
        <Pagina
            titulo="Adicionais"
            descricao="As perguntas que um produto faz na hora da compra: borda, tamanho, ponto da carne. Cada pergunta é montada uma vez e ligada aos produtos que a usam."
            acoes={
                <button type="button" onClick={abrirNovo} className="btn btn-primario">
                    <FiPlus className="w-4" aria-hidden />
                    <span>Nova pergunta</span>
                </button>
            }
        >

            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aberto !== null && (
                <form onSubmit={guardarGrupo} className="card space-y-4 p-5">

                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="font-display text-lg text-[var(--ink)]">
                                {aberto === "novo" ? "Nova pergunta" : "Editar pergunta"}
                            </p>

                            <p className="mt-1 text-sm text-[var(--ink-2)]">
                                O nome é o que o cliente lê na tela, então escreva como você
                                perguntaria no balcão.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setAberto(null)}
                            aria-label="Fechar"
                            className="rounded-lg p-1.5 text-[var(--ink-2)] hover:bg-[var(--fundo)]"
                        >
                            <FiX className="w-4" aria-hidden />
                        </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">

                        <div>
                            <label htmlFor="nome" className="rotulo">Pergunta</label>

                            <input
                                id="nome"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                maxLength={60}
                                placeholder="Borda"
                                className="field w-full"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="minimo" className="rotulo">Escolhe no mínimo</label>

                            <input
                                id="minimo"
                                type="number"
                                min={0}
                                max={maximo}
                                value={minimo}
                                onChange={(e) => setMinimo(Number(e.target.value))}
                                className="field num w-full"
                            />
                        </div>

                        <div>
                            <label htmlFor="maximo" className="rotulo">e no máximo</label>

                            <input
                                id="maximo"
                                type="number"
                                min={1}
                                value={maximo}
                                onChange={(e) => setMaximo(Number(e.target.value))}
                                className="field num w-full"
                            />
                        </div>
                    </div>

                    {/* A regra dita em português embaixo dos números: "mínimo 1,
                        máximo 1" é preciso e ninguém lê assim. */}
                    <p className="text-xs text-[var(--ink-2)]">{comoFunciona(minimo, maximo)}</p>

                    <div className="flex justify-end gap-2 border-t border-[var(--linha-suave)] pt-4">
                        <button type="button" onClick={() => setAberto(null)} className="btn btn-neutro">
                            Cancelar
                        </button>

                        <button type="submit" disabled={ocupado || nome.trim() === ""} className="btn btn-primario">
                            {ocupado ? "Salvando…" : "Salvar pergunta"}
                        </button>
                    </div>
                </form>
            )}

            {carregando ? (
                <div className="card p-8 text-center text-sm text-[var(--ink-2)]">Carregando o cardápio…</div>
            ) : grupos.length === 0 ? (
                <div className="card flex flex-col items-center justify-center p-10 text-center">
                    <FiLayers className="w-8 text-[var(--ink-4)]" aria-hidden />

                    <p className="mt-3 font-display text-base text-[var(--ink)]">
                        Nenhuma pergunta cadastrada
                    </p>

                    <p className="mt-1 max-w-md text-sm text-[var(--ink-2)]">
                        Uma pergunta é o que o cliente responde ao pedir: a borda da pizza, o
                        ponto da carne, o tamanho do copo. Monte aqui e ligue aos produtos na
                        ficha de cada um.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {grupos.map((grupo) => (
                        <section key={grupo.id} className="card p-0">

                            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--linha-suave)] px-4 py-3">
                                <div className="min-w-0">
                                    <p className="font-semibold text-[var(--ink)]">{grupo.nome}</p>

                                    <p className="text-xs text-[var(--ink-2)]">
                                        {comoFunciona(grupo.minimo, grupo.maximo)}
                                        {" · "}
                                        {produtosPorGrupo[grupo.id]
                                            ? `${produtosPorGrupo[grupo.id]} produto(s)`
                                            : "nenhum produto ainda"}
                                    </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => abrirGrupo(grupo)}
                                        className="btn btn-neutro"
                                    >
                                        Editar
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => apagarGrupo(grupo)}
                                        disabled={ocupado}
                                        aria-label={`Excluir ${grupo.nome}`}
                                        className="rounded-lg p-2 text-[var(--ink-2)] transition-colors hover:bg-[var(--vermelho-fundo)] hover:text-[var(--vermelho)]"
                                    >
                                        <FiTrash2 className="w-4" aria-hidden />
                                    </button>
                                </div>
                            </header>

                            <ul className="divide-y divide-[var(--fundo)]">
                                {(grupo.opcoes ?? []).map((opcao) => (
                                    <li key={opcao.id} className="flex items-center gap-3 px-4 py-2.5">

                                        {/* Ligar e desligar é o gesto do dia: o
                                            catupiry acaba às oito da noite e volta
                                            amanhã. Por isso é um clique na linha, e
                                            não um campo dentro de um formulário. */}
                                        <button
                                            type="button"
                                            onClick={() => alternarOpcao(opcao.id, opcao.nome, opcao.preco, !opcao.ativa)}
                                            disabled={ocupado}
                                            aria-pressed={opcao.ativa}
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                                opcao.ativa
                                                    ? "border-[var(--azul)] bg-[var(--azul)] text-white"
                                                    : "border-[var(--linha)] text-transparent hover:bg-[var(--fundo)]"
                                            }`}
                                        >
                                            <FiCheck className="w-3" aria-hidden />
                                        </button>

                                        <span className={`min-w-0 flex-1 truncate text-sm ${opcao.ativa ? "text-[var(--ink)]" : "text-[var(--ink-3)] line-through"}`}>
                                            {opcao.nome}
                                        </span>

                                        <span className="num shrink-0 text-sm text-[var(--ink-2)]">
                                            {opcao.preco > 0 ? `+ ${formatarMoeda(opcao.preco)}` : "sem custo"}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => apagarOpcao(opcao.id)}
                                            disabled={ocupado}
                                            aria-label={`Excluir ${opcao.nome}`}
                                            className="shrink-0 rounded-lg p-1.5 text-[var(--ink-2)] transition-colors hover:bg-[var(--vermelho-fundo)] hover:text-[var(--vermelho)]"
                                        >
                                            <FiTrash2 className="w-3.5" aria-hidden />
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            {/* A linha de acrescentar fica DENTRO do grupo, no fim
                                da lista: é onde o olho está depois de ler as opções
                                que já existem, e é o gesto seguinte. */}
                            <div className="flex flex-wrap items-end gap-2 border-t border-[var(--linha-suave)] px-4 py-3">

                                <div className="min-w-[10rem] flex-1">
                                    <label htmlFor={`opcao-${grupo.id}`} className="rotulo">Nova opção</label>

                                    <input
                                        id={`opcao-${grupo.id}`}
                                        value={novaOpcao[grupo.id]?.nome ?? ""}
                                        onChange={(e) => setNovaOpcao((atual) => ({
                                            ...atual,
                                            [grupo.id]: { nome: e.target.value, preco: atual[grupo.id]?.preco ?? "" },
                                        }))}
                                        maxLength={60}
                                        placeholder="Catupiry"
                                        className="field w-full"
                                    />
                                </div>

                                <div className="w-28">
                                    <label htmlFor={`preco-${grupo.id}`} className="rotulo">Soma R$</label>

                                    <input
                                        id={`preco-${grupo.id}`}
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={novaOpcao[grupo.id]?.preco ?? ""}
                                        onChange={(e) => setNovaOpcao((atual) => ({
                                            ...atual,
                                            [grupo.id]: { nome: atual[grupo.id]?.nome ?? "", preco: e.target.value },
                                        }))}
                                        placeholder="0,00"
                                        className="field num w-full text-right"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => acrescentarOpcao(grupo)}
                                    disabled={ocupado || (novaOpcao[grupo.id]?.nome ?? "").trim() === ""}
                                    className="btn btn-neutro"
                                >
                                    <FiPlus className="w-4" aria-hidden />
                                    <span>Acrescentar</span>
                                </button>
                            </div>
                        </section>
                    ))}
                </div>
            )}

            <p className="text-xs text-[var(--ink-3)]">
                Para dizer quais produtos fazem cada pergunta, abra a ficha do produto em{" "}
                <Link href="/page/produtos" className="font-semibold text-[var(--azul)] hover:underline">
                    Produtos
                </Link>. Uma pergunta montada aqui vale para quantos produtos você ligar a ela.
            </p>

        </Pagina>
    )
}

/**
 * A regra do grupo escrita como gente fala.
 *
 * "Mínimo 1, máximo 1" é preciso e ninguém lê assim. O lojista precisa saber o
 * que vai acontecer na tela do cliente, e é isso que esta frase responde.
 */
function comoFunciona(minimo: number, maximo: number): string {

    if (minimo >= 1 && maximo === 1) return "O cliente PRECISA escolher uma"
    if (minimo >= 1) return `O cliente precisa escolher de ${minimo} a ${maximo}`
    if (maximo === 1) return "O cliente pode escolher uma, ou nenhuma"

    return `O cliente pode escolher até ${maximo}`
}

/** Vírgula vira ponto, e o que não é número vira zero — adicional sem preço é o caso comum. */
function precoDigitado(texto: string): number {

    const numero = Number((texto ?? "").trim().replace(",", "."))

    return Number.isFinite(numero) && numero >= 0 ? numero : 0
}
