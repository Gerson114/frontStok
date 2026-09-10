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

    return (
        <Pagina
            titulo="Inventário rotativo"
            descricao="Os endereços que passaram da hora de contar, do mais atrasado para o menos. Contar todo dia um pedaço, em vez de parar a loja uma vez por ano."
        >

            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div role="status" className="flex items-start gap-2.5 rounded-lg bg-[#CDFEE1] px-4 py-3 text-sm font-semibold text-[#0C5132]">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{aviso}</span>
                </div>
            )}

            {/* ==========================
                CONTAGENS ATRASADAS
            ========================== */}

            <section className="card space-y-4 p-5 sm:p-7">

                <div className="flex flex-wrap items-end justify-between gap-4">

                    <div>
                        <h2 className="font-display text-base text-[#303030]">
                            Atrasadas
                        </h2>
                        <p className="mt-1 text-sm text-[#616161]">
                            Ver não cria trabalho. Pôr na fila é que manda alguém contar.
                        </p>
                    </div>

                    <div className="flex items-end gap-2">

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="limite">Quantas</label>
                            <input
                                id="limite"
                                type="number"
                                min="0"
                                value={limite}
                                onChange={(e) => setLimite(e.target.value)}
                                placeholder="5"
                                className="field num w-24"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={porNaFila}
                            disabled={gerando || pendentes.length === 0}
                            className="btn btn-primario"
                        >
                            <FiPlusCircle className="w-4" aria-hidden />
                            {gerando ? "Gerando..." : "Pôr na fila"}
                        </button>

                    </div>

                </div>

                {carregando ? (

                    <p className="text-[#616161]">Carregando...</p>

                ) : pendentes.length === 0 ? (

                    <p className="rounded-lg border border-dashed border-[#E1E1E1] p-8 text-center text-sm text-[#616161]">
                        Nenhum endereço atrasado. Tudo foi contado dentro do intervalo da curva
                        que ele guarda.
                    </p>

                ) : (

                    <ul className="divide-y divide-[#E1E1E1]">

                        {pendentes.map((contagem) => (

                            <li key={contagem.endereco_id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">

                                <div className="min-w-0">

                                    <p className="num font-medium text-[#303030]">
                                        {contagem.endereco}
                                    </p>

                                    <p className="text-xs text-[#616161]">
                                        {contagem.endereco_nome}
                                    </p>

                                    <p className="mt-1.5 flex flex-wrap items-center gap-2">

                                        <span className={`tag ${COR_DA_CURVA[contagem.curva] ?? "tag-neutral"}`}>
                                            curva {contagem.curva || "C"}
                                        </span>

                                        <span className="tag tag-neutral num">
                                            {contagem.pecas} peça(s)
                                        </span>

                                        {contagem.nunca_contado ? (
                                            <span className="tag tag-warning">nunca contado</span>
                                        ) : (
                                            <span className="tag tag-neutral num">
                                                {contagem.dias_sem_contar} dia(s) sem contar
                                            </span>
                                        )}

                                    </p>

                                </div>

                                <p className="shrink-0 text-right text-xs text-[#616161]">
                                    última contagem
                                    <span className="num block text-sm text-[#303030]">
                                        {formatarData(contagem.ultima_em)}
                                    </span>
                                </p>

                            </li>

                        ))}

                    </ul>

                )}

                <p className="text-xs text-[#616161]">
                    Quem vai contar pega a tarefa na{" "}
                    <Link href="/page/estoque/fila" className="font-bold underline">
                        fila de trabalho
                    </Link>
                    ; a contagem em si é fechada logo abaixo.
                </p>

            </section>

            {/* ==========================
                CONTAR UM TRECHO
            ========================== */}

            <section className="card space-y-4 p-5 sm:p-7">

                <div>
                    <h2 className="font-display text-base text-[#303030]">
                        Contar agora
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-[#616161]">
                        Escolha o trecho e bipe o que está na prateleira. O código é o do
                        produto e se repete: cinco camisetas iguais são o mesmo código cinco
                        vezes, e as cinco leituras contam. Quem compara com o esperado e grava a
                        auditoria é o servidor, no fim.
                    </p>
                </div>

                <div className="space-y-1.5">
                    <label className="rotulo" htmlFor="trecho">Trecho</label>
                    <select
                        id="trecho"
                        value={trecho}
                        onChange={(e) => setTrecho(e.target.value)}
                        className="field cursor-pointer"
                    >
                        <option value="">Toda a loja (contagem geral)</option>
                        {enderecos.map((endereco) => (
                            <option key={endereco.id} value={endereco.codigo}>
                                {endereco.codigo} · {endereco.nome}
                            </option>
                        ))}
                    </select>
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

                    <div className="rounded-lg bg-[#F1F1F1] p-4">

                        <div className="flex flex-wrap items-center justify-between gap-3">

                            <p className="text-sm text-[#303030]">
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

                        <p className="mt-2 break-words font-mono text-xs text-[#616161]">
                            {lidos.join(" · ")}
                        </p>

                    </div>

                )}

                {resultado && (

                    <div className={`rounded-lg border-l-4 p-4 ${resultado.bate ? "border-[#0C5132] bg-[#CDFEE1]" : "border-[#8E1F0B] bg-[#FEE9E8]"}`}>

                        <p className="text-sm font-semibold text-[#303030]">
                            Esperadas <span className="num">{resultado.esperadas}</span> · encontradas{" "}
                            <span className="num">{resultado.encontradas}</span>
                        </p>

                        {resultado.faltando.length > 0 && (
                            <div className="mt-2">
                                <p className="text-sm font-semibold text-[#8E1F0B]">Faltou</p>
                                <ul className="mt-1 space-y-1 text-sm text-[#303030]">
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
                                <p className="text-sm font-semibold text-[#5E4200]">Sobrou</p>
                                <ul className="mt-1 space-y-1 text-sm text-[#303030]">
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
                            <p className="mt-1 text-sm text-[#303030]">
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
                        <h2 className="font-display flex items-center gap-2 text-base text-[#303030]">
                            <FiBarChart2 className="w-4 text-[#005BD3]" aria-hidden />
                            Curva ABC
                        </h2>
                        <p className="mt-1 max-w-lg text-sm text-[#616161]">
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

                        <div className="rounded-lg bg-[#F1F1F1] p-4">
                            <p className="text-xs text-[#616161]">Produtos</p>
                            <p className="num text-2xl font-bold text-[#303030]">{curva.produtos}</p>
                        </div>

                        <div className="rounded-lg bg-[#F1F1F1] p-4">
                            <p className="text-xs text-[#616161]">Vendas na janela</p>
                            <p className="num text-2xl font-bold text-[#303030]">{curva.vendas}</p>
                        </div>

                        {["A", "B", "C"].map((letra) => (
                            <div key={letra} className="rounded-lg bg-[#F1F1F1] p-4">
                                <p className="text-xs text-[#616161]">Curva {letra}</p>
                                <p className="num text-2xl font-bold text-[#303030]">
                                    {curva.por_curva?.[letra] ?? 0}
                                </p>
                            </div>
                        ))}

                    </div>

                )}

            </section>

            {/* ==========================
                CONFERÊNCIAS FECHADAS
            ========================== */}

            <section className="card space-y-4 p-5 sm:p-7">

                <div>
                    <h2 className="font-display flex items-center gap-2 text-base text-[#303030]">
                        <FiClipboard className="w-4 text-[#005BD3]" aria-hidden />
                        Contagens já fechadas
                    </h2>
                    <p className="mt-1 text-sm text-[#616161]">
                        O que cada conferência achou: o que o sistema esperava, o que apareceu, e
                        o que não bateu dos dois lados.
                    </p>
                </div>

                {conferencias.length === 0 ? (

                    <p className="rounded-lg border border-dashed border-[#E1E1E1] p-8 text-center text-sm text-[#616161]">
                        Nenhuma contagem fechada ainda.
                    </p>

                ) : (

                    <ul className="divide-y divide-[#E1E1E1]">

                        {conferencias.map((conferencia) => {

                            const bateu = !conferencia.faltando && !conferencia.sobrando

                            return (
                                <li key={conferencia.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5">

                                    <div className="min-w-0">

                                        <p className="num font-medium text-[#303030]">
                                            {conferencia.endereco || "toda a loja"}
                                        </p>

                                        <p className="text-xs text-[#616161]">
                                            {formatarData(conferencia.created_at)}
                                        </p>

                                        {conferencia.faltando && (
                                            <p className="mt-1 font-mono text-xs text-[#8E1F0B]">
                                                faltou: {conferencia.faltando}
                                            </p>
                                        )}

                                        {conferencia.sobrando && (
                                            <p className="mt-1 font-mono text-xs text-[#5E4200]">
                                                sobrou: {conferencia.sobrando}
                                            </p>
                                        )}

                                    </div>

                                    <div className="shrink-0 text-right">

                                        <p className="num text-sm text-[#303030]">
                                            {conferencia.encontradas} de {conferencia.esperadas}
                                        </p>

                                        <span className={`tag ${bateu ? "tag-success" : "tag-danger"}`}>
                                            {bateu ? "bateu" : "diferença"}
                                        </span>

                                    </div>

                                </li>
                            )
                        })}

                    </ul>

                )}

            </section>

        </Pagina>
    )
}
