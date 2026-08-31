"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
    LADOS,
    TIPOS_ENDERECO,
    listarEnderecos,
    montarEstrutura,
    quantidadeDaEstrutura,
    type EnderecoEstoque,
    type LadoDaPrateleira,
    type TipoEndereco,
} from "@/middleware/estoque"
import { ApiError } from "@/middleware/client"
import Barcode from "@/app/components/barcode/barcode"
import {
    FiAlertCircle,
    FiCheckCircle,
    FiGrid,
    FiPrinter,
} from "react-icons/fi"

/**
 * Configuração do estoque: montar a estrutura e imprimir as placas.
 *
 * São as duas coisas que precisam acontecer antes de o endereçamento existir
 * de verdade. A primeira é cadastrar as prateleiras — e cadastrar uma a uma é
 * o que faz o lojista desistir no primeiro dia, porque um estoque modesto
 * (cinco ruas, três blocos, quatro andares, dois lados) são 120 formulários.
 * Aqui ele diz quantos de cada nível existem e o servidor escreve o resto.
 *
 * A segunda é colar a placa na prateleira. Endereço que só existe no banco
 * não serve para nada: quem está no corredor precisa ler onde está, e quem
 * guarda a mercadoria precisa conferir que chegou no lugar certo. A placa tem
 * o código em letra grande, o endereço falado e o código de barras — que o
 * leitor entende, porque a rota do bipe reconhece placa além de etiqueta.
 */

/** Quantas placas por folha. Prateleira alta pede placa grande. */
const TAMANHOS = [
    { chave: 1, nome: "Grande (1 por folha)", classe: "print:grid-cols-1", altura: "print:h-[24cm]", codigo: "text-7xl", barras: "max-w-md" },
    { chave: 2, nome: "Média (2 por folha)", classe: "print:grid-cols-1", altura: "print:h-[13cm]", codigo: "text-6xl", barras: "max-w-sm" },
    { chave: 4, nome: "Pequena (4 por folha)", classe: "print:grid-cols-2", altura: "print:h-[13cm]", codigo: "text-4xl", barras: "max-w-[14rem]" },
] as const

type Tamanho = (typeof TAMANHOS)[number]

export default function ConfiguracaoDoEstoque() {

    const [enderecos, setEnderecos] = useState<EnderecoEstoque[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    // ==============================
    // ESTRUTURA
    // ==============================

    const [ruaInicial, setRuaInicial] = useState("1")
    const [ruaFinal, setRuaFinal] = useState("3")
    const [blocos, setBlocos] = useState("2")
    const [andares, setAndares] = useState("3")
    const [lados, setLados] = useState<LadoDaPrateleira[]>(["A"])
    const [tipo, setTipo] = useState<TipoEndereco>("picking")
    const [capacidade, setCapacidade] = useState("")
    const [zona, setZona] = useState("")
    const [montando, setMontando] = useState(false)

    // ==============================
    // PLACAS
    // ==============================

    const [selecionados, setSelecionados] = useState<number[]>([])
    const [tamanho, setTamanho] = useState<Tamanho>(TAMANHOS[1])

    const carregar = useCallback(async () => {

        try {
            setEnderecos(await listarEnderecos())
            setErro("")

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os endereços.")
        } finally {
            setCarregando(false)
        }

    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()
    }, [carregar])

    const estrutura = useMemo(() => ({
        rua_inicial: parseInt(ruaInicial, 10) || 0,
        rua_final: parseInt(ruaFinal, 10) || 0,
        blocos: parseInt(blocos, 10) || 0,
        andares: parseInt(andares, 10) || 0,
        lados,
        tipo,
        capacidade: parseInt(capacidade, 10) || 0,
        zona: zona.trim(),
    }), [ruaInicial, ruaFinal, blocos, andares, lados, tipo, capacidade, zona])

    const quantidade = quantidadeDaEstrutura(estrutura)

    function alternarLado(lado: LadoDaPrateleira) {
        setLados((atual) =>
            atual.includes(lado) ? atual.filter((item) => item !== lado) : [...atual, lado]
        )
    }

    async function criar() {

        setErro("")
        setAviso("")
        setMontando(true)

        try {
            const resultado = await montarEstrutura(estrutura)

            setAviso(
                resultado.quantidade > 0
                    ? `${resultado.quantidade} endereço(s) criado(s)${resultado.existentes > 0 ? `, ${resultado.existentes} já existiam` : ""}. Já dá para imprimir as placas.`
                    : "Nada a criar: todos esses endereços já existem."
            )

            await carregar()

            // Os que acabaram de nascer já vêm marcados: são justamente as
            // prateleiras que ainda não têm placa colada.
            if (resultado.criados.length > 0) {
                setSelecionados(resultado.criados.map((endereco) => endereco.id))
            }

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível montar a estrutura.")
        } finally {
            setMontando(false)
        }
    }

    // ==============================
    // SELEÇÃO DAS PLACAS
    // ==============================

    function alternarEndereco(id: number) {
        setSelecionados((atual) =>
            atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]
        )
    }

    const ruas = useMemo(
        () => Array.from(new Set(enderecos.map((endereco) => endereco.rua))).sort((a, b) => a - b),
        [enderecos]
    )

    function marcarRua(rua: number) {
        const daRua = enderecos.filter((endereco) => endereco.rua === rua).map((endereco) => endereco.id)
        setSelecionados((atual) => Array.from(new Set([...atual, ...daRua])))
    }

    const paraImprimir = enderecos.filter((endereco) => selecionados.includes(endereco.id))

    return (
        <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10 print:m-0 print:min-h-0 print:bg-white print:p-0">

            <div className="mx-auto max-w-4xl space-y-6 print:hidden">

                <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469]">
                        Estoque
                    </p>
                    <h1 className="font-display text-2xl text-[#1E2428]">
                        Configuração
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-[#5A6469]">
                        Monte a estrutura do seu estoque de uma vez e imprima as placas para colar
                        nas prateleiras. Endereço que só existe no sistema não ajuda ninguém: é a
                        placa que diz, para quem está no corredor, onde ele está.
                    </p>
                </div>

                {erro && (
                    <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]">
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {aviso && (
                    <div role="status" className="flex items-start gap-2.5 rounded-lg bg-[#E0FFEE] px-4 py-3 text-sm font-semibold text-[#08A022]">
                        <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{aviso}</span>
                    </div>
                )}

                {/* ==========================
                    MONTAR A ESTRUTURA
                ========================== */}

                <section className="card space-y-5 p-5 sm:p-7">

                    <div>
                        <h2 className="font-display flex items-center gap-2 text-base text-[#1E2428]">
                            <FiGrid className="w-4 text-[#0086FF]" aria-hidden />
                            Montar a estrutura
                        </h2>
                        <p className="mt-1 text-sm text-[#5A6469]">
                            Diga quantos de cada nível o seu estoque tem. O endereço é{" "}
                            <strong>rua · bloco · andar · lado</strong> — a loja pequena usa um bloco,
                            um andar e o lado A, e cresce a estrutura quando o estoque crescer.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="rua-inicial">Da rua</label>
                            <input
                                id="rua-inicial"
                                type="number"
                                min="1"
                                value={ruaInicial}
                                onChange={(e) => setRuaInicial(e.target.value)}
                                className="field num"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="rua-final">Até a rua</label>
                            <input
                                id="rua-final"
                                type="number"
                                min="1"
                                value={ruaFinal}
                                onChange={(e) => setRuaFinal(e.target.value)}
                                className="field num"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="blocos">Blocos por rua</label>
                            <input
                                id="blocos"
                                type="number"
                                min="1"
                                value={blocos}
                                onChange={(e) => setBlocos(e.target.value)}
                                className="field num"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="andares">Andares por bloco</label>
                            <input
                                id="andares"
                                type="number"
                                min="1"
                                value={andares}
                                onChange={(e) => setAndares(e.target.value)}
                                className="field num"
                            />
                        </div>

                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                        <div className="space-y-1.5">
                            <span className="rotulo">Lados de cada andar</span>
                            <div className="flex gap-4 pt-1.5">
                                {LADOS.map((lado) => (
                                    <label key={lado} className="flex cursor-pointer items-center gap-2 text-sm text-[#1E2428]">
                                        <input
                                            type="checkbox"
                                            checked={lados.includes(lado)}
                                            onChange={() => alternarLado(lado)}
                                            className="h-4 w-4 cursor-pointer accent-[#0086FF]"
                                        />
                                        Lado {lado}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="tipo">Serve para</label>
                            <select
                                id="tipo"
                                value={tipo}
                                onChange={(e) => setTipo(e.target.value as TipoEndereco)}
                                className="field cursor-pointer"
                            >
                                {TIPOS_ENDERECO.map((item) => (
                                    <option key={item.chave} value={item.chave}>{item.nome}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="capacidade">Capacidade de cada uma</label>
                            <input
                                id="capacidade"
                                type="number"
                                min="0"
                                value={capacidade}
                                onChange={(e) => setCapacidade(e.target.value)}
                                placeholder="0 = sem limite"
                                className="field num"
                            />
                        </div>

                    </div>

                    <div className="space-y-1.5">
                        <label className="rotulo" htmlFor="zona">Zona</label>
                        <input
                            id="zona"
                            type="text"
                            value={zona}
                            onChange={(e) => setZona(e.target.value)}
                            placeholder="Ex: loja, depósito, mezanino"
                            className="field"
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F0F3F4] p-4">

                        <p className="text-sm text-[#1E2428]">
                            Vai criar até <span className="num font-bold">{quantidade}</span> endereço(s).{" "}
                            <span className="text-[#5A6469]">
                                Os que já existirem ficam como estão.
                            </span>
                        </p>

                        <button
                            type="button"
                            onClick={criar}
                            disabled={montando || quantidade === 0}
                            className="btn btn-primario"
                        >
                            {montando ? "Criando..." : "Criar endereços"}
                        </button>

                    </div>

                </section>

                {/* ==========================
                    PLACAS
                ========================== */}

                <section className="card space-y-5 p-5 sm:p-7">

                    <div className="flex flex-wrap items-end justify-between gap-4">

                        <div>
                            <h2 className="font-display flex items-center gap-2 text-base text-[#1E2428]">
                                <FiPrinter className="w-4 text-[#0086FF]" aria-hidden />
                                Placas das prateleiras
                            </h2>
                            <p className="mt-1 max-w-lg text-sm text-[#5A6469]">
                                Escolha os endereços e imprima. Cada placa traz o código em letra
                                grande, o endereço falado e o código de barras — o leitor entende a
                                placa como entende a etiqueta do produto.
                            </p>
                        </div>

                        <div className="flex items-end gap-2">

                            <div className="space-y-1.5">
                                <label className="rotulo" htmlFor="tamanho">Tamanho</label>
                                <select
                                    id="tamanho"
                                    value={tamanho.chave}
                                    onChange={(e) => {
                                        const escolhido = TAMANHOS.find((item) => item.chave === Number(e.target.value))
                                        if (escolhido) setTamanho(escolhido)
                                    }}
                                    className="field cursor-pointer"
                                >
                                    {TAMANHOS.map((item) => (
                                        <option key={item.chave} value={item.chave}>{item.nome}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={() => window.print()}
                                disabled={paraImprimir.length === 0}
                                className="btn btn-primario"
                            >
                                <FiPrinter className="w-4" aria-hidden />
                                Imprimir {paraImprimir.length > 0 ? `(${paraImprimir.length})` : ""}
                            </button>

                        </div>

                    </div>

                    {carregando ? (

                        <p className="text-[#5A6469]">Carregando endereços...</p>

                    ) : enderecos.length === 0 ? (

                        <p className="rounded-lg border border-dashed border-[#D3DADD] p-8 text-center text-sm text-[#5A6469]">
                            Nenhum endereço cadastrado ainda. Monte a estrutura acima — ou cadastre um
                            a um em{" "}
                            <Link href="/page/estoque/enderecos" className="font-bold underline">
                                Endereços
                            </Link>
                            .
                        </p>

                    ) : (

                        <>
                            <div className="flex flex-wrap items-center gap-2">

                                <button
                                    type="button"
                                    onClick={() => setSelecionados(enderecos.map((endereco) => endereco.id))}
                                    className="btn btn-neutro text-sm"
                                >
                                    Marcar todos
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelecionados([])}
                                    className="btn btn-neutro text-sm"
                                >
                                    Limpar
                                </button>

                                <span className="mx-1 h-5 w-px bg-[#D3DADD]" />

                                {ruas.map((rua) => (
                                    <button
                                        key={rua}
                                        type="button"
                                        onClick={() => marcarRua(rua)}
                                        className="rounded-lg border border-[#D3DADD] px-3 py-1.5 text-xs font-bold text-[#1E2428] transition-colors hover:bg-[#F0F3F4]"
                                    >
                                        Rua {rua}
                                    </button>
                                ))}

                            </div>

                            <ul className="max-h-96 divide-y divide-[#D3DADD] overflow-y-auto">

                                {enderecos.map((endereco) => (

                                    <li key={endereco.id}>

                                        <label className="flex cursor-pointer items-center gap-3 py-2.5">

                                            <input
                                                type="checkbox"
                                                checked={selecionados.includes(endereco.id)}
                                                onChange={() => alternarEndereco(endereco.id)}
                                                className="h-4 w-4 shrink-0 cursor-pointer accent-[#0086FF]"
                                            />

                                            <span className="num min-w-0 flex-1 truncate text-sm font-medium text-[#1E2428]">
                                                {endereco.codigo}
                                            </span>

                                            <span className="min-w-0 flex-1 truncate text-xs text-[#5A6469]">
                                                {endereco.nome}
                                            </span>

                                            <span className="tag tag-neutral shrink-0">
                                                {endereco.tipo_nome}
                                            </span>

                                        </label>

                                    </li>

                                ))}

                            </ul>
                        </>

                    )}

                </section>

            </div>

            {/* ==========================
                O QUE VAI PARA O PAPEL
            ========================== */}

            <div className={`hidden print:grid ${tamanho.classe}`}>

                {paraImprimir.map((endereco) => (

                    <div
                        key={endereco.id}
                        className={`flex ${tamanho.altura} break-inside-avoid flex-col items-center justify-center border-4 border-black p-6 text-center`}
                    >

                        <p className={`num font-extrabold leading-none tracking-tight text-black ${tamanho.codigo}`}>
                            {endereco.codigo}
                        </p>

                        <p className="mt-4 text-lg font-bold uppercase tracking-wide text-black">
                            {endereco.nome}
                        </p>

                        <p className="mt-1 text-sm uppercase tracking-widest text-black">
                            {endereco.tipo_nome}
                            {endereco.zona ? ` · ${endereco.zona}` : ""}
                        </p>

                        <div className="mt-5 flex justify-center">
                            <Barcode valor={endereco.codigo} className={`w-full ${tamanho.barras}`} />
                        </div>

                    </div>

                ))}

            </div>

        </main>
    )
}
