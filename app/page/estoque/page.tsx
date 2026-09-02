"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto, Unidade } from "@/app/type/type"
import { listarProdutos, listarTodasUnidades, transferirUnidade, avariarUnidade, excluirUnidade, identificarPeca } from "@/middleware/produtos"
import { listarEnderecos, type EnderecoEstoque } from "@/middleware/estoque"
import { validarTransferencia } from "@/security/validate"
import { ApiError } from "@/middleware/client"
import Pagination from "@/app/components/pagination/pagination"
import Cabecalho from "@/app/components/grade/cabecalho"
import {
    FiSearch,
    FiX,
    FiPlus,
    FiMapPin,
    FiBookmark,
    FiBox,
    FiGrid,
    FiLock,
    FiTrash2,
    FiAlertTriangle,
    FiRepeat,
} from "react-icons/fi"
import { urlDaImagem } from "@/security/imagem"

/**
 * O estoque como grade de operação, no padrão de um WMS (a referência é o
 * Senior WMS): uma linha por peça, na ordem em que se anda pelo corredor.
 *
 * Esta tela já foi uma grade de cartões — um cartão por endereço, cada um com
 * a sua lista de peças e a sua paginação própria. Duas colunas de cartões
 * aninhados respondiam mal justamente a pergunta que se faz aqui: "onde está
 * esta peça?" exigia varrer cartão por cartão, e "quantas peças há na rua 3?"
 * não tinha resposta nenhuma. Paginação por cartão era o pior: a mesma lista
 * quebrada em dez paginações que não conversam entre si.
 *
 * Agora é uma grade só. O endereço vira coluna em vez de moldura, o que
 * permite ordenar por ele (a ordem do corredor), filtrar por situação e
 * contar tudo num rodapé só.
 */

const ITENS_POR_PAGINA = 25

/** Como o servidor descreve a peça que ainda não foi guardada. */
const SEM_LUGAR = "sem lugar definido"

interface CartaoUnidade {
    unidade: Unidade
    produto: Produto | undefined
}

/** Uma linha da grade: a peça, o produto dela e o lugar onde está. */
interface LinhaEstoque extends CartaoUnidade {
    /** Vazio na peça que ainda não foi guardada. */
    codigo: string
    nome: string
    endereco: EnderecoEstoque | undefined
}

/** As colunas por que a grade pode ser ordenada. */
type Coluna = "endereco" | "produto" | "peca" | "tipo"

/** Os recortes da barra de filtro. */
type Recorte = "todas" | "sem_local" | "reservadas" | "bloqueadas"

interface TransferenciaAlvo {
    unidadeId: number
    produtoNome: string
    codigo: string
    enderecoAtual: string
    localAtual: string
}

interface AvariaAlvo {
    unidadeId: number
    produtoNome: string
    codigo: string
}

interface ExclusaoAlvo {
    unidadeId: number
    produtoNome: string
    codigo: string
}

/**
 * A cor de cada tipo de lugar. Discreta de propósito: numa grade de 25 linhas
 * o tipo é o dado menos urgente da linha, e chip colorido em toda linha
 * apagaria o que importa — o endereço e a situação da peça.
 */
const CORES_TIPO: Record<string, string> = {
    picking: "bg-[#E6F3FF] text-[#0075E2]",
    pulmao: "bg-[#F0F3F4] text-[#1E2428]",
    recebimento: "bg-[#F0F3F4] text-[#5A6469]",
    expedicao: "bg-[#F0F3F4] text-[#5A6469]",
    quarentena: "bg-[#FFF6E0] text-[#8A6C1B]",
    avaria: "bg-[#FDECEA] text-[#D4351C]",
}

export default function Estoque() {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [unidades, setUnidades] = useState<Unidade[]>([])
    const [enderecos, setEnderecos] = useState<EnderecoEstoque[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    const [busca, setBusca] = useState("")

    // Uma paginação para a grade inteira. Antes havia uma por endereço, e
    // dez paginações que não conversam entre si são dez chances de a pessoa
    // achar que viu tudo sem ter visto.
    const [paginaAtual, setPaginaAtual] = useState(1)

    const [recorte, setRecorte] = useState<Recorte>("todas")
    const [ordem, setOrdem] = useState<{ coluna: Coluna; desc: boolean }>({
        coluna: "endereco",
        desc: false,
    })

    const [alvo, setAlvo] = useState<TransferenciaAlvo | null>(null)
    const [destinoInput, setDestinoInput] = useState("")
    const [erroTransferencia, setErroTransferencia] = useState("")
    const [transferindo, setTransferindo] = useState(false)

    const [alvoAvaria, setAlvoAvaria] = useState<AvariaAlvo | null>(null)
    const [erroAvaria, setErroAvaria] = useState("")
    const [registrandoAvaria, setRegistrandoAvaria] = useState(false)

    const [alvoExclusao, setAlvoExclusao] = useState<ExclusaoAlvo | null>(null)
    const [erroExclusao, setErroExclusao] = useState("")
    const [excluindo, setExcluindo] = useState(false)

    async function carregar() {

        try {

            // Os endereços vêm junto porque é o cadastro deles que dá a
            // ordem do caminho, o tipo e a capacidade de cada lugar — a peça
            // sozinha só sabe o código onde está.
            const [listaProdutos, listaUnidades, listaEnderecos] = await Promise.all([
                listarProdutos(),
                listarTodasUnidades(),
                listarEnderecos(),
            ])

            setProdutos(listaProdutos)
            setUnidades(listaUnidades)
            setEnderecos(listaEnderecos)

        } catch (error) {

            console.error("Erro ao buscar estoque:", error)

            setErro("Não foi possível carregar o estoque.")

        } finally {

            setLoading(false)

        }
    }

    useEffect(() => {

        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()

    }, [])

    const produtosPorId = useMemo(() => {
        const mapa = new Map<number, Produto>()
        for (const produto of produtos) mapa.set(produto.id, produto)
        return mapa
    }, [produtos])


    // ==============================
    // AS LINHAS — uma por peça, com o lugar em que ela está
    // ==============================

    const enderecosPorId = useMemo(() => {
        const mapa = new Map<number, EnderecoEstoque>()
        for (const endereco of enderecos) mapa.set(endereco.id, endereco)
        return mapa
    }, [enderecos])

    const linhas = useMemo(() => {

        return unidades
            .filter((unidade) => !unidade.vendida && !unidade.avariada)
            .map<LinhaEstoque>((unidade) => {

                // O cadastro do lugar pode faltar quando a peça aponta para
                // um endereço que não existe mais. O que sobra é o código
                // escrito na própria peça, que ainda diz onde ela está.
                const endereco = unidade.endereco_id
                    ? enderecosPorId.get(unidade.endereco_id)
                    : undefined

                return {
                    unidade,
                    produto: produtosPorId.get(unidade.produto_id),
                    codigo: unidade.endereco,
                    nome: endereco?.nome ?? unidade.endereco_nome,
                    endereco,
                }
            })

    }, [unidades, produtosPorId, enderecosPorId])


    // ==============================
    // BUSCA, FILTRO E ORDEM
    // ==============================

    const termoBusca = busca.trim().toLowerCase()

    function codigoDaPeca(linha: LinhaEstoque): string {
        return identificarPeca(linha.produto?.codigo, linha.unidade.sequencia)
    }

    function cabeNoRecorte(linha: LinhaEstoque): boolean {

        switch (recorte) {

            case "sem_local":
                return !linha.codigo

            case "reservadas":
                return linha.unidade.reservada === true

            case "bloqueadas":
                return linha.endereco?.bloqueado === true

            default:
                return true
        }
    }

    const linhasFiltradas = useMemo(() => {

        const filtradas = linhas.filter((linha) => {

            if (!cabeNoRecorte(linha)) return false

            if (!termoBusca) return true

            return (
                (linha.produto?.nome.toLowerCase() ?? "").includes(termoBusca) ||
                (linha.produto?.codigo ?? "").toLowerCase().includes(termoBusca) ||
                linha.codigo.toLowerCase().includes(termoBusca) ||
                linha.nome.toLowerCase().includes(termoBusca)
            )
        })

        // A peça sem lugar vai para o fim de qualquer ordenação por endereço:
        // ela não está em lugar nenhum do corredor, e intercalá-la entre as
        // prateleiras quebraria a ordem que quem separa segue.
        const ordemDoLugar = (linha: LinhaEstoque) =>
            linha.codigo ? (linha.endereco?.ordem ?? 0) : Number.MAX_SAFE_INTEGER

        const comparar = (a: LinhaEstoque, b: LinhaEstoque) => {

            switch (ordem.coluna) {

                case "produto":
                    return (a.produto?.nome ?? "").localeCompare(b.produto?.nome ?? "", "pt-BR")

                case "peca":
                    return codigoDaPeca(a).localeCompare(codigoDaPeca(b), "pt-BR")

                case "tipo":
                    return (a.endereco?.tipo_nome ?? "").localeCompare(b.endereco?.tipo_nome ?? "", "pt-BR")

                default: {
                    const lugarA = ordemDoLugar(a)
                    const lugarB = ordemDoLugar(b)

                    if (lugarA !== lugarB) return lugarA - lugarB

                    // Mesmo lugar (ou os dois sem lugar): o código do endereço
                    // desempata, e depois o produto — para as peças iguais
                    // ficarem juntas na tela.
                    if (a.codigo !== b.codigo) return a.codigo.localeCompare(b.codigo, "pt-BR")

                    return (a.produto?.nome ?? "").localeCompare(b.produto?.nome ?? "", "pt-BR")
                }
            }
        }

        return filtradas.sort((a, b) => (ordem.desc ? -comparar(a, b) : comparar(a, b)))

        // eslint-disable-next-line react-hooks/exhaustive-deps -- as funções acima são puras e só dependem de `recorte`
    }, [linhas, termoBusca, recorte, ordem])


    // ==============================
    // PAGINAÇÃO
    // ==============================

    const totalPaginas = Math.max(1, Math.ceil(linhasFiltradas.length / ITENS_POR_PAGINA))
    const paginaAtualCorrigida = Math.min(paginaAtual, totalPaginas)

    const primeiraDaPagina = (paginaAtualCorrigida - 1) * ITENS_POR_PAGINA

    const linhasDaPagina = linhasFiltradas.slice(
        primeiraDaPagina,
        primeiraDaPagina + ITENS_POR_PAGINA
    )

    function aoMudarBusca(valor: string) {
        setBusca(valor)
        setPaginaAtual(1)
    }

    function aoMudarRecorte(valor: Recorte) {
        setRecorte(valor)
        setPaginaAtual(1)
    }

    function ordenarPor(coluna: Coluna) {

        setOrdem((atual) =>
            atual.coluna === coluna
                ? { coluna, desc: !atual.desc }
                : { coluna, desc: false }
        )

        setPaginaAtual(1)
    }


    // ==============================
    // ESTATÍSTICAS
    // ==============================

    const totalPecas = linhas.length

    const totalSemLocal = linhas.filter((linha) => !linha.codigo).length

    // Quantos lugares diferentes guardam alguma coisa hoje.
    const locaisOcupados = new Set(
        linhas.filter((linha) => linha.codigo).map((linha) => linha.codigo)
    ).size

    // Peça que existe, mas já tem dono: está reservada para um pedido e não
    // deveria ser vendida no balcão nem transferida sem querer.
    const totalReservadas = linhas.filter((linha) => linha.unidade.reservada).length

    const totalBloqueadas = linhas.filter((linha) => linha.endereco?.bloqueado).length

    /** Os recortes da barra de filtro, já com a contagem de cada um. */
    const recortes: { chave: Recorte; nome: string; total: number }[] = [
        { chave: "todas", nome: "Todas", total: totalPecas },
        { chave: "sem_local", nome: "Sem local", total: totalSemLocal },
        { chave: "reservadas", nome: "Reservadas", total: totalReservadas },
        { chave: "bloqueadas", nome: "Em lugar bloqueado", total: totalBloqueadas },
    ]


    // ==============================
    // TRANSFERÊNCIA
    // ==============================

    // Para onde dá para mandar a peça: os endereços liberados, menos aquele
    // em que ela já está. Endereço bloqueado fica de fora porque o servidor o
    // recusaria de qualquer jeito — oferecê-lo seria prometer o que não vai
    // acontecer.
    const enderecosDisponiveis = useMemo(
        () => enderecos.filter((endereco) => !endereco.bloqueado && endereco.codigo !== alvo?.enderecoAtual),
        [enderecos, alvo]
    )

    function abrirTransferencia(item: CartaoUnidade) {
        setAlvo({
            unidadeId: item.unidade.id,
            produtoNome: item.produto?.nome ?? `Produto #${item.unidade.produto_id}`,
            codigo: identificarPeca(item.produto?.codigo, item.unidade.sequencia),
            enderecoAtual: item.unidade.endereco,
            localAtual: item.unidade.endereco || item.unidade.endereco_nome || SEM_LUGAR,
        })
        setDestinoInput("")
        setErroTransferencia("")
    }

    function fecharTransferencia() {
        setAlvo(null)
        setErroTransferencia("")
    }

    async function confirmarTransferencia() {

        if (!alvo) return

        const destino = destinoInput.trim()

        const erros = validarTransferencia({ destino })

        if (destino && destino === alvo.enderecoAtual) {
            erros.push("A peça já está neste endereço.")
        }

        if (erros.length > 0) {
            setErroTransferencia(erros[0])
            return
        }

        try {

            setTransferindo(true)

            // Se o endereço aceita mercadoria, não está bloqueado e ainda
            // cabe, quem responde é o servidor — a tela mostra o que ele
            // disser em vez de tentar adivinhar antes.
            await transferirUnidade(alvo.unidadeId, destino)

            fecharTransferencia()

            await carregar()

        } catch (error) {

            console.error("Erro ao transferir unidade:", error)

            setErroTransferencia(
                error instanceof ApiError ? error.message : "Não foi possível transferir a unidade."
            )

        } finally {

            setTransferindo(false)

        }
    }


    // ==============================
    // AVARIA
    // ==============================

    function abrirAvaria(item: CartaoUnidade) {
        setAlvoAvaria({
            unidadeId: item.unidade.id,
            produtoNome: item.produto?.nome ?? `Produto #${item.unidade.produto_id}`,
            codigo: identificarPeca(item.produto?.codigo, item.unidade.sequencia),
        })
        setErroAvaria("")
    }

    function fecharAvaria() {
        setAlvoAvaria(null)
        setErroAvaria("")
    }

    async function confirmarAvaria() {

        if (!alvoAvaria) return

        try {

            setRegistrandoAvaria(true)
            setErroAvaria("")

            await avariarUnidade(alvoAvaria.unidadeId)

            fecharAvaria()

            await carregar()

        } catch (error) {

            console.error("Erro ao registrar avaria:", error)

            setErroAvaria(
                error instanceof ApiError ? error.message : "Não foi possível registrar a avaria."
            )

        } finally {

            setRegistrandoAvaria(false)

        }
    }


    // ==============================
    // EXCLUSÃO
    // ==============================

    function abrirExclusao(item: CartaoUnidade) {
        setAlvoExclusao({
            unidadeId: item.unidade.id,
            produtoNome: item.produto?.nome ?? `Produto #${item.unidade.produto_id}`,
            codigo: identificarPeca(item.produto?.codigo, item.unidade.sequencia),
        })
        setErroExclusao("")
    }

    function fecharExclusao() {
        setAlvoExclusao(null)
        setErroExclusao("")
    }

    async function confirmarExclusao() {

        if (!alvoExclusao) return

        try {

            setExcluindo(true)
            setErroExclusao("")

            await excluirUnidade(alvoExclusao.unidadeId)

            fecharExclusao()

            await carregar()

        } catch (error) {

            console.error("Erro ao excluir unidade:", error)

            setErroExclusao(
                error instanceof ApiError ? error.message : "Não foi possível excluir a unidade."
            )

        } finally {

            setExcluindo(false)

        }
    }


    // ==============================
    // LOADING
    // ==============================

    if (loading) {

        return (

            <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">

                <div className="mx-auto max-w-7xl">

                    <div className="h-9 w-64 animate-pulse rounded-lg bg-[#D3DADD]" />

                    <div className="mt-3 h-4 w-80 animate-pulse rounded bg-[#D3DADD]" />

                    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">

                        {[1, 2, 3, 4].map(item => (

                            <div
                                key={item}
                                className="card h-28 animate-pulse"
                            />

                        ))}

                    </div>

                    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">

                        {[1, 2, 3, 4, 5, 6].map(item => (

                            <div
                                key={item}
                                className="card h-48 animate-pulse"
                            />

                        ))}

                    </div>

                </div>

            </main>

        )
    }


    // ==============================
    // ERRO
    // ==============================

    if (erro) {

        return (

            <main className="min-h-screen bg-[#F0F3F4] p-8 md:ml-64">

                <div className="card mx-auto max-w-xl p-10 text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FDECEA] text-[#D4351C]">
                        <FiAlertTriangle className="w-7" aria-hidden />
                    </div>

                    <h1 className="font-display mt-5 text-2xl text-[#1E2428]">
                        Erro ao carregar estoque
                    </h1>

                    <p className="mt-2 text-[#5A6469]">
                        {erro}
                    </p>

                    <button
                        onClick={() => window.location.reload()}
                        className="btn btn-primario mt-6"
                    >
                        Tentar novamente
                    </button>

                </div>

            </main>

        )
    }


    // ==============================
    // PÁGINA
    // ==============================

    return (

        <>

        <main className="min-h-screen bg-[#F0F3F4] text-[#1E2428] md:ml-64">

            {/* ==========================
                HEADER
            ========================== */}

            <header className="sticky top-16 z-30 border-b border-[#D3DADD] bg-[#F0F3F4]/95 backdrop-blur md:top-0">

                <div className="flex min-h-20 items-center justify-between gap-6 px-6 md:px-10">

                    <div>

                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#8C969B]">
                            Painel administrativo
                        </p>

                        <h1 className="font-display text-2xl text-[#1E2428]">
                            Estoque
                        </h1>

                    </div>

                </div>

            </header>


            {/* ==========================
                CONTEÚDO
            ========================== */}

            <div className="p-6 md:p-10">

                <div className="mx-auto max-w-7xl">

                    {/* INTRODUÇÃO */}

                    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                        <div>

                            <h2 className="font-display text-3xl tracking-tight text-[#1E2428] sm:text-4xl">
                                Onde cada peça está guardada
                            </h2>

                            <p className="mt-2 max-w-md text-[#5A6469]">
                                Mapa dos endereços do estoque, peça por peça, na ordem em que se anda pelo
                                corredor. Transfira ou marque avaria individualmente.
                            </p>

                        </div>

                        <Link
                            href="/page/avarias"
                            className="btn btn-neutro shrink-0"
                        >
                            <FiAlertTriangle className="w-4" aria-hidden />
                            <span>Ver avarias</span>
                        </Link>

                    </div>


                    {/* ==========================
                        RESUMO
                    ========================== */}

                    <div className="card grid grid-cols-2 divide-[#E4E9EB] md:grid-cols-4 md:divide-x">

                        <div className="flex items-center gap-3 border-b border-[#E4E9EB] p-4 md:border-b-0">

                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E6F3FF] text-[#0086FF]">
                                <FiBox className="w-4" aria-hidden />
                            </span>

                            <span className="min-w-0">
                                <span className="block text-xs text-[#5A6469]">Peças em estoque</span>
                                <span className="num block text-xl font-extrabold text-[#1E2428]">{totalPecas}</span>
                            </span>

                        </div>

                        <div className="flex items-center gap-3 border-b border-[#E4E9EB] p-4 md:border-b-0">

                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E6F3FF] text-[#0086FF]">
                                <FiGrid className="w-4" aria-hidden />
                            </span>

                            <span className="min-w-0">
                                <span className="block text-xs text-[#5A6469]">Endereços ocupados</span>
                                <span className="num block text-xl font-extrabold text-[#1E2428]">{locaisOcupados}</span>
                            </span>

                        </div>

                        <div className="flex items-center gap-3 p-4">

                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E6F3FF] text-[#0086FF]">
                                <FiBookmark className="w-4" aria-hidden />
                            </span>

                            <span className="min-w-0">
                                <span className="block text-xs text-[#5A6469]">Reservadas</span>
                                <span className="num block text-xl font-extrabold text-[#1E2428]">{totalReservadas}</span>
                            </span>

                        </div>

                        <div className="flex items-center gap-3 p-4">

                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                totalSemLocal > 0 ? "bg-[#FFF6E0] text-[#8A6C1B]" : "bg-[#F0F3F4] text-[#5A6469]"
                            }`}>
                                <FiAlertTriangle className="w-4" aria-hidden />
                            </span>

                            <span className="min-w-0">
                                <span className="block text-xs text-[#5A6469]">Sem local</span>
                                <span className={`num block text-xl font-extrabold ${
                                    totalSemLocal > 0 ? "text-[#8A6C1B]" : "text-[#1E2428]"
                                }`}>
                                    {totalSemLocal}
                                </span>
                            </span>

                        </div>

                    </div>


                    {/* Peça que chegou e ninguém guardou é trabalho parado, e
                        por isso o aviso fica acima da grade em vez de virar
                        mais uma linha dentro dela. O botão leva ao recorte,
                        que é o que a pessoa vai fazer em seguida. */}
                    {totalSemLocal > 0 && recorte !== "sem_local" && (

                        <div className="mt-6 flex flex-col gap-3 rounded-lg border-l-4 border-[#FFB800] bg-[#FFF6E0] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

                            <p className="flex items-center gap-2.5 text-sm text-[#5A6469]">
                                <FiAlertTriangle className="w-4 shrink-0 text-[#8A6C1B]" aria-hidden />
                                <span>
                                    <span className="num font-bold text-[#1E2428]">{totalSemLocal}</span>{" "}
                                    peça(s) chegaram e ainda não foram guardadas em nenhum endereço.
                                </span>
                            </p>

                            <button
                                type="button"
                                onClick={() => aoMudarRecorte("sem_local")}
                                className="btn btn-neutro shrink-0 text-sm"
                            >
                                Ver só essas
                            </button>

                        </div>

                    )}


                    {/* ==========================
                        BARRA DA GRADE
                    ========================== */}

                    <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar peças">

                            {recortes.map(({ chave, nome, total }) => {

                                const ativo = chave === recorte

                                return (
                                    <button
                                        key={chave}
                                        type="button"
                                        aria-pressed={ativo}
                                        onClick={() => aoMudarRecorte(chave)}
                                        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors ${
                                            ativo
                                                ? "border-[#0086FF] bg-[#E6F3FF] text-[#0075E2]"
                                                : "border-[#D3DADD] bg-white text-[#5A6469] hover:border-[#8C969B] hover:text-[#1E2428]"
                                        }`}
                                    >
                                        {nome}

                                        <span className={`num text-xs font-extrabold ${ativo ? "text-[#0086FF]" : "text-[#8C969B]"}`}>
                                            {total}
                                        </span>
                                    </button>
                                )
                            })}

                        </div>

                        <div className="relative w-full lg:w-80">

                            <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8C969B]" aria-hidden />

                            <input
                                type="text"
                                value={busca}
                                onChange={(e) => aoMudarBusca(e.target.value)}
                                placeholder="Buscar por produto, código ou endereço"
                                className="field"
                                style={{ paddingLeft: "2.25rem", paddingRight: busca ? "2.25rem" : undefined }}
                            />

                            {busca && (
                                <button
                                    type="button"
                                    onClick={() => aoMudarBusca("")}
                                    aria-label="Limpar busca"
                                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                                >
                                    <FiX className="w-4" aria-hidden />
                                </button>
                            )}

                        </div>

                    </div>


                    {/* ==========================
                        A GRADE
                    ========================== */}

                    {totalPecas === 0 ? (

                        <div className="mt-6 rounded-lg border border-dashed border-[#D3DADD] bg-white p-16 text-center">

                            <FiMapPin className="mx-auto w-10 text-[#8C969B]" aria-hidden />

                            <h3 className="font-display mt-5 text-xl text-[#1E2428]">
                                Nenhuma peça guardada ainda
                            </h3>

                            <p className="mt-2 text-sm text-[#5A6469]">
                                {enderecos.length === 0
                                    ? "Cadastre os endereços do seu estoque: é por eles que o sistema decide sozinho onde guardar o que entra."
                                    : "Cadastre um produto ou dê entrada numa remessa — o sistema escolhe o endereço."}
                            </p>

                            <div className="mt-6 flex flex-wrap justify-center gap-3">

                                {enderecos.length === 0 ? (
                                    <Link href="/page/estoque/enderecos" className="btn btn-primario">
                                        <FiMapPin className="w-4" aria-hidden />
                                        <span>Cadastrar endereços</span>
                                    </Link>
                                ) : (
                                    <Link href="/page/produto" className="btn btn-primario">
                                        <FiPlus className="w-4" aria-hidden />
                                        <span>Cadastrar produto</span>
                                    </Link>
                                )}

                            </div>

                        </div>

                    ) : linhasFiltradas.length === 0 ? (

                        <div className="mt-6 rounded-lg border border-dashed border-[#D3DADD] bg-white p-16 text-center">

                            <FiSearch className="mx-auto w-10 text-[#8C969B]" aria-hidden />

                            <h3 className="font-display mt-5 text-xl text-[#1E2428]">
                                Nenhuma peça corresponde ao filtro
                            </h3>

                            <button
                                type="button"
                                onClick={() => { aoMudarBusca(""); aoMudarRecorte("todas") }}
                                className="btn btn-neutro mt-6"
                            >
                                Limpar filtros
                            </button>

                        </div>

                    ) : (

                        <div className="card mt-6 overflow-hidden">

                            <div className="overflow-x-auto">

                                <table className="w-full min-w-[56rem] border-collapse text-sm">

                                    <thead>
                                        <tr className="border-b border-[#D3DADD] bg-[#F7F9FA] text-left">

                                            <th scope="col" className="px-4 py-2.5">
                                                <Cabecalho
                                                    ativa={ordem.coluna === "endereco"}
                                                    desc={ordem.desc}
                                                    aoClicar={() => ordenarPor("endereco")}
                                                >
                                                    Endereço
                                                </Cabecalho>
                                            </th>

                                            <th scope="col" className="hidden px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469] xl:table-cell">
                                                Lugar
                                            </th>

                                            <th scope="col" className="px-4 py-2.5">
                                                <Cabecalho
                                                    ativa={ordem.coluna === "produto"}
                                                    desc={ordem.desc}
                                                    aoClicar={() => ordenarPor("produto")}
                                                >
                                                    Produto
                                                </Cabecalho>
                                            </th>

                                            <th scope="col" className="px-4 py-2.5">
                                                <Cabecalho
                                                    ativa={ordem.coluna === "peca"}
                                                    desc={ordem.desc}
                                                    aoClicar={() => ordenarPor("peca")}
                                                >
                                                    Peça
                                                </Cabecalho>
                                            </th>

                                            <th scope="col" className="hidden px-4 py-2.5 lg:table-cell">
                                                <Cabecalho
                                                    ativa={ordem.coluna === "tipo"}
                                                    desc={ordem.desc}
                                                    aoClicar={() => ordenarPor("tipo")}
                                                >
                                                    Tipo
                                                </Cabecalho>
                                            </th>

                                            <th scope="col" className="px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469]">
                                                Situação
                                            </th>

                                            <th scope="col" className="px-4 py-2.5 text-right text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469]">
                                                Ações
                                            </th>

                                        </tr>
                                    </thead>

                                    <tbody>

                                        {linhasDaPagina.map((linha) => {

                                            const { unidade, produto, endereco } = linha
                                            const tipo = endereco?.tipo ?? ""

                                            return (

                                                <tr
                                                    key={unidade.id}
                                                    className="border-b border-[#E4E9EB] transition-colors last:border-b-0 hover:bg-[#F7F9FA]"
                                                >

                                                    {/* ENDEREÇO — a primeira
                                                        coluna porque é a
                                                        primeira pergunta: para
                                                        onde eu ando. */}
                                                    <td className="px-4 py-2.5">
                                                        {linha.codigo ? (
                                                            <span className="font-mono text-xs font-bold text-[#1E2428]">
                                                                {linha.codigo}
                                                            </span>
                                                        ) : (
                                                            <span className="tag tag-warning">
                                                                <FiAlertTriangle className="w-3" aria-hidden />
                                                                Sem local
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* LUGAR */}
                                                    <td className="hidden max-w-[14rem] truncate px-4 py-2.5 text-xs text-[#5A6469] xl:table-cell">
                                                        {linha.codigo ? linha.nome : SEM_LUGAR}
                                                    </td>

                                                    {/* PRODUTO */}
                                                    <td className="px-4 py-2.5">

                                                        <div className="flex items-center gap-3">

                                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#F0F3F4]">
                                                                {produto?.imagem_url ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img
                                                                        src={urlDaImagem(produto.imagem_url)}
                                                                        alt=""
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <FiBox className="w-4 text-[#8C969B]" aria-hidden />
                                                                )}
                                                            </div>

                                                            <div className="min-w-0">

                                                                <p className="truncate font-bold text-[#1E2428]">
                                                                    {produto?.nome ?? `Produto #${unidade.produto_id}`}
                                                                </p>

                                                                {produto?.variacao && (
                                                                    <p className="truncate text-xs text-[#5A6469]">
                                                                        {produto.variacao_rotulo || "Variação"}: {produto.variacao}
                                                                    </p>
                                                                )}

                                                            </div>

                                                        </div>

                                                    </td>

                                                    {/* PEÇA */}
                                                    <td className="px-4 py-2.5 font-mono text-xs text-[#5A6469]">
                                                        {identificarPeca(produto?.codigo, unidade.sequencia)}
                                                    </td>

                                                    {/* TIPO DO LUGAR */}
                                                    <td className="hidden px-4 py-2.5 lg:table-cell">
                                                        {endereco ? (
                                                            <span className={`tag ${CORES_TIPO[tipo] ?? "bg-[#F0F3F4] text-[#5A6469]"}`}>
                                                                {endereco.tipo_nome}
                                                            </span>
                                                        ) : linha.codigo ? (
                                                            <span className="tag tag-neutral">fora do cadastro</span>
                                                        ) : (
                                                            <span className="text-[#8C969B]">—</span>
                                                        )}
                                                    </td>

                                                    {/* SITUAÇÃO */}
                                                    <td className="px-4 py-2.5">

                                                        <div className="flex flex-wrap items-center gap-1.5">

                                                            {unidade.reservada ? (
                                                                <span className="tag tag-info">
                                                                    <FiBookmark className="w-3" aria-hidden />
                                                                    Reservada
                                                                </span>
                                                            ) : (
                                                                <span className="tag tag-success">Livre</span>
                                                            )}

                                                            {endereco?.bloqueado && (
                                                                <span className="tag tag-warning">
                                                                    <FiLock className="w-3" aria-hidden />
                                                                    Bloqueado
                                                                </span>
                                                            )}

                                                        </div>

                                                    </td>

                                                    {/* AÇÕES */}
                                                    <td className="px-4 py-2.5">

                                                        <div className="flex items-center justify-end gap-1">

                                                            <button
                                                                type="button"
                                                                title="Transferir de lugar"
                                                                aria-label={`Transferir ${produto?.nome ?? "peça"}`}
                                                                onClick={() => abrirTransferencia(linha)}
                                                                className="flex h-8 w-8 items-center justify-center rounded-md text-[#5A6469] transition-colors hover:bg-[#F0F3F4] hover:text-[#0075E2]"
                                                            >
                                                                <FiRepeat className="w-4" aria-hidden />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                title="Marcar avaria"
                                                                aria-label={`Avariar ${produto?.nome ?? "peça"}`}
                                                                onClick={() => abrirAvaria(linha)}
                                                                className="flex h-8 w-8 items-center justify-center rounded-md text-[#5A6469] transition-colors hover:bg-[#FDECEA] hover:text-[#D4351C]"
                                                            >
                                                                <FiAlertTriangle className="w-4" aria-hidden />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                title="Excluir peça"
                                                                aria-label={`Excluir ${produto?.nome ?? "peça"}`}
                                                                onClick={() => abrirExclusao(linha)}
                                                                className="flex h-8 w-8 items-center justify-center rounded-md text-[#5A6469] transition-colors hover:bg-[#FDECEA] hover:text-[#D4351C]"
                                                            >
                                                                <FiTrash2 className="w-4" aria-hidden />
                                                            </button>

                                                        </div>

                                                    </td>

                                                </tr>
                                            )
                                        })}

                                    </tbody>

                                </table>

                            </div>

                            <div className="flex flex-col gap-3 border-t border-[#D3DADD] bg-[#F7F9FA] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

                                <p className="text-xs text-[#5A6469]">
                                    Mostrando{" "}
                                    <span className="num font-bold text-[#1E2428]">
                                        {primeiraDaPagina + 1}–{primeiraDaPagina + linhasDaPagina.length}
                                    </span>{" "}
                                    de <span className="num font-bold text-[#1E2428]">{linhasFiltradas.length}</span>
                                    {linhasFiltradas.length !== totalPecas && (
                                        <> · <span className="num">{totalPecas}</span> no total</>
                                    )}
                                </p>

                                <Pagination
                                    paginaAtual={paginaAtualCorrigida}
                                    totalPaginas={totalPaginas}
                                    aoMudarPagina={setPaginaAtual}
                                />

                            </div>

                        </div>

                    )}

                </div>

            </div>

        </main>


        {/* ==========================
            MODAL DE TRANSFERÊNCIA
        ========================== */}

        {alvo && (

            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={fecharTransferencia}
            >

                <div className="absolute inset-0 bg-[#1E2428]/50" />

                <div
                    onClick={(e) => e.stopPropagation()}
                    className="card relative w-full max-w-md p-6"
                >

                    <button
                        type="button"
                        onClick={fecharTransferencia}
                        aria-label="Fechar"
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                    >
                        <FiX className="w-4" aria-hidden />
                    </button>

                    <div className="flex items-center gap-2 pr-8">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E6F3FF] text-[#0086FF]">
                            <FiRepeat className="w-3.5" aria-hidden />
                        </span>
                        <h2 className="font-display truncate text-lg text-[#1E2428]">
                            Transferir {alvo.produtoNome}
                        </h2>
                    </div>

                    <p className="mt-2 font-mono text-xs text-[#5A6469]">
                        {alvo.codigo}
                    </p>

                    <p className="mt-2 text-sm text-[#5A6469]">
                        De <span className="num font-medium text-[#1E2428]">
                            {alvo.localAtual}
                        </span>
                    </p>

                    <div className="mt-5 space-y-1.5">

                        <label className="rotulo" htmlFor="destino">
                            Endereço de destino
                        </label>

                        {enderecosDisponiveis.length === 0 ? (

                            <p className="rounded-lg bg-[#FFF6E0] px-4 py-3 text-sm text-[#8A6C1B]">
                                Não há endereço liberado para receber esta peça.{" "}
                                <Link href="/page/estoque/enderecos" className="font-bold underline">
                                    Cadastre um endereço
                                </Link>{" "}
                                ou libere um dos que estão bloqueados.
                            </p>

                        ) : (

                            <select
                                id="destino"
                                autoFocus
                                value={destinoInput}
                                onChange={(e) => setDestinoInput(e.target.value)}
                                className="field cursor-pointer"
                            >
                                <option value="">Selecione...</option>

                                {enderecosDisponiveis.map((endereco) => (
                                    <option key={endereco.id} value={endereco.codigo}>
                                        {endereco.codigo} · {endereco.nome} ({endereco.tipo_nome})
                                        {endereco.capacidade > 0 ? ` — cabem ${endereco.livre ?? 0}` : ""}
                                    </option>
                                ))}

                            </select>

                        )}

                        <p className="text-xs text-[#5A6469]">
                            Só aparecem os endereços liberados. Se o escolhido não couber mais a
                            peça, quem avisa é o servidor, que tem a ocupação na frente.
                        </p>

                    </div>

                    {erroTransferencia && (
                        <div className="mt-4 rounded-lg bg-[#FDECEA] px-4 py-2.5 text-sm font-semibold text-[#D4351C]">
                            {erroTransferencia}
                        </div>
                    )}

                    <div className="mt-6 flex gap-2">

                        <button
                            type="button"
                            onClick={fecharTransferencia}
                            disabled={transferindo}
                            className="btn btn-neutro flex-1"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={confirmarTransferencia}
                            disabled={transferindo}
                            className="btn btn-primario flex-1"
                        >
                            {transferindo ? "Transferindo..." : "Transferir"}
                        </button>

                    </div>

                </div>

            </div>

        )}


        {/* ==========================
            MODAL DE AVARIA
        ========================== */}

        {alvoAvaria && (

            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={fecharAvaria}
            >

                <div className="absolute inset-0 bg-[#1E2428]/50" />

                <div
                    onClick={(e) => e.stopPropagation()}
                    className="card relative w-full max-w-md p-6"
                >

                    <button
                        type="button"
                        onClick={fecharAvaria}
                        aria-label="Fechar"
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                    >
                        <FiX className="w-4" aria-hidden />
                    </button>

                    <div className="flex items-center gap-2 pr-8">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FDECEA] text-[#D4351C]">
                            <FiAlertTriangle className="w-3.5" aria-hidden />
                        </span>
                        <h2 className="font-display truncate text-lg text-[#1E2428]">
                            Registrar avaria
                        </h2>
                    </div>

                    <p className="mt-3 text-sm text-[#1E2428]">
                        {alvoAvaria.produtoNome}
                    </p>

                    <p className="mt-1 font-mono text-xs text-[#5A6469]">
                        {alvoAvaria.codigo}
                    </p>

                    <p className="mt-3 text-sm text-[#5A6469]">
                        Essa unidade sai do estoque vendável. Dá pra restaurar depois em &ldquo;Ver avarias&rdquo; se for engano.
                    </p>

                    {erroAvaria && (
                        <div className="mt-4 rounded-lg bg-[#FDECEA] px-4 py-2.5 text-sm font-semibold text-[#D4351C]">
                            {erroAvaria}
                        </div>
                    )}

                    <div className="mt-6 flex gap-2">

                        <button
                            type="button"
                            onClick={fecharAvaria}
                            disabled={registrandoAvaria}
                            className="btn btn-neutro flex-1"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={confirmarAvaria}
                            disabled={registrandoAvaria}
                            className="btn btn-perigo flex-1"
                        >
                            {registrandoAvaria ? "Registrando..." : "Registrar avaria"}
                        </button>

                    </div>

                </div>

            </div>

        )}


        {/* ==========================
            MODAL DE EXCLUSÃO
        ========================== */}

        {alvoExclusao && (

            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={fecharExclusao}
            >

                <div className="absolute inset-0 bg-[#1E2428]/50" />

                <div
                    onClick={(e) => e.stopPropagation()}
                    className="card relative w-full max-w-md p-6"
                >

                    <button
                        type="button"
                        onClick={fecharExclusao}
                        aria-label="Fechar"
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                    >
                        <FiX className="w-4" aria-hidden />
                    </button>

                    <div className="flex items-center gap-2 pr-8">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FDECEA] text-[#D4351C]">
                            <FiTrash2 className="w-3.5" aria-hidden />
                        </span>
                        <h2 className="font-display truncate text-lg text-[#1E2428]">
                            Excluir unidade
                        </h2>
                    </div>

                    <p className="mt-3 text-sm text-[#1E2428]">
                        {alvoExclusao.produtoNome}
                    </p>

                    <p className="mt-1 font-mono text-xs text-[#5A6469]">
                        {alvoExclusao.codigo}
                    </p>

                    <p className="mt-3 text-sm text-[#5A6469]">
                        Essa unidade é removida permanentemente do estoque. Diferente de uma avaria, essa ação não pode ser desfeita.
                    </p>

                    {erroExclusao && (
                        <div className="mt-4 rounded-lg bg-[#FDECEA] px-4 py-2.5 text-sm font-semibold text-[#D4351C]">
                            {erroExclusao}
                        </div>
                    )}

                    <div className="mt-6 flex gap-2">

                        <button
                            type="button"
                            onClick={fecharExclusao}
                            disabled={excluindo}
                            className="btn btn-neutro flex-1"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={confirmarExclusao}
                            disabled={excluindo}
                            className="btn btn-perigo flex-1"
                        >
                            {excluindo ? "Excluindo..." : "Sim, excluir"}
                        </button>

                    </div>

                </div>

            </div>

        )}

        </>

    )
}
