"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
    apurarCurva,
    conferir,
    contagensPendentes,
    gerarInventario,
    listarConferencias,
    type Conferencia,
    type ContagemPendente,
    type ResultadoConferencia,
    type ResultadoCurva,
} from "@/middleware/wms"
import { listarEnderecos, type EnderecoEstoque } from "@/middleware/estoque"
import { ApiError } from "@/middleware/client"
import {
    FiAlertCircle,
    FiBarChart2,
    FiCheckCircle,
    FiClipboard,
    FiPlusCircle,
    FiRefreshCw,
    FiTrash2,
} from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"
import { Selecao } from "@/app/components/campo/selecao"
import {
    BarraDaLista,
    ListaDeRecursos,
    ListaVazia,
    RodapeDaLista,
    Visoes,
} from "@/app/components/lista/lista"

/**
 * Inventário rotativo e curva ABC.
 *
 * Contar um punhado de endereços por dia acha a diferença enquanto ainda dá
 * para saber o que aconteceu — parar a loja uma vez por ano acha a diferença
 * quando já não dá para explicar nenhuma delas.
 *
 * Quem decide o que está atrasado é o servidor, e ele decide pelo giro: o
 * endereço que guarda produto de curva A é contado com muito mais frequência
 * que o que guarda curva C, porque é ali que o erro custa caro. Daí as duas
 * coisas viverem na mesma tela — a curva é o que dá sentido à fila de
 * contagem.
 */

/** Cor da curva: A é o que sai toda hora, C é o que quase não sai. */
const COR_DA_CURVA: Record<string, string> = {
    A: "tag-success",
    B: "tag-info",
    C: "tag-neutral",
}

function formatarData(iso?: string | null): string {
    if (!iso) return "—"

    const data = new Date(iso)

    return Number.isNaN(data.getTime())
        ? "—"
        : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function Inventario() {

    const [pendentes, setPendentes] = useState<ContagemPendente[]>([])
    const [conferencias, setConferencias] = useState<Conferencia[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    const [gerando, setGerando] = useState(false)
    const [limite, setLimite] = useState("")

    // Qual das duas visões da contagem está aberta, e o texto que recorta as
    // duas (ver components/lista/lista.tsx).
    const [visao, setVisao] = useState("atrasadas")
    const [busca, setBusca] = useState("")

    const [curva, setCurva] = useState<ResultadoCurva | null>(null)
    const [dias, setDias] = useState("")
    const [apurando, setApurando] = useState(false)

    // A contagem em si: escolhe-se o trecho e bipa-se o que está na
    // prateleira. Os códigos ficam aqui até fechar — quem compara com o
    // esperado é o servidor, de uma vez, no fim.
    const [enderecos, setEnderecos] = useState<EnderecoEstoque[]>([])
    const [trecho, setTrecho] = useState("")
    const [bipado, setBipado] = useState("")
    const [lidos, setLidos] = useState<string[]>([])
    const [fechando, setFechando] = useState(false)
    const [resultado, setResultado] = useState<ResultadoConferencia | null>(null)

    const carregar = useCallback(async () => {

        try {
            const [fila, historico, lugares] = await Promise.all([
                contagensPendentes(),
                listarConferencias(),
                listarEnderecos(),
            ])

            setPendentes(fila)
            setConferencias(historico)
            setEnderecos(lugares)
            setErro("")

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível carregar o inventário.")
        } finally {
            setCarregando(false)
        }

    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()
    }, [carregar])

    async function porNaFila() {

        setErro("")
        setAviso("")
        setGerando(true)

        try {
            const resultado = await gerarInventario(parseInt(limite, 10) || 0)

            setAviso(
                resultado.criadas > 0
                    ? `${resultado.criadas} contagem(ns) na fila do estoque.`
                    : "Nenhuma contagem atrasada."
            )

            await carregar()

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível gerar as contagens.")
        } finally {
            setGerando(false)
        }
    }

    async function recalcularCurva() {

        setErro("")
        setAviso("")
        setApurando(true)

        try {
            const resposta = await apurarCurva(parseInt(dias, 10) || 0)

            setCurva(resposta.resultado)
            setAviso(resposta.ajuda)

            // A curva muda o que está atrasado: o endereço promovido a A passa
            // a ser cobrado num intervalo bem mais curto.
            await carregar()

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível apurar a curva.")
        } finally {
            setApurando(false)
        }
    }

    function bipar(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault()

        const codigo = bipado.trim()

        if (!codigo) return

        // O mesmo código repetido é o caso normal: cinco camisetas iguais têm
        // a mesma etiqueta, e as cinco leituras contam.
        setLidos((atual) => [...atual, codigo])
        setBipado("")
    }

    async function fecharContagem() {

        setErro("")
        setAviso("")
        setFechando(true)

        try {
            const resposta = await conferir(trecho, lidos)

            setResultado(resposta)
            setLidos([])
            setAviso(
                resposta.bate
                    ? "Contagem fechada: bateu tudo."
                    : "Contagem fechada: há diferença para investigar."
            )

            await carregar()

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível fechar a contagem.")
        } finally {
            setFechando(false)
        }
    }

    /*
     * O texto da busca recorta as duas visões pelo endereço, que é a única
     * coluna que as duas têm em comum — e é por ele que se procura: "o que
     * aconteceu com a rua 2?".
     */
    const termo = busca.trim().toLowerCase()

    const pendentesFiltradas = termo
        ? pendentes.filter((c) =>
            c.endereco.toLowerCase().includes(termo) ||
            (c.endereco_nome ?? "").toLowerCase().includes(termo))
        : pendentes

    const conferenciasFiltradas = termo
        ? conferencias.filter((c) => (c.endereco ?? "").toLowerCase().includes(termo))
        : conferencias

    return (
        <Pagina
            titulo="Inventário rotativo"
            descricao="Os endereços que passaram da hora de contar, do mais atrasado para o menos. Contar todo dia um pedaço, em vez de parar a loja uma vez por ano."
        >

            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div role="status" className="flex items-start gap-2.5 rounded-lg bg-[var(--verde-fundo)] px-4 py-3 text-sm font-semibold text-[var(--verde)]">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{aviso}</span>
                </div>
            )}

            {/* ==========================
                O TRABALHO DE CONTAGEM
                Duas visões da mesma coisa: o que falta contar e o que já foi
                contado. Eram duas seções em pontas opostas da tela, cada uma
                com o próprio formato de linha — e a segunda, que é o resultado
                da primeira, ficava tão longe que ninguém as lia juntas.
            ========================== */}

            <ListaDeRecursos>

                <Visoes
                    visoes={[
                        { chave: "atrasadas", nome: "Atrasadas", contagem: pendentes.length },
                        { chave: "fechadas", nome: "Já contadas", contagem: conferencias.length },
                    ]}
                    ativa={visao}
                    aoTrocar={setVisao}
                />

                <BarraDaLista
                    busca={busca}
                    aoBuscar={setBusca}
                    placeholder="Buscar por endereço"
                    controles={
                        visao === "atrasadas" ? (
                            <>
                                <div className="w-20">
                                    <input
                                        id="limite"
                                        type="number"
                                        min={1}
                                        value={limite}
                                        onChange={(e) => setLimite(e.target.value)}
                                        placeholder="5"
                                        aria-label="Quantas pôr na fila"
                                        className="field num text-center"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={porNaFila}
                                    disabled={gerando}
                                    className="btn btn-primario whitespace-nowrap text-sm"
                                >
                                    <FiPlusCircle className="w-4" aria-hidden />
                                    {gerando ? "Gerando..." : "Pôr na fila"}
                                </button>
                            </>
                        ) : undefined
                    }
                />

                {carregando ? (

                    <p className="px-4 py-14 text-center text-sm text-[var(--ink-2)]">Carregando...</p>

                ) : visao === "atrasadas" ? (

                    pendentesFiltradas.length === 0 ? (

                        <ListaVazia
                            icone={busca ? FiRefreshCw : FiCheckCircle}
                            titulo={busca ? "Nada com esse texto" : "Nenhum endereço atrasado"}
                        >
                            {busca
                                ? "Nenhum endereço atrasado casa com o que você digitou."
                                : "Tudo foi contado dentro do intervalo da curva que ele guarda."}
                        </ListaVazia>

                    ) : (

                        <div className="overflow-x-auto">

                            <table className="tabela">

                                <thead>
                                    <tr>
                                        <th scope="col">Endereço</th>
                                        <th scope="col">Curva</th>
                                        <th scope="col" className="text-right">Unidades</th>
                                        <th scope="col">Situação</th>
                                        <th scope="col" className="text-right">Última contagem</th>
                                    </tr>
                                </thead>

                                <tbody>

                                    {pendentesFiltradas.map((contagem) => (
                                        <tr key={contagem.endereco_id}>

                                            <td>
                                                <span className="num font-medium text-[var(--ink)]">{contagem.endereco}</span>
                                                <span className="block text-xs text-[var(--ink-2)]">{contagem.endereco_nome}</span>
                                            </td>

                                            <td>
                                                <span className={`tag ${COR_DA_CURVA[contagem.curva] ?? "tag-neutral"}`}>
                                                    {contagem.curva || "C"}
                                                </span>
                                            </td>

                                            <td className="num text-right text-[var(--ink)]">{contagem.pecas}</td>

                                            <td>
                                                {contagem.nunca_contado ? (
                                                    <span className="tag tag-warning">nunca contado</span>
                                                ) : (
                                                    <span className="num text-[var(--ink-2)]">
                                                        {contagem.dias_sem_contar} dia(s) sem contar
                                                    </span>
                                                )}
                                            </td>

                                            <td className="num text-right text-[var(--ink-2)]">
                                                {formatarData(contagem.ultima_em)}
                                            </td>

                                        </tr>
                                    ))}

                                </tbody>

                            </table>

                        </div>
                    )

                ) : conferenciasFiltradas.length === 0 ? (

                    <ListaVazia icone={FiClipboard} titulo="Nenhuma contagem fechada ainda">
                        O resultado de cada conferência aparece aqui: o que o sistema esperava, o
                        que apareceu, e o que não bateu dos dois lados.
                    </ListaVazia>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="tabela">

                            <thead>
                                <tr>
                                    <th scope="col">Endereço</th>
                                    <th scope="col">Quando</th>
                                    <th scope="col" className="text-right">Encontradas</th>
                                    <th scope="col">Resultado</th>
                                    <th scope="col">Diferença</th>
                                </tr>
                            </thead>

                            <tbody>

                                {conferenciasFiltradas.map((conferencia) => {

                                    const bateu = !conferencia.faltando && !conferencia.sobrando

                                    return (
                                        <tr key={conferencia.id}>

                                            <td className="num text-[var(--ink)]">
                                                {conferencia.endereco || "toda a loja"}
                                            </td>

                                            <td className="num text-[var(--ink-2)]">
                                                {formatarData(conferencia.created_at)}
                                            </td>

                                            <td className="num text-right text-[var(--ink)]">
                                                {conferencia.encontradas} de {conferencia.esperadas}
                                            </td>

                                            <td>
                                                <span className={`tag ${bateu ? "tag-success" : "tag-danger"}`}>
                                                    {bateu ? "bateu" : "diferença"}
                                                </span>
                                            </td>

                                            <td className="text-xs">
                                                {conferencia.faltando && (
                                                    <span className="num block text-[var(--vermelho)]">
                                                        faltou: {conferencia.faltando}
                                                    </span>
                                                )}
                                                {conferencia.sobrando && (
                                                    <span className="num block text-[var(--amarelo)]">
                                                        sobrou: {conferencia.sobrando}
                                                    </span>
                                                )}
                                                {bateu && <span className="text-[var(--ink-3)]">—</span>}
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
                    ultimo={visao === "atrasadas" ? pendentesFiltradas.length : conferenciasFiltradas.length}
                    total={visao === "atrasadas" ? pendentesFiltradas.length : conferenciasFiltradas.length}
                    nome={visao === "atrasadas" ? "endereços atrasados" : "contagens fechadas"}
                    extra={
                        visao === "atrasadas" ? (
                            <>
                                quem conta pega a tarefa na{" "}
                                <Link href="/page/estoque/fila" className="font-medium text-[var(--azul)] hover:underline">
                                    fila de trabalho
                                </Link>
                            </>
                        ) : undefined
                    }
                />

            </ListaDeRecursos>


            {/* ==========================
                CONTAR UM TRECHO
            ========================== */}

            <section className="card space-y-4 p-5 sm:p-7">

                <div>
                    <h2 className="font-display text-base text-[var(--ink)]">
                        Contar agora
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-[var(--ink-2)]">
                        Escolha o trecho e bipe o que está na prateleira. O código é o do
                        produto e se repete: cinco camisetas iguais são o mesmo código cinco
                        vezes, e as cinco leituras contam. Quem compara com o esperado e grava a
                        auditoria é o servidor, no fim.
                    </p>
                </div>

                <div className="space-y-1.5">
                    <label className="rotulo" htmlFor="trecho">Trecho</label>
                    <Selecao
                        id="trecho"
                        value={trecho}
                        onChange={(e) => setTrecho(e.target.value)}
                    >
                        <option value="">Toda a loja (contagem geral)</option>
                        {enderecos.map((endereco) => (
                            <option key={endereco.id} value={endereco.codigo}>
                                {endereco.codigo} · {endereco.nome}
                            </option>
                        ))}
                    </Selecao>
                </div>

                <form onSubmit={bipar} className="flex items-end gap-2">

                    <div className="flex-1 space-y-1.5">
                        <label className="rotulo" htmlFor="bipado">Código lido</label>
                        <input
                            id="bipado"
                            type="text"
                            value={bipado}
                            onChange={(e) => setBipado(e.target.value)}
                            placeholder="Bipe ou digite e dê Enter"
                            className="field num"
                            autoComplete="off"
                        />
                    </div>

                    <button type="submit" className="btn btn-neutro">
                        Adicionar
                    </button>

                </form>

                {lidos.length > 0 && (

                    <div className="rounded-lg bg-[var(--fundo)] p-4">

                        <div className="flex flex-wrap items-center justify-between gap-3">

                            <p className="text-sm text-[var(--ink)]">
                                <span className="num font-bold">{lidos.length}</span> leitura(s) nesta contagem
                            </p>

                            <div className="flex gap-2">

                                <button
                                    type="button"
                                    onClick={() => setLidos([])}
                                    className="btn btn-neutro text-sm"
                                >
                                    <FiTrash2 className="w-4" aria-hidden />
                                    Limpar
                                </button>

                                <button
                                    type="button"
                                    onClick={fecharContagem}
                                    disabled={fechando}
                                    className="btn btn-primario text-sm"
                                >
                                    {fechando ? "Fechando..." : "Fechar contagem"}
                                </button>

                            </div>

                        </div>

                        <p className="mt-2 break-words font-mono text-xs text-[var(--ink-2)]">
                            {lidos.join(" · ")}
                        </p>

                    </div>

                )}

                {resultado && (

                    <div className={`rounded-lg border-l-4 p-4 ${resultado.bate ? "border-[var(--verde)] bg-[var(--verde-fundo)]" : "border-[var(--vermelho)] bg-[var(--vermelho-fundo)]"}`}>

                        <p className="text-sm font-semibold text-[var(--ink)]">
                            Esperadas <span className="num">{resultado.esperadas}</span> · encontradas{" "}
                            <span className="num">{resultado.encontradas}</span>
                        </p>

                        {resultado.faltando.length > 0 && (
                            <div className="mt-2">
                                <p className="text-sm font-semibold text-[var(--vermelho)]">Faltou</p>
                                <ul className="mt-1 space-y-1 text-sm text-[var(--ink)]">
                                    {resultado.faltando.map((item) => (
                                        <li key={`falta-${item.codigo}`}>
                                            <span className="num">{item.quantidade}x</span>{" "}
                                            <span className="font-mono">{item.codigo}</span>
                                            {item.produto_nome ? ` · ${item.produto_nome}` : ""}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {resultado.sobrando.length > 0 && (
                            <div className="mt-2">
                                <p className="text-sm font-semibold text-[var(--amarelo)]">Sobrou</p>
                                <ul className="mt-1 space-y-1 text-sm text-[var(--ink)]">
                                    {resultado.sobrando.map((item) => (
                                        <li key={`sobra-${item.codigo}`}>
                                            <span className="num">{item.quantidade}x</span>{" "}
                                            <span className="font-mono">{item.codigo}</span>
                                            {item.produto_nome ? ` · ${item.produto_nome}` : ""}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {resultado.bate && (
                            <p className="mt-1 text-sm text-[var(--ink)]">
                                Tudo o que o sistema esperava estava lá.
                            </p>
                        )}

                    </div>

                )}

            </section>

            {/* ==========================
                CURVA ABC
            ========================== */}

            <section className="card space-y-4 p-5 sm:p-7">

                <div className="flex flex-wrap items-end justify-between gap-4">

                    <div>
                        <h2 className="font-display flex items-center gap-2 text-base text-[var(--ink)]">
                            <FiBarChart2 className="w-4 text-[var(--azul)]" aria-hidden />
                            Curva ABC
                        </h2>
                        <p className="mt-1 max-w-lg text-sm text-[var(--ink-2)]">
                            O giro de cada produto, apurado das vendas. A sai toda hora, B sai de
                            vez em quando, C quase não sai — guarde o A no lugar mais fácil de
                            alcançar. Apurar reclassifica o catálogo inteiro, então é um botão, e
                            não algo que acontece ao abrir a tela.
                        </p>
                    </div>

                    <div className="flex items-end gap-2">

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="dias">Janela (dias)</label>
                            <input
                                id="dias"
                                type="number"
                                min="0"
                                value={dias}
                                onChange={(e) => setDias(e.target.value)}
                                placeholder="90"
                                className="field num w-24"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={recalcularCurva}
                            disabled={apurando}
                            className="btn btn-neutro"
                        >
                            <FiRefreshCw className="w-4" aria-hidden />
                            {apurando ? "Apurando..." : "Apurar"}
                        </button>

                    </div>

                </div>

                {curva && (

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

                        <div className="rounded-lg bg-[var(--fundo)] p-4">
                            <p className="text-xs text-[var(--ink-2)]">Produtos</p>
                            <p className="num text-2xl font-bold text-[var(--ink)]">{curva.produtos}</p>
                        </div>

                        <div className="rounded-lg bg-[var(--fundo)] p-4">
                            <p className="text-xs text-[var(--ink-2)]">Vendas na janela</p>
                            <p className="num text-2xl font-bold text-[var(--ink)]">{curva.vendas}</p>
                        </div>

                        {["A", "B", "C"].map((letra) => (
                            <div key={letra} className="rounded-lg bg-[var(--fundo)] p-4">
                                <p className="text-xs text-[var(--ink-2)]">Curva {letra}</p>
                                <p className="num text-2xl font-bold text-[var(--ink)]">
                                    {curva.por_curva?.[letra] ?? 0}
                                </p>
                            </div>
                        ))}

                    </div>

                )}

            </section>


        </Pagina>
    )
}
