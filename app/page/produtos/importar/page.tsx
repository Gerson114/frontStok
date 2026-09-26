"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
    conferirPlanilha,
    importarPlanilha,
    type ConferenciaDaPlanilha,
    type LinhaDaPlanilha,
} from "@/middleware/produtos"
import { ApiError } from "@/middleware/client"
import {
    FiAlertCircle,
    FiAlertTriangle,
    FiCheckCircle,
    FiFileText,
    FiUploadCloud,
} from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"
import {
    ListaDeRecursos,
    ListaVazia,
    RodapeDaLista,
    Visoes,
} from "@/app/components/lista/lista"

/**
 * Importar o catálogo de uma planilha.
 *
 * É a primeira tela de quem está migrando de outro sistema — e, por isso, a
 * que decide se a pessoa continua. Ninguém redigita três mil produtos para
 * experimentar; sem esta porta, o teste acaba antes de começar.
 *
 * A tela tem dois passos, e o primeiro NÃO grava nada:
 *
 *   1. escolher o arquivo → o servidor lê e diz o que entendeu de cada linha
 *   2. conferir e confirmar → aí sim grava, tudo ou nada
 *
 * A conferência é o coração disto. Importação é a operação com maior chance de
 * estragar muito de uma vez: uma coluna lida errado vira três mil produtos com
 * preço trocado. Mostrar o preço JÁ CONVERTIDO, linha a linha, transforma o
 * erro de planilha numa linha vermelha na tela em vez de num estrago no banco.
 *
 * Por isso também a tela mostra, em cima, o que ela entendeu de cada coluna:
 * é assim que o lojista descobre que a coluna "valor" dele virou preço de
 * venda antes de mandar gravar.
 */

/** O rótulo e a cor de cada situação de linha. */
const SITUACAO: Record<string, { nome: string; classe: string }> = {
    novo: { nome: "produto novo", classe: "tag-success" },
    atualiza: { nome: "atualiza", classe: "tag-info" },
    erro: { nome: "erro", classe: "tag-danger" },
}

function moeda(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function ImportarProdutos() {

    const router = useRouter()
    const campoArquivo = useRef<HTMLInputElement>(null)

    const [arquivo, setArquivo] = useState<File | null>(null)
    const [conferencia, setConferencia] = useState<ConferenciaDaPlanilha | null>(null)

    const [conferindo, setConferindo] = useState(false)
    const [importando, setImportando] = useState(false)
    const [erro, setErro] = useState("")
    const [pronto, setPronto] = useState("")

    const [visao, setVisao] = useState("todas")
    const [arrastando, setArrastando] = useState(false)

    async function escolher(escolhido: File | null) {

        setErro("")
        setPronto("")
        setConferencia(null)
        setArquivo(escolhido)
        setVisao("todas")

        if (!escolhido) return

        setConferindo(true)

        try {
            setConferencia(await conferirPlanilha(escolhido))
        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível ler a planilha.")
            setArquivo(null)
        } finally {
            setConferindo(false)
        }
    }

    async function confirmar() {

        if (!arquivo) return

        setErro("")
        setImportando(true)

        try {
            const resultado = await importarPlanilha(arquivo)

            setPronto(
                `${resultado.criados} produto(s) criado(s), ${resultado.atualizados} atualizado(s)` +
                (resultado.pecas > 0 ? ` e ${resultado.pecas} unidade(s) no estoque.` : ".")
            )

            setConferencia(null)
            setArquivo(null)

            if (campoArquivo.current) campoArquivo.current.value = ""

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível importar a planilha.")
        } finally {
            setImportando(false)
        }
    }

    const linhas = conferencia?.linhas ?? []

    const visiveis: LinhaDaPlanilha[] =
        visao === "todas" ? linhas : linhas.filter((linha) => linha.situacao === visao)

    const resumo = conferencia?.resumo

    return (
        <Pagina
            titulo="Importar planilha"
            volta={{ nome: "Produtos", rota: "/page/produtos" }}
            descricao="Traga o catálogo que você já tem. O sistema lê a planilha, mostra o que entendeu de cada linha e só grava depois que você confirmar."
        >

            {erro && (
                <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {pronto && (
                <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-[var(--verde-fundo)] px-4 py-3 text-sm font-semibold text-[var(--verde)]">
                    <FiCheckCircle className="w-4 shrink-0" aria-hidden />
                    <span>{pronto}</span>
                    <button
                        type="button"
                        onClick={() => router.push("/page/produtos")}
                        className="btn btn-neutro ml-auto text-sm"
                    >
                        Ver os produtos
                    </button>
                </div>
            )}

            {/* PASSO 1 — o arquivo */}
            <section
                onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                    e.preventDefault()
                    setArrastando(false)
                    escolher(e.dataTransfer.files?.[0] ?? null)
                }}
                className={`card p-4 sm:p-6 text-center transition-colors ${
                    arrastando ? "border-[var(--azul)] bg-[var(--azul-suave)]" : ""
                }`}
            >

                <FiUploadCloud className="mx-auto w-8 text-[var(--ink-3)]" aria-hidden />

                <p className="mt-3 text-sm font-medium text-[var(--ink)]">
                    {arquivo ? arquivo.name : "Arraste a planilha aqui, ou escolha o arquivo"}
                </p>

                <p className="mx-auto mt-1 max-w-xl text-[0.8125rem] text-[var(--ink-2)]">
                    Serve o arquivo do Excel (.xlsx) ou o CSV que sai do sistema antigo. A
                    planilha precisa ter uma linha de cabeçalho com, no mínimo, as colunas de{" "}
                    <strong>nome</strong>, <strong>categoria</strong> e <strong>preço</strong> —
                    quantidade, custo e variação entram se existirem.
                </p>

                <input
                    ref={campoArquivo}
                    type="file"
                    accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => escolher(e.target.files?.[0] ?? null)}
                    className="sr-only"
                    id="planilha"
                />

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">

                    <label htmlFor="planilha" className="btn btn-primario cursor-pointer text-sm">
                        <FiFileText className="w-4" aria-hidden />
                        {arquivo ? "Trocar arquivo" : "Escolher arquivo"}
                    </label>

                    {conferindo && (
                        <span className="text-sm text-[var(--ink-2)]">Lendo a planilha...</span>
                    )}

                </div>

            </section>

            {/* PASSO 2 — o que vai acontecer */}
            {conferencia && (
                <>

                    {/* O que o servidor entendeu de cada coluna. Fica ANTES da
                        lista porque é a conferência que evita o erro grande: se
                        "valor" virou preço de venda e não devia, o lojista
                        descobre aqui, e não depois de gravar. */}
                    <section className="card mt-4 p-4">

                        <p className="text-[0.8125rem] font-medium text-[var(--ink)]">
                            O que eu entendi das suas colunas
                        </p>

                        <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
                            {conferencia.colunas.map((coluna) => (
                                <li key={coluna.campo} className="text-[0.8125rem] text-[var(--ink-2)]">
                                    {coluna.campo}:{" "}
                                    <span className="font-medium text-[var(--ink)]">“{coluna.coluna}”</span>
                                </li>
                            ))}
                        </ul>

                        {resumo && resumo.erros > 0 && (
                            <p className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--amarelo-fundo)] px-3 py-2 text-[0.8125rem] text-[var(--amarelo)]">
                                <FiAlertTriangle className="mt-0.5 w-4 shrink-0" aria-hidden />
                                <span>
                                    <span className="num font-bold">{resumo.erros}</span> linha(s) não
                                    serão importadas. As outras entram normalmente — corrija essas na
                                    planilha e importe o arquivo de novo depois, que o que já entrou
                                    não é duplicado.
                                </span>
                            </p>
                        )}

                    </section>

                    <div className="mt-4">

                        <ListaDeRecursos>

                            <Visoes
                                visoes={[
                                    { chave: "todas", nome: "Todas as linhas", contagem: resumo?.linhas },
                                    { chave: "novo", nome: "Produtos novos", contagem: resumo?.novos },
                                    { chave: "atualiza", nome: "Já existem", contagem: resumo?.atualiza },
                                    { chave: "erro", nome: "Com erro", contagem: resumo?.erros },
                                ]}
                                ativa={visao}
                                aoTrocar={setVisao}
                            />

                            {visiveis.length === 0 ? (

                                <ListaVazia icone={FiCheckCircle} titulo="Nenhuma linha nesta aba" />

                            ) : (

                                <div className="overflow-x-auto">

                                    <table className="tabela">

                                        <thead>
                                            <tr>
                                                <th scope="col" className="text-right">Linha</th>
                                                <th scope="col">Produto</th>
                                                <th scope="col">Categoria</th>
                                                <th scope="col" className="text-right">Preço</th>
                                                <th scope="col" className="text-right">Custo</th>
                                                <th scope="col" className="text-right">Unidades</th>
                                                <th scope="col">O que vai acontecer</th>
                                            </tr>
                                        </thead>

                                        <tbody>

                                            {visiveis.map((linha) => {

                                                const situacao = SITUACAO[linha.situacao] ?? SITUACAO.erro

                                                return (
                                                    <tr key={linha.linha}>

                                                        <td className="num text-right text-[var(--ink-3)]">
                                                            {linha.linha}
                                                        </td>

                                                        <td>
                                                            <span className="text-[var(--ink)]">
                                                                {linha.nome || <span className="text-[var(--ink-3)]">(sem nome)</span>}
                                                            </span>
                                                            {linha.variacao && (
                                                                <span className="text-[var(--ink-2)]"> · {linha.variacao}</span>
                                                            )}
                                                        </td>

                                                        <td className="text-[var(--ink-2)]">{linha.categoria}</td>

                                                        {/* O preço JÁ CONVERTIDO. É esta coluna que
                                                            denuncia "1.500" lido como mil e quinhentos
                                                            quando eram um e meio. */}
                                                        <td className="num text-right text-[var(--ink)]">
                                                            {linha.preco > 0 ? moeda(linha.preco) : "—"}
                                                        </td>

                                                        <td className="num text-right text-[var(--ink-2)]">
                                                            {linha.custo > 0 ? moeda(linha.custo) : "—"}
                                                        </td>

                                                        <td className="num text-right text-[var(--ink-2)]">
                                                            {linha.situacao === "novo" ? linha.estoque : "—"}
                                                        </td>

                                                        <td>
                                                            <span className={`tag ${situacao.classe}`}>
                                                                {situacao.nome}
                                                            </span>

                                                            {linha.erro && (
                                                                <span className="mt-0.5 block text-xs text-[var(--vermelho)]">
                                                                    {linha.erro}
                                                                </span>
                                                            )}

                                                            {linha.situacao === "atualiza" && (
                                                                <span className="mt-0.5 block text-xs text-[var(--ink-2)]">
                                                                    preço e custo; o estoque fica como está
                                                                </span>
                                                            )}
                                                        </td>

                                                    </tr>
                                                )
                                            })}

                                        </tbody>

                                    </table>

                                </div>

                            )}

                            <RodapeDaLista
                                primeiro={1}
                                ultimo={visiveis.length}
                                total={visiveis.length}
                                nome="linhas"
                            />

                        </ListaDeRecursos>

                    </div>

                    {/* A confirmação. Fica no fim, depois da lista, porque é
                        onde a pessoa chega depois de conferir — e o texto diz o
                        número exato do que vai acontecer, não "importar". */}
                    <section className="card mt-4 flex flex-wrap items-center justify-between gap-4 p-4">

                        <p className="text-sm text-[var(--ink-2)]">
                            Vai criar <span className="num font-semibold text-[var(--ink)]">{resumo?.novos ?? 0}</span>{" "}
                            produto(s)
                            {(resumo?.pecas ?? 0) > 0 && (
                                <> com <span className="num font-semibold text-[var(--ink)]">{resumo?.pecas}</span> unidade(s) em estoque</>
                            )}
                            {(resumo?.atualiza ?? 0) > 0 && (
                                <> e atualizar <span className="num font-semibold text-[var(--ink)]">{resumo?.atualiza}</span></>
                            )}
                            . Ou tudo entra, ou nada entra.
                        </p>

                        <button
                            type="button"
                            onClick={confirmar}
                            disabled={importando || (resumo?.novos ?? 0) + (resumo?.atualiza ?? 0) === 0}
                            className="btn btn-primario"
                        >
                            {importando ? "Importando..." : "Importar"}
                        </button>

                    </section>

                </>
            )}

        </Pagina>
    )
}
