"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Produto, Unidade } from "@/app/type/type"
import { excluirProduto, publicarProduto } from "@/middleware/produtos"
import { criarPromocao, removerPromocao } from "@/middleware/promocoes"
import { validarPromocao } from "@/security/validate"
import { ApiError } from "@/middleware/client"
import Pagination from "@/app/components/pagination/pagination"
import { atributosParaFicha } from "@/app/components/produto/campos"
import Preco, { Desconto, formatarMoeda } from "@/app/components/preco/preco"
import Cabecalho from "@/app/components/grade/cabecalho"
import {
    FiSearch,
    FiX,
    FiBox,
    FiCheck,
    FiAlertTriangle,
    FiDollarSign,
    FiCamera,
    FiEdit2,
    FiPrinter,
    FiPlus,
    FiPercent,
    FiEye,
    FiEyeOff,
} from "react-icons/fi"
import { urlDaImagem } from "@/security/imagem"

/**
 * A lista de produtos como grade de operação, no padrão de um WMS (a
 * referência aqui é o Senior WMS): uma linha por peça, colunas fixas,
 * densidade alta e a ação ao alcance do olho.
 *
 * Ela já foi uma vitrine de cartões com foto grande, quatro por linha.
 * Ficava bonita e servia mal: oito peças por tela, o código e o endereço
 * perdidos no meio do cartão, e nenhuma forma de comparar duas linhas — que
 * é o que quem confere estoque faz o dia inteiro. Foto grande é assunto da
 * vitrine (`app/loja`), não do painel.
 *
 * O que a grade assume, e a vitrine de cartões não assumia:
 *
 *   - uma linha por PEÇA, com o endereço dela. Duas peças do mesmo produto em
 *     prateleiras diferentes são duas linhas, porque são dois lugares aonde
 *     ir;
 *   - as colunas na ordem em que a pergunta é feita — o que é, que código
 *     tem, onde está, quanto custa, dá para vender;
 *   - número à direita e em fonte de largura fixa, para a coluna ser lida de
 *     cima a baixo sem o olho procurar a vírgula;
 *   - a linha inteira clicável, e as ações repetidas em botões: quem já sabe
 *     o que quer não deveria precisar abrir a ficha para chegar lá.
 */

interface LinhaProduto {
    produto: Produto
    unidade: Unidade | null
}

// Grade mostra mais que cartão: 25 linhas cabem numa tela de trabalho sem
// obrigar a paginar a cada olhada.
const ITENS_POR_PAGINA = 25

/** As colunas por que a grade pode ser ordenada. */
type Coluna = "produto" | "codigo" | "endereco" | "preco"

/** Os recortes da barra de filtro, na ordem em que aparecem. */
type Situacao = "todos" | "disponivel" | "sem_estoque" | "promocao" | "fora_do_site"

/**
 * O que a página já sabe quando esta grade monta.
 *
 * Os três chegam prontos do servidor (ver page.tsx), e é isso que muda em
 * relação a como esta tela funcionava antes: ela não busca mais nada para
 * aparecer. Interação continua toda aqui — buscar, filtrar, ordenar, abrir a
 * ficha —, porque é trabalho de navegador e não vale uma ida ao servidor.
 */
interface Props {
    produtos: Produto[]
    /** Todas as peças em estoque; a grade abre uma linha por peça. */
    unidades: Unidade[]
    /**
     * Se o plano da loja inclui site.
     *
     * Só faz sentido oferecer "pôr no site" a quem tem site: no plano de
     * estoque a rota de publicar responde 402, e um botão que só sabe falhar
     * é pior do que botão nenhum.
     *
     * Quem responde isso é o menu, e não a tela da loja: /private/loja
     * também exige o plano com site, então perguntar por lá seria levar o
     * mesmo 402 que se está tentando evitar.
     */
    temSite: boolean
}

export default function Grade({ produtos, unidades, temSite }: Props) {

    const router = useRouter()

    /**
     * Recarrega a lista depois de gravar.
     *
     * `router.refresh()` faz o servidor renderizar a página de novo e trocar
     * os dados no lugar, sem perder o que está aberto na tela — o filtro
     * escolhido, a página em que se está, o modal. É o que substituiu o
     * `carregarProdutos()` que esta tela chamava: agora quem busca é o
     * servidor, então quem grava só precisa pedir que ele conte de novo.
     *
     * O `useTransition` existe para o botão continuar ocupado até a lista
     * nova chegar. Sem ele, `refresh()` volta na hora, o spinner some, e por
     * um instante a tela mostra com ar de pronto o valor que acabou de ser
     * trocado.
     */
    const [recarregando, iniciarRecarga] = useTransition()

    function recarregar() {
        iniciarRecarga(() => router.refresh())
    }

    const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
    const [precoPromoInput, setPrecoPromoInput] = useState("")
    const [erroPromo, setErroPromo] = useState("")
    const [salvandoPromo, setSalvandoPromo] = useState(false)

    // Pôr no site e tirar do site. Produto nasce fora da vitrine (o padrão
    // da coluna é falso), então esta é a chave que faz a peça aparecer para
    // o cliente — e ela mora aqui porque esta é a lista do que a loja
    // oferece. Tirar do site não apaga nada: a mercadoria continua no
    // estoque, contada e endereçada como antes.
    const [publicandoId, setPublicandoId] = useState<number | null>(null)
    const [erroSite, setErroSite] = useState("")

    const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
    const [excluindoProduto, setExcluindoProduto] = useState(false)
    const [erroExclusao, setErroExclusao] = useState("")

    const [busca, setBusca] = useState("")
    const [paginaAtual, setPaginaAtual] = useState(1)

    // Filtro de situação e ordenação vivem no cabeçalho da grade, como em
    // qualquer WMS: é o que troca "rolar a página procurando" por um clique.
    const [situacao, setSituacao] = useState<Situacao>("todos")
    const [ordem, setOrdem] = useState<{ coluna: Coluna; desc: boolean }>({
        coluna: "produto",
        desc: false,
    })
    function abrirModal(produto: Produto) {
        setProdutoSelecionado(produto)
        setPrecoPromoInput(produto.preco_promocional ? String(produto.preco_promocional) : "")
        setErroPromo("")
        setConfirmandoExclusao(false)
        setErroExclusao("")
    }

    async function alternarSite(produto: Produto) {

        setErroSite("")
        setPublicandoId(produto.id)

        try {
            await publicarProduto(produto.id, !produto.publicado)

            recarregar()

            // O modal segura uma cópia do produto: sem atualizá-la, o botão
            // continuaria oferecendo o que acabou de ser feito.
            setProdutoSelecionado((atual) =>
                atual && atual.id === produto.id
                    ? { ...atual, publicado: !produto.publicado }
                    : atual
            )

        } catch (e) {
            setErroSite(e instanceof ApiError ? e.message : "Não foi possível atualizar a vitrine.")
        } finally {
            setPublicandoId(null)
        }
    }

    function fecharModal() {
        setProdutoSelecionado(null)
        setErroSite("")
        setPrecoPromoInput("")
        setErroPromo("")
        setConfirmandoExclusao(false)
        setErroExclusao("")
    }

    async function salvarPromocao() {

        if (!produtoSelecionado) return

        const promocao = {
            produto_id: produtoSelecionado.id,
            preco_promocional: parseFloat(precoPromoInput.replace(",", ".")),
        }

        const erros = validarPromocao(promocao)

        if (erros.length > 0) {
            setErroPromo(erros[0])
            return
        }

        try {

            setSalvandoPromo(true)

            await criarPromocao(promocao)

            fecharModal()

            recarregar()

        } catch (error) {

            console.error("Erro ao salvar promoção:", error)

            setErroPromo(
                error instanceof ApiError ? error.message : "Não foi possível salvar a promoção."
            )

        } finally {

            setSalvandoPromo(false)

        }
    }

    async function excluirPromocao() {

        if (!produtoSelecionado) return

        try {

            setSalvandoPromo(true)

            await removerPromocao(produtoSelecionado.id)

            fecharModal()

            recarregar()

        } catch (error) {

            console.error("Erro ao remover promoção:", error)

            setErroPromo("Não foi possível remover a promoção.")

        } finally {

            setSalvandoPromo(false)

        }
    }

    async function excluirProdutoSelecionado() {

        if (!produtoSelecionado) return

        try {

            setExcluindoProduto(true)
            setErroExclusao("")

            await excluirProduto(produtoSelecionado.id)

            fecharModal()

            recarregar()

        } catch (error) {

            console.error("Erro ao excluir produto:", error)

            setErroExclusao(
                error instanceof ApiError ? error.message : "Não foi possível excluir o produto."
            )

        } finally {

            setExcluindoProduto(false)

        }
    }

    useEffect(() => {

        if (!produtoSelecionado) return

        function aoTeclar(e: KeyboardEvent) {
            if (e.key === "Escape") fecharModal()
        }

        window.addEventListener("keydown", aoTeclar)

        return () => window.removeEventListener("keydown", aoTeclar)

    }, [produtoSelecionado])

    // ==============================
    // ESTATÍSTICAS
    // ==============================

    const totalProdutos = produtos.length

    const totalEstoque = produtos.reduce(
        (total, produto) =>
            total + Number(produto.estoque || 0),
        0
    )

    const semEstoque = produtos.filter(
        produto => Number(produto.estoque) <= 0
    ).length

    const valorEmEstoque = produtos.reduce(
        (total, produto) =>
            total + Number(produto.preco || 0) * Number(produto.estoque || 0),
        0
    )


    // ==============================
    // LINHAS — uma por peça em estoque, não uma por produto
    // ==============================

    const linhas = useMemo(() => {

        const disponiveisPorProduto = new Map<number, Unidade[]>()

        for (const unidade of unidades) {

            if (unidade.vendida || unidade.avariada) continue

            if (!disponiveisPorProduto.has(unidade.produto_id)) {
                disponiveisPorProduto.set(unidade.produto_id, [])
            }

            disponiveisPorProduto.get(unidade.produto_id)!.push(unidade)
        }

        const lista: LinhaProduto[] = []

        for (const produto of produtos) {

            const unidadesDoProduto = (disponiveisPorProduto.get(produto.id) ?? [])
                .slice()
                .sort((a, b) => a.sequencia - b.sequencia)

            if (unidadesDoProduto.length > 0) {
                for (const unidade of unidadesDoProduto) {
                    lista.push({ produto, unidade })
                }
            } else {
                // Sem unidade disponível: produto esgotado (ou cadastrado
                // antes de unidades individuais existirem) — ainda assim
                // rende 1 linha, pra não sumir do catálogo.
                lista.push({ produto, unidade: null })
            }
        }

        return lista

    }, [produtos, unidades])


    // ==============================
    // BUSCA, FILTRO E ORDEM
    // ==============================

    const termoBusca = busca.trim().toLowerCase()

    function codigoDaLinha(linha: LinhaProduto): string {
        // Um código só, o do produto: a peça não tem outro. O id com seis
        // dígitos cobre o produto cadastrado antes de o código existir.
        return linha.produto.codigo || String(linha.produto.id).padStart(6, "0")
    }

    /** O preço que vale hoje — o promocional quando existe. */
    function precoDaLinha(linha: LinhaProduto): number {
        return Number(linha.produto.preco_promocional ?? linha.produto.preco)
    }

    function cabeNoFiltro(linha: LinhaProduto): boolean {

        switch (situacao) {

            case "disponivel":
                return linha.unidade !== null

            case "sem_estoque":
                return linha.unidade === null

            case "promocao":
                return Number(linha.produto.preco_promocional ?? 0) > 0

            case "fora_do_site":
                return !linha.produto.publicado

            default:
                return true
        }
    }

    const linhasFiltradas = useMemo(() => {

        const filtradas = linhas.filter((linha) => {

            if (!cabeNoFiltro(linha)) return false

            if (!termoBusca) return true

            return (
                linha.produto.nome.toLowerCase().includes(termoBusca) ||
                codigoDaLinha(linha).toLowerCase().includes(termoBusca) ||
                (linha.unidade?.endereco ?? "").toLowerCase().includes(termoBusca)
            )
        })

        // Endereço compara como texto de propósito: é o que faz "001.005" vir
        // antes de "001.010", que é a ordem do corredor — a mesma que quem
        // separa segue com o papel na mão.
        const comparar = (a: LinhaProduto, b: LinhaProduto) => {

            switch (ordem.coluna) {

                case "codigo":
                    return codigoDaLinha(a).localeCompare(codigoDaLinha(b), "pt-BR")

                case "endereco":
                    return (a.unidade?.endereco ?? "").localeCompare(b.unidade?.endereco ?? "", "pt-BR")

                case "preco":
                    return precoDaLinha(a) - precoDaLinha(b)

                default:
                    return a.produto.nome.localeCompare(b.produto.nome, "pt-BR")
            }
        }

        return filtradas.sort((a, b) => (ordem.desc ? -comparar(a, b) : comparar(a, b)))

        // eslint-disable-next-line react-hooks/exhaustive-deps -- cabeNoFiltro e codigoDaLinha são puras e dependem só de `situacao`
    }, [linhas, termoBusca, situacao, ordem])

    /** Os recortes da barra de filtro, já com a contagem de cada um. */
    const filtros: { chave: Situacao; nome: string; total: number }[] = [
        { chave: "todos", nome: "Todas", total: linhas.length },
        { chave: "disponivel", nome: "Disponíveis", total: linhas.filter((l) => l.unidade !== null).length },
        { chave: "sem_estoque", nome: "Sem estoque", total: linhas.filter((l) => l.unidade === null).length },
        { chave: "promocao", nome: "Em promoção", total: linhas.filter((l) => Number(l.produto.preco_promocional ?? 0) > 0).length },
    ]

    // "Fora do site" só é pergunta para quem tem site.
    if (temSite) {
        filtros.push({
            chave: "fora_do_site",
            nome: "Fora do site",
            total: linhas.filter((l) => !l.produto.publicado).length,
        })
    }


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

    function aoMudarSituacao(valor: Situacao) {
        setSituacao(valor)
        setPaginaAtual(1)
    }

    // Clicar na coluna que já ordena inverte o sentido; clicar em outra
    // começa dela, crescente. É o que toda grade faz, e o que a mão espera.
    function ordenarPor(coluna: Coluna) {

        setOrdem((atual) =>
            atual.coluna === coluna
                ? { coluna, desc: !atual.desc }
                : { coluna, desc: false }
        )

        setPaginaAtual(1)
    }


    // ==============================
    // PÁGINA
    // ==============================

    return (
        <>

            {/* ==========================
                CONTEÚDO
            ========================== */}


            {/* ==========================
                RESUMO
                Faixa fina, e não quatro cartões grandes: o número
                interessa de relance, no caminho para a grade — que é
                onde o trabalho acontece.
            ========================== */}

            <div className="card grid grid-cols-2 divide-[var(--linha-suave)] md:grid-cols-4 md:divide-x">

                <div className="flex items-center gap-3 border-b border-[var(--linha-suave)] p-4 md:border-b-0">

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--azul-suave)] text-[var(--azul)]">
                        <FiBox className="w-4" aria-hidden />
                    </span>

                    <span className="min-w-0">
                        <span className="block text-xs text-[var(--ink-2)]">Produtos</span>
                        <span className="num block text-xl font-extrabold text-[var(--ink)]">{totalProdutos}</span>
                    </span>

                </div>

                <div className="flex items-center gap-3 border-b border-[var(--linha-suave)] p-4 md:border-b-0">

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--verde-fundo)] text-[var(--verde)]">
                        <FiCheck className="w-4" aria-hidden />
                    </span>

                    <span className="min-w-0">
                        <span className="block text-xs text-[var(--ink-2)]">Unidades em estoque</span>
                        <span className="num block text-xl font-extrabold text-[var(--ink)]">{totalEstoque}</span>
                    </span>

                </div>

                <div className="flex items-center gap-3 p-4">

                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        semEstoque > 0 ? "bg-[var(--vermelho-fundo)] text-[var(--vermelho)]" : "bg-[var(--fundo)] text-[var(--ink-2)]"
                    }`}>
                        <FiAlertTriangle className="w-4" aria-hidden />
                    </span>

                    <span className="min-w-0">
                        <span className="block text-xs text-[var(--ink-2)]">Sem estoque</span>
                        <span className={`num block text-xl font-extrabold ${
                            semEstoque > 0 ? "text-[var(--vermelho)]" : "text-[var(--ink)]"
                        }`}>
                            {semEstoque}
                        </span>
                    </span>

                </div>

                <div className="flex items-center gap-3 p-4">

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--amarelo-fundo)] text-[var(--amarelo)]">
                        <FiDollarSign className="w-4" aria-hidden />
                    </span>

                    <span className="min-w-0">
                        <span className="block text-xs text-[var(--ink-2)]">Valor em estoque</span>
                        <span className="num block truncate text-xl font-extrabold text-[var(--azul)]">
                            {formatarMoeda(valorEmEstoque)}
                        </span>
                    </span>

                </div>

            </div>


            {/* ==========================
                BARRA DA GRADE
                Filtro à esquerda, busca à direita: a pergunta que se
                faz por recorte e a que se faz por nome, cada uma no
                seu lado.
            ========================== */}

            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">

                    {filtros.map(({ chave, nome, total }) => {

                        const ativo = chave === situacao

                        return (
                            <button
                                key={chave}
                                type="button"
                                aria-pressed={ativo}
                                onClick={() => aoMudarSituacao(chave)}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors ${
                                    ativo
                                        ? "border-[var(--azul)] bg-[var(--azul-suave)] text-[var(--azul-escuro)]"
                                        : "border-[var(--linha)] bg-[var(--superficie)] text-[var(--ink-2)] hover:border-[var(--ink-3)] hover:text-[var(--ink)]"
                                }`}
                            >
                                {nome}

                                <span className={`num text-xs font-extrabold ${ativo ? "text-[var(--azul)]" : "text-[var(--ink-3)]"}`}>
                                    {total}
                                </span>
                            </button>
                        )
                    })}

                </div>

                <div className="relative w-full lg:w-80">

                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[var(--ink-3)]" aria-hidden />

                    <input
                        type="text"
                        value={busca}
                        onChange={(e) => aoMudarBusca(e.target.value)}
                        placeholder="Buscar por nome, código ou endereço"
                        className="field"
                        style={{ paddingLeft: "2.25rem", paddingRight: busca ? "2.25rem" : undefined }}
                    />

                    {busca && (
                        <button
                            type="button"
                            onClick={() => aoMudarBusca("")}
                            aria-label="Limpar busca"
                            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)]"
                        >
                            <FiX className="w-4" aria-hidden />
                        </button>
                    )}

                </div>

            </div>

            {erroSite && (
                <div role="alert" className="mt-4 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-2.5 text-sm font-semibold text-[var(--vermelho)]">
                    {erroSite}
                </div>
            )}


            {/* ==========================
                A GRADE
            ========================== */}

            {linhasFiltradas.length === 0 ? (

                <div className="mt-6 rounded-lg border border-dashed border-[var(--linha)] bg-[var(--superficie)] p-16 text-center">

                    <FiBox className="mx-auto w-10 text-[var(--ink-3)]" aria-hidden />

                    <h3 className="font-display mt-5 text-xl text-[var(--ink)]">
                        Nenhum produto encontrado
                    </h3>

                    <p className="mt-2 text-sm text-[var(--ink-2)]">
                        {totalProdutos === 0
                            ? "Não existem produtos cadastrados."
                            : "Nenhuma unidade corresponde ao filtro ou à busca."}
                    </p>

                    {totalProdutos === 0 ? (

                        <Link href="/page/produto" className="btn btn-primario mt-6">
                            <FiPlus className="w-4" aria-hidden />
                            <span>Cadastrar produto</span>
                        </Link>

                    ) : (

                        <button
                            type="button"
                            onClick={() => { aoMudarBusca(""); aoMudarSituacao("todos") }}
                            className="btn btn-neutro mt-6"
                        >
                            Limpar filtros
                        </button>

                    )}

                </div>

            ) : (

                <div className="card mt-6 overflow-hidden">

                    {/* Em tela estreita a grade rola no eixo X em vez
                        de virar cartão: coluna que muda de lugar
                        conforme a largura é coluna que ninguém
                        aprende onde fica. */}
                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[52rem] border-collapse text-sm">

                            <thead>
                                <tr className="border-b border-[var(--linha)] bg-[var(--superficie-2)] text-left">

                                    <th scope="col" className="px-4 py-2.5">
                                        <Cabecalho ativa={ordem.coluna === "produto"} desc={ordem.desc} aoClicar={() => ordenarPor("produto")}>
                                            Produto
                                        </Cabecalho>
                                    </th>

                                    <th scope="col" className="px-4 py-2.5">
                                        <Cabecalho ativa={ordem.coluna === "codigo"} desc={ordem.desc} aoClicar={() => ordenarPor("codigo")}>
                                            Código
                                        </Cabecalho>
                                    </th>

                                    <th scope="col" className="hidden px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--ink-2)] xl:table-cell">
                                        Categoria
                                    </th>

                                    <th scope="col" className="px-4 py-2.5">
                                        <Cabecalho ativa={ordem.coluna === "endereco"} desc={ordem.desc} aoClicar={() => ordenarPor("endereco")}>
                                            Endereço
                                        </Cabecalho>
                                    </th>

                                    <th scope="col" className="px-4 py-2.5">
                                        <Cabecalho ativa={ordem.coluna === "preco"} desc={ordem.desc} aoClicar={() => ordenarPor("preco")} direita>
                                            Preço
                                        </Cabecalho>
                                    </th>

                                    <th scope="col" className="px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--ink-2)]">
                                        Situação
                                    </th>

                                    {temSite && (
                                        <th scope="col" className="hidden px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--ink-2)] lg:table-cell">
                                            Site
                                        </th>
                                    )}

                                    <th scope="col" className="px-4 py-2.5 text-right text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--ink-2)]">
                                        Ações
                                    </th>

                                </tr>
                            </thead>

                            <tbody>

                                {linhasDaPagina.map((linha) => {

                                    const { produto, unidade } = linha
                                    const codigo = codigoDaLinha(linha)
                                    const emPromocao = Number(produto.preco_promocional ?? 0) > 0

                                    return (

                                        <tr
                                            key={unidade ? `unidade-${unidade.id}` : `produto-${produto.id}`}
                                            onClick={() => abrirModal(produto)}
                                            className="cursor-pointer border-b border-[var(--linha-suave)] transition-colors last:border-b-0 hover:bg-[var(--superficie-2)]"
                                        >

                                            {/* PRODUTO */}
                                            <td className="px-4 py-2.5">

                                                <div className="flex items-center gap-3">

                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--fundo)]">
                                                        {produto.imagem_url ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={urlDaImagem(produto.imagem_url)}
                                                                alt=""
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <FiCamera className="w-4 text-[var(--ink-3)]" aria-hidden />
                                                        )}
                                                    </div>

                                                    <div className="min-w-0">

                                                        <p className="truncate font-bold text-[var(--ink)]">
                                                            {produto.nome}
                                                        </p>

                                                        {produto.variacao && (
                                                            <p className="truncate text-xs text-[var(--ink-2)]">
                                                                {produto.variacao_rotulo || "Variação"}: {produto.variacao}
                                                            </p>
                                                        )}

                                                    </div>

                                                </div>

                                            </td>

                                            {/* CÓDIGO */}
                                            <td className="px-4 py-2.5 font-mono text-xs text-[var(--ink-2)]">
                                                {codigo}
                                            </td>

                                            {/* CATEGORIA */}
                                            <td className="hidden px-4 py-2.5 text-[var(--ink-2)] xl:table-cell">
                                                {produto.categoria || "—"}
                                            </td>

                                            {/* ENDEREÇO */}
                                            <td className="px-4 py-2.5">
                                                {unidade?.endereco ? (
                                                    <span className="font-mono text-xs font-bold text-[var(--ink)]">
                                                        {unidade.endereco}
                                                    </span>
                                                ) : (
                                                    <span className="text-[var(--ink-3)]">—</span>
                                                )}
                                            </td>

                                            {/* PREÇO */}
                                            <td className="px-4 py-2.5 text-right">
                                                <Preco
                                                    valor={Number(produto.preco_promocional ?? produto.preco)}
                                                    valorAntigo={emPromocao ? Number(produto.preco) : null}
                                                    className="text-base"
                                                />
                                            </td>

                                            {/* SITUAÇÃO */}
                                            <td className="px-4 py-2.5">
                                                <span className={`tag ${unidade ? "tag-success" : "tag-danger"}`}>
                                                    {unidade ? "Disponível" : "Sem estoque"}
                                                </span>
                                            </td>

                                            {/* SITE */}
                                            {temSite && (
                                                <td className="hidden px-4 py-2.5 lg:table-cell">
                                                    <span className={`tag ${produto.publicado ? "tag-info" : "tag-neutral"}`}>
                                                        {produto.publicado
                                                            ? <FiEye className="w-3.5" aria-hidden />
                                                            : <FiEyeOff className="w-3.5" aria-hidden />}
                                                        {produto.publicado ? "No site" : "Fora"}
                                                    </span>
                                                </td>
                                            )}

                                            {/* AÇÕES
                                                Repetidas aqui e dentro
                                                da ficha: quem já sabe o
                                                que quer não deveria
                                                precisar abrir nada. */}
                                            <td className="px-4 py-2.5">

                                                <div className="flex items-center justify-end gap-1">

                                                    <button
                                                        type="button"
                                                        title="Preço promocional"
                                                        aria-label={`Preço promocional de ${produto.nome}`}
                                                        onClick={(e) => { e.stopPropagation(); abrirModal(produto) }}
                                                        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--fundo)] ${
                                                            emPromocao ? "text-[var(--amarelo)]" : "text-[var(--ink-2)] hover:text-[var(--ink)]"
                                                        }`}
                                                    >
                                                        <FiPercent className="w-4" aria-hidden />
                                                    </button>

                                                    <Link
                                                        href={`/page/produto/editar/${produto.id}`}
                                                        title="Editar"
                                                        aria-label={`Editar ${produto.nome}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)] hover:text-[var(--ink)]"
                                                    >
                                                        <FiEdit2 className="w-4" aria-hidden />
                                                    </Link>

                                                    <Link
                                                        href={`/page/produto/etiqueta/${produto.id}`}
                                                        title="Etiqueta"
                                                        aria-label={`Etiqueta de ${produto.nome}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)] hover:text-[var(--ink)]"
                                                    >
                                                        <FiPrinter className="w-4" aria-hidden />
                                                    </Link>

                                                </div>

                                            </td>

                                        </tr>
                                    )
                                })}

                            </tbody>

                        </table>

                    </div>

                    {/* RODAPÉ DA GRADE — a contagem fica colada nela e
                        não solta no meio da página: "1–25 de 340" é
                        parte da tabela, não um aviso à parte. */}
                    <div className="flex flex-col gap-3 border-t border-[var(--linha)] bg-[var(--superficie-2)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

                        <p className="text-xs text-[var(--ink-2)]">
                            Mostrando{" "}
                            <span className="num font-bold text-[var(--ink)]">
                                {primeiraDaPagina + 1}–{primeiraDaPagina + linhasDaPagina.length}
                            </span>{" "}
                            de <span className="num font-bold text-[var(--ink)]">{linhasFiltradas.length}</span>
                            {linhasFiltradas.length !== linhas.length && (
                                <> · <span className="num">{linhas.length}</span> no total</>
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


        {/* ==========================
            MODAL DE PROMOÇÃO
        ========================== */}

        {produtoSelecionado && (() => {

            const precoDigitado = parseFloat(precoPromoInput.replace(",", "."))
            const temPreview = Number.isFinite(precoDigitado) && precoDigitado > 0

            return (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={fecharModal}
                >
                    <div className="absolute inset-0 bg-[var(--ink)]/50" />

                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="card relative w-full max-w-md p-6"
                    >

                        <button
                            type="button"
                            onClick={fecharModal}
                            aria-label="Fechar"
                            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)]"
                        >
                            <FiX className="w-4" aria-hidden />
                        </button>

                        <div className="flex items-center gap-4 pr-8">

                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--fundo)]">
                                {produtoSelecionado.imagem_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={urlDaImagem(produtoSelecionado.imagem_url)}
                                        alt={produtoSelecionado.nome}
                                        className="h-full w-full object-cover"
                                    />
                                ) : null}
                            </div>

                            <div className="min-w-0">
                                <h2 className="font-display truncate text-lg text-[var(--ink)]">
                                    {produtoSelecionado.nome}
                                </h2>
                                <p className="text-sm text-[var(--ink-2)]">
                                    Preço atual: <span className="num">{formatarMoeda(Number(produtoSelecionado.preco))}</span>
                                </p>
                            </div>

                        </div>

                        {/* A ficha do produto: tamanho, tecido, cor. Saiu da
                            grade e veio para cá quando a lista virou tabela —
                            na linha isso seria uma coluna por atributo, cada
                            loja com as suas, e nenhuma largura que servisse
                            para todas. Aqui é a ficha de um produto só, e
                            cabe. */}
                        {atributosParaFicha(produtoSelecionado.atributos).length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {atributosParaFicha(produtoSelecionado.atributos).map(({ nome, valor }) => (
                                    <span
                                        key={nome}
                                        className="rounded-full bg-[var(--fundo)] px-2.5 py-1 text-xs text-[var(--ink-2)]"
                                    >
                                        {nome}: <span className="font-bold text-[var(--ink)]">{valor}</span>
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="mt-5 rounded-lg border border-[var(--linha)] bg-[var(--fundo)] px-4 py-3">
                            <p className="text-xs text-[var(--ink-2)]">
                                Estoque disponível
                            </p>
                            <p className="num text-lg font-extrabold text-[var(--ink)]">
                                {produtoSelecionado.estoque} un.
                            </p>
                        </div>

                        <div className="mt-6 space-y-1.5">

                            <label className="rotulo">
                                Novo preço (R$)
                            </label>

                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                autoFocus
                                value={precoPromoInput}
                                onChange={(e) => setPrecoPromoInput(e.target.value)}
                                placeholder="Ex: 59.90"
                                className="field num"
                            />

                            <p className="text-xs text-[var(--ink-2)]">
                                Escolha um valor menor (desconto) ou maior (reajuste) que o preço atual.
                            </p>

                        </div>

                        {temPreview && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Preco
                                    valor={precoDigitado}
                                    valorAntigo={Number(produtoSelecionado.preco)}
                                    className="text-lg"
                                />
                                <Desconto
                                    de={Number(produtoSelecionado.preco)}
                                    para={precoDigitado}
                                />
                            </div>
                        )}

                        {erroPromo && (
                            <div className="mt-4 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-2.5 text-sm font-semibold text-[var(--vermelho)]">
                                {erroPromo}
                            </div>
                        )}

                        {erroSite && (
                            <div className="mt-4 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-2.5 text-sm font-semibold text-[var(--vermelho)]">
                                {erroSite}
                            </div>
                        )}

                        <div className="mt-6 flex flex-col gap-2">

                            <button
                                type="button"
                                onClick={salvarPromocao}
                                disabled={salvandoPromo}
                                className="btn btn-primario w-full"
                            >
                                {salvandoPromo ? "Salvando..." : "Salvar promoção"}
                            </button>

                            {temSite && (
                            <button
                                type="button"
                                onClick={() => alternarSite(produtoSelecionado)}
                                disabled={publicandoId === produtoSelecionado.id || recarregando}
                                className="btn btn-neutro w-full"
                            >
                                {produtoSelecionado.publicado ? (
                                    <>
                                        <FiEyeOff className="w-4" aria-hidden />
                                        <span>Tirar do site</span>
                                    </>
                                ) : (
                                    <>
                                        <FiEye className="w-4" aria-hidden />
                                        <span>Pôr no site</span>
                                    </>
                                )}
                            </button>
                            )}

                            <Link
                                href={`/page/produto/editar/${produtoSelecionado.id}`}
                                className="btn btn-neutro w-full"
                            >
                                <FiEdit2 className="w-4" aria-hidden />
                                <span>Editar produto</span>
                            </Link>

                            <Link
                                href={`/page/produto/etiqueta/${produtoSelecionado.id}`}
                                className="btn btn-neutro w-full"
                            >
                                <FiPrinter className="w-4" aria-hidden />
                                <span>Imprimir etiqueta</span>
                            </Link>

                            <div className="flex gap-2">

                                {produtoSelecionado.preco_promocional ? (
                                    <button
                                        type="button"
                                        onClick={excluirPromocao}
                                        disabled={salvandoPromo}
                                        className="flex-1 rounded-lg px-3 py-2 text-sm font-bold text-[var(--vermelho)] transition-colors hover:bg-[var(--vermelho-fundo)] disabled:opacity-50"
                                    >
                                        Remover promoção
                                    </button>
                                ) : null}

                                <button
                                    type="button"
                                    onClick={fecharModal}
                                    disabled={salvandoPromo}
                                    className="flex-1 rounded-lg px-3 py-2 text-sm font-bold text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)] disabled:opacity-50"
                                >
                                    Cancelar
                                </button>

                            </div>

                        </div>

                        {/* EXCLUIR PRODUTO */}

                        <div className="mt-4 border-t border-[var(--linha)] pt-4">

                            {confirmandoExclusao ? (

                                <div className="space-y-2">

                                    <p className="text-sm font-semibold text-[var(--vermelho)]">
                                        Excluir permanentemente &ldquo;{produtoSelecionado.nome}&rdquo;? Essa ação não pode ser desfeita.
                                    </p>

                                    {erroExclusao && (
                                        <div className="rounded-lg bg-[var(--vermelho-fundo)] px-4 py-2.5 text-sm font-semibold text-[var(--vermelho)]">
                                            {erroExclusao}
                                        </div>
                                    )}

                                    <div className="flex gap-2">

                                        <button
                                            type="button"
                                            onClick={() => setConfirmandoExclusao(false)}
                                            disabled={excluindoProduto}
                                            className="flex-1 rounded-lg px-3 py-2 text-sm font-bold text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)] disabled:opacity-50"
                                        >
                                            Cancelar
                                        </button>

                                        <button
                                            type="button"
                                            onClick={excluirProdutoSelecionado}
                                            disabled={excluindoProduto}
                                            className="btn btn-perigo flex-1"
                                        >
                                            {excluindoProduto ? "Excluindo..." : "Sim, excluir"}
                                        </button>

                                    </div>

                                </div>

                            ) : (

                                <button
                                    type="button"
                                    onClick={() => setConfirmandoExclusao(true)}
                                    className="w-full rounded-lg px-3 py-2 text-sm font-bold text-[var(--vermelho)] transition-colors hover:bg-[var(--vermelho-fundo)]"
                                >
                                    Excluir produto
                                </button>

                            )}

                        </div>

                    </div>
                </div>
            )

        })()}

        </>
    )
}