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
import { Pagina, Estado } from "@/app/components/pagina/pagina"
import {
    BarraDaLista,
    FaixaDeNumeros,
    ListaDeRecursos,
    ListaVazia,
    Visoes,
} from "@/app/components/lista/lista"

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
type Coluna = "endereco" | "produto" | "unidade" | "tipo"

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
    picking: "bg-[var(--azul-suave)] text-[var(--azul-escuro)]",
    pulmao: "bg-[var(--fundo)] text-[var(--ink)]",
    recebimento: "bg-[var(--fundo)] text-[var(--ink-2)]",
    expedicao: "bg-[var(--fundo)] text-[var(--ink-2)]",
    quarentena: "bg-[var(--amarelo-fundo)] text-[var(--amarelo)]",
    avaria: "bg-[var(--vermelho-fundo)] text-[var(--vermelho)]",
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

    function codigoDaUnidade(linha: LinhaEstoque): string {
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

                case "unidade":
                    return codigoDaUnidade(a).localeCompare(codigoDaUnidade(b), "pt-BR")

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

    const totalUnidades = linhas.length

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
        { chave: "todas", nome: "Todas", total: totalUnidades },
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
            erros.push("A unidade já está neste endereço.")
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

            <Pagina titulo="Estoque">

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
                    {[1, 2, 3, 4].map(item => (
                        <div key={item} className="card h-28 animate-pulse" />
                    ))}
                </div>

                <div className="space-y-3">
                    {[1, 2, 3, 4].map(item => (
                        <div key={item} className="card h-16 animate-pulse" />
                    ))}
                </div>

            </Pagina>

        )
    }


    // ==============================
    // ERRO
    // ==============================

    if (erro) {

        return (

            <Pagina titulo="Estoque">

                <Estado
                    Icone={FiAlertTriangle}
                    tom="erro"
                    titulo="Erro ao carregar o estoque"
                    texto={erro}
                    acao={
                        <button onClick={() => window.location.reload()} className="btn btn-primario">
                            Tentar novamente
                        </button>
                    }
                />

            </Pagina>

        )
    }


    // ==============================
    // PÁGINA
    // ==============================

    return (

        <>

        <Pagina
            titulo="Estoque"
            descricao="Mapa dos endereços do estoque, unidade por unidade, na ordem em que se anda pelo corredor. Transfira ou marque avaria individualmente."
            acoes={
                <Link href="/page/avarias" className="btn btn-neutro">
                    <FiAlertTriangle className="w-4" aria-hidden />
                    <span>Ver avarias</span>
                </Link>
            }
        >


            {/* ==========================
                RESUMO
                A mesma faixa de números de todas as telas de Estoque (ver
                components/lista/lista.tsx): eram quatro cartões desenhados
                aqui, e outra tela tinha dois retângulos com um "0" gigante.
            ========================== */}

            <FaixaDeNumeros
                numeros={[
                    { rotulo: "Unidades em estoque", valor: totalUnidades, icone: FiBox },
                    { rotulo: "Endereços ocupados", valor: locaisOcupados, icone: FiGrid },
                    { rotulo: "Reservadas", valor: totalReservadas, icone: FiBookmark },
                    {
                        rotulo: "Sem local",
                        valor: totalSemLocal,
                        icone: FiAlertTriangle,
                        alerta: totalSemLocal > 0,
                    },
                ]}
            />

            {/* Unidade que chegou e ninguém guardou é trabalho parado, e o aviso
                leva direto para o recorte que mostra só elas — que é o que a
                pessoa vai fazer em seguida. */}
            {totalSemLocal > 0 && recorte !== "sem_local" && (

                <div className="mt-6 flex flex-col gap-3 rounded-lg border-l-4 border-[var(--amarelo-forte)] bg-[var(--amarelo-fundo)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

                    <p className="flex items-center gap-2.5 text-sm text-[var(--ink-2)]">
                        <FiAlertTriangle className="w-4 shrink-0 text-[var(--amarelo)]" aria-hidden />
                        <span>
                            <span className="num font-bold text-[var(--ink)]">{totalSemLocal}</span>{" "}
                            unidade(s) chegaram e ainda não foram guardadas em nenhum endereço.
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
                A LISTA
                Abas, busca, tabela e rodapé num cartão só — a lista de
                recursos do Shopify Admin (ver components/lista/lista.tsx).
                Os recortes eram botões soltos acima do cartão; dentro dele,
                eles se leem como o que são: modos de ver a mesma tabela.
            ========================== */}

            <ListaDeRecursos>

                <Visoes
                    visoes={recortes.map(({ chave, nome, total }) => ({
                        chave,
                        nome,
                        contagem: total,
                    }))}
                    ativa={recorte}
                    // A lista fala em chaves de texto porque serve qualquer
                    // tela; aqui a chave é um Recorte, e a conversão acontece
                    // nesta linha em vez de afrouxar o tipo da tela inteira.
                    aoTrocar={(chave) => aoMudarRecorte(chave as Recorte)}
                />

                <BarraDaLista
                    busca={busca}
                    aoBuscar={aoMudarBusca}
                    placeholder="Buscar por produto, código ou endereço"
                />



            {/* ==========================
                A GRADE
            ========================== */}

            {totalUnidades === 0 ? (

                <ListaVazia
                    icone={FiMapPin}
                    titulo="Nenhuma unidade guardada ainda"
                    acao={
                        enderecos.length === 0 ? (
                            <Link href="/page/estoque/enderecos" className="btn btn-primario">
                                <FiMapPin className="w-4" aria-hidden />
                                <span>Cadastrar endereços</span>
                            </Link>
                        ) : (
                            <Link href="/page/produto" className="btn btn-primario">
                                <FiPlus className="w-4" aria-hidden />
                                <span>Cadastrar produto</span>
                            </Link>
                        )
                    }
                >
                    {enderecos.length === 0
                        ? "Cadastre os endereços do seu estoque: é por eles que o sistema decide sozinho onde guardar o que entra."
                        : "Cadastre um produto ou dê entrada numa remessa — o sistema escolhe o endereço."}
                </ListaVazia>

            ) : linhasFiltradas.length === 0 ? (

                <ListaVazia
                    icone={FiSearch}
                    titulo="Nenhuma unidade corresponde ao filtro"
                    acao={
                        <button
                            type="button"
                            onClick={() => { aoMudarBusca(""); aoMudarRecorte("todas") }}
                            className="btn btn-neutro"
                        >
                            Limpar filtros
                        </button>
                    }
                />

            ) : (

                <>

                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[56rem] border-collapse text-sm">

                            <thead>
                                <tr className="border-b border-[var(--linha)] bg-[var(--superficie-2)] text-left">

                                    <th scope="col" className="px-4 py-2.5">
                                        <Cabecalho
                                            ativa={ordem.coluna === "endereco"}
                                            desc={ordem.desc}
                                            aoClicar={() => ordenarPor("endereco")}
                                        >
                                            Endereço
                                        </Cabecalho>
                                    </th>

                                    <th scope="col" className="hidden px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--ink-2)] xl:table-cell">
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
                                            ativa={ordem.coluna === "unidade"}
                                            desc={ordem.desc}
                                            aoClicar={() => ordenarPor("unidade")}
                                        >
                                            Unidade
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

                                    <th scope="col" className="px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--ink-2)]">
                                        Situação
                                    </th>

                                    <th scope="col" className="px-4 py-2.5 text-right text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--ink-2)]">
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
                                            className="border-b border-[var(--linha-suave)] transition-colors last:border-b-0 hover:bg-[var(--superficie-2)]"
                                        >

                                            {/* ENDEREÇO — a primeira
                                                coluna porque é a
                                                primeira pergunta: para
                                                onde eu ando. */}
                                            <td className="px-4 py-2.5">
                                                {linha.codigo ? (
                                                    <span className="font-mono text-xs font-bold text-[var(--ink)]">
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
                                            <td className="hidden max-w-[14rem] truncate px-4 py-2.5 text-xs text-[var(--ink-2)] xl:table-cell">
                                                {linha.codigo ? linha.nome : SEM_LUGAR}
                                            </td>

                                            {/* PRODUTO */}
                                            <td className="px-4 py-2.5">

                                                <div className="flex items-center gap-3">

                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--fundo)]">
                                                        {produto?.imagem_url ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={urlDaImagem(produto.imagem_url)}
                                                                alt=""
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <FiBox className="w-4 text-[var(--ink-3)]" aria-hidden />
                                                        )}
                                                    </div>

                                                    <div className="min-w-0">

                                                        <p className="truncate font-bold text-[var(--ink)]">
                                                            {produto?.nome ?? `Produto #${unidade.produto_id}`}
                                                        </p>

                                                        {produto?.variacao && (
                                                            <p className="truncate text-xs text-[var(--ink-2)]">
                                                                {produto.variacao_rotulo || "Variação"}: {produto.variacao}
                                                            </p>
                                                        )}

                                                    </div>

                                                </div>

                                            </td>

                                            {/* PEÇA */}
                                            <td className="px-4 py-2.5 font-mono text-xs text-[var(--ink-2)]">
                                                {identificarPeca(produto?.codigo, unidade.sequencia)}
                                            </td>

                                            {/* TIPO DO LUGAR */}
                                            <td className="hidden px-4 py-2.5 lg:table-cell">
                                                {endereco ? (
                                                    <span className={`tag ${CORES_TIPO[tipo] ?? "bg-[var(--fundo)] text-[var(--ink-2)]"}`}>
                                                        {endereco.tipo_nome}
                                                    </span>
                                                ) : linha.codigo ? (
                                                    <span className="tag tag-neutral">fora do cadastro</span>
                                                ) : (
                                                    <span className="text-[var(--ink-3)]">—</span>
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
                                                        aria-label={`Transferir ${produto?.nome ?? "unidade"}`}
                                                        onClick={() => abrirTransferencia(linha)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)] hover:text-[var(--azul-escuro)]"
                                                    >
                                                        <FiRepeat className="w-4" aria-hidden />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        title="Marcar avaria"
                                                        aria-label={`Avariar ${produto?.nome ?? "unidade"}`}
                                                        onClick={() => abrirAvaria(linha)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink-2)] transition-colors hover:bg-[var(--vermelho-fundo)] hover:text-[var(--vermelho)]"
                                                    >
                                                        <FiAlertTriangle className="w-4" aria-hidden />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        title="Excluir unidade"
                                                        aria-label={`Excluir ${produto?.nome ?? "unidade"}`}
                                                        onClick={() => abrirExclusao(linha)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink-2)] transition-colors hover:bg-[var(--vermelho-fundo)] hover:text-[var(--vermelho)]"
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

                    <div className="flex flex-col gap-3 border-t border-[var(--linha)] bg-[var(--superficie-2)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

                        <p className="text-xs text-[var(--ink-2)]">
                            Mostrando{" "}
                            <span className="num font-bold text-[var(--ink)]">
                                {primeiraDaPagina + 1}–{primeiraDaPagina + linhasDaPagina.length}
                            </span>{" "}
                            de <span className="num font-bold text-[var(--ink)]">{linhasFiltradas.length}</span>
                            {linhasFiltradas.length !== totalUnidades && (
                                <> · <span className="num">{totalUnidades}</span> no total</>
                            )}
                        </p>

                        <Pagination
                            paginaAtual={paginaAtualCorrigida}
                            totalPaginas={totalPaginas}
                            aoMudarPagina={setPaginaAtual}
                        />

                    </div>

                </>

            )}

            </ListaDeRecursos>

        </Pagina>


        {/* ==========================
            MODAL DE TRANSFERÊNCIA
        ========================== */}

        {alvo && (

            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={fecharTransferencia}
            >

                <div className="absolute inset-0 bg-[var(--ink)]/50" />

                <div
                    onClick={(e) => e.stopPropagation()}
                    className="card relative w-full max-w-md p-6"
                >

                    <button
                        type="button"
                        onClick={fecharTransferencia}
                        aria-label="Fechar"
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)]"
                    >
                        <FiX className="w-4" aria-hidden />
                    </button>

                    <div className="flex items-center gap-2 pr-8">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--azul-suave)] text-[var(--azul)]">
                            <FiRepeat className="w-3.5" aria-hidden />
                        </span>
                        <h2 className="font-display truncate text-lg text-[var(--ink)]">
                            Transferir {alvo.produtoNome}
                        </h2>
                    </div>

                    <p className="mt-2 font-mono text-xs text-[var(--ink-2)]">
                        {alvo.codigo}
                    </p>

                    <p className="mt-2 text-sm text-[var(--ink-2)]">
                        De <span className="num font-medium text-[var(--ink)]">
                            {alvo.localAtual}
                        </span>
                    </p>

                    <div className="mt-5 space-y-1.5">

                        <label className="rotulo" htmlFor="destino">
                            Endereço de destino
                        </label>

                        {enderecosDisponiveis.length === 0 ? (

                            <p className="rounded-lg bg-[var(--amarelo-fundo)] px-4 py-3 text-sm text-[var(--amarelo)]">
                                Não há endereço liberado para receber esta unidade.{" "}
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

                        <p className="text-xs text-[var(--ink-2)]">
                            Só aparecem os endereços liberados. Se o escolhido não couber mais a
                            unidade, quem avisa é o servidor, que tem a ocupação na frente.
                        </p>

                    </div>

                    {erroTransferencia && (
                        <div className="mt-4 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-2.5 text-sm font-semibold text-[var(--vermelho)]">
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

                <div className="absolute inset-0 bg-[var(--ink)]/50" />

                <div
                    onClick={(e) => e.stopPropagation()}
                    className="card relative w-full max-w-md p-6"
                >

                    <button
                        type="button"
                        onClick={fecharAvaria}
                        aria-label="Fechar"
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)]"
                    >
                        <FiX className="w-4" aria-hidden />
                    </button>

                    <div className="flex items-center gap-2 pr-8">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--vermelho-fundo)] text-[var(--vermelho)]">
                            <FiAlertTriangle className="w-3.5" aria-hidden />
                        </span>
                        <h2 className="font-display truncate text-lg text-[var(--ink)]">
                            Registrar avaria
                        </h2>
                    </div>

                    <p className="mt-3 text-sm text-[var(--ink)]">
                        {alvoAvaria.produtoNome}
                    </p>

                    <p className="mt-1 font-mono text-xs text-[var(--ink-2)]">
                        {alvoAvaria.codigo}
                    </p>

                    <p className="mt-3 text-sm text-[var(--ink-2)]">
                        Essa unidade sai do estoque vendável. Dá pra restaurar depois em &ldquo;Ver avarias&rdquo; se for engano.
                    </p>

                    {erroAvaria && (
                        <div className="mt-4 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-2.5 text-sm font-semibold text-[var(--vermelho)]">
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

                <div className="absolute inset-0 bg-[var(--ink)]/50" />

                <div
                    onClick={(e) => e.stopPropagation()}
                    className="card relative w-full max-w-md p-6"
                >

                    <button
                        type="button"
                        onClick={fecharExclusao}
                        aria-label="Fechar"
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)]"
                    >
                        <FiX className="w-4" aria-hidden />
                    </button>

                    <div className="flex items-center gap-2 pr-8">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--vermelho-fundo)] text-[var(--vermelho)]">
                            <FiTrash2 className="w-3.5" aria-hidden />
                        </span>
                        <h2 className="font-display truncate text-lg text-[var(--ink)]">
                            Excluir unidade
                        </h2>
                    </div>

                    <p className="mt-3 text-sm text-[var(--ink)]">
                        {alvoExclusao.produtoNome}
                    </p>

                    <p className="mt-1 font-mono text-xs text-[var(--ink-2)]">
                        {alvoExclusao.codigo}
                    </p>

                    <p className="mt-3 text-sm text-[var(--ink-2)]">
                        Essa unidade é removida permanentemente do estoque. Diferente de uma avaria, essa ação não pode ser desfeita.
                    </p>

                    {erroExclusao && (
                        <div className="mt-4 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-2.5 text-sm font-semibold text-[var(--vermelho)]">
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
