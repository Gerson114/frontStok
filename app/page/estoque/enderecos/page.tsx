"use client"

import { useEffect, useState } from "react"
import {
    LADOS,
    TIPOS_ENDERECO,
    bloquearEndereco,
    criarEndereco,
    listarEnderecos,
    type EnderecoEstoque,
    type LadoDaPrateleira,
    type TipoEndereco,
} from "@/middleware/estoque"
import { ApiError } from "@/middleware/client"
import { FiAlertCircle, FiCheckCircle, FiLock, FiMapPin, FiPlus, FiUnlock } from "react-icons/fi"

/**
 * Endereços do estoque: o cadastro dos lugares onde a mercadoria fica.
 *
 * É a estrutura do armazém, na escala de uma loja. Cada lugar diz para que
 * serve (venda, reserva, quarentena, avaria), quanto cabe nele, em que ponto
 * da caminhada ele está e se aceita movimentação agora.
 *
 * Nada disso é enfeite: é esse cadastro que permite ao sistema guardar a
 * mercadoria sozinho, e ao lojista trancar um trecho para contar sem que
 * ninguém mexa nele no meio da contagem.
 */

const COR_DO_TIPO: Record<TipoEndereco, string> = {
    picking: "tag-success",
    pulmao: "tag-info",
    recebimento: "tag-info",
    expedicao: "tag-info",
    quarentena: "tag-neutral",
    avaria: "tag-neutral",
}

export default function EnderecosPage() {
    const [enderecos, setEnderecos] = useState<EnderecoEstoque[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")
    const [recarregar, setRecarregar] = useState(0)

    const [aberto, setAberto] = useState(false)

    // A hierarquia do lugar. Só a rua é obrigatória: bloco e andar em branco
    // viram 1 no servidor e o lado nasce no A, que é o estoque de quem ainda
    // não subdividiu as prateleiras.
    const [rua, setRua] = useState("")
    const [bloco, setBloco] = useState("")
    const [andar, setAndar] = useState("")
    const [lado, setLado] = useState<LadoDaPrateleira>("A")
    const [zona, setZona] = useState("")
    const [tipo, setTipo] = useState<TipoEndereco>("picking")
    const [capacidade, setCapacidade] = useState("")
    const [descricao, setDescricao] = useState("")
    const [salvando, setSalvando] = useState(false)

    useEffect(() => {
        let cancelado = false

        async function carregar() {
            try {
                const lista = await listarEnderecos()
                if (!cancelado) {
                    setEnderecos(lista)
                    setErro("")
                }
            } catch (e) {
                if (!cancelado) setErro(e instanceof Error ? e.message : "Não foi possível carregar os endereços")
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        carregar()

        return () => {
            cancelado = true
        }
    }, [recarregar])

    const atualizar = () => setRecarregar((n) => n + 1)

    async function cadastrar(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault()

        setErro("")
        setAviso("")

        const numeroRua = parseInt(rua, 10)

        if (!Number.isFinite(numeroRua) || numeroRua <= 0) {
            setErro("Informe o número da rua.")
            return
        }

        try {
            setSalvando(true)

            await criarEndereco({
                rua: numeroRua,
                bloco: parseInt(bloco, 10) || 1,
                andar: parseInt(andar, 10) || 1,
                lado,
                zona: zona.trim(),
                tipo,
                capacidade: parseInt(capacidade, 10) || 0,
                descricao: descricao.trim(),
            })

            setAviso("Endereço cadastrado.")
            setRua("")
            setBloco("")
            setAndar("")
            setLado("A")
            setZona("")
            setCapacidade("")
            setDescricao("")
            setAberto(false)
            atualizar()

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível cadastrar o endereço")
        } finally {
            setSalvando(false)
        }
    }

    async function alternarBloqueio(endereco: EnderecoEstoque) {
        setErro("")

        const motivo = endereco.bloqueado
            ? ""
            : (window.prompt("Por que este endereço está sendo bloqueado?") ?? "").trim()

        try {
            await bloquearEndereco(endereco.id, !endereco.bloqueado, motivo)
            setAviso(endereco.bloqueado ? "Endereço liberado." : "Endereço bloqueado.")
            atualizar()
        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível mudar o bloqueio")
        }
    }

    if (carregando) {
        return (
            <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">
                <p className="text-[#5A6469]">Carregando endereços...</p>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">
            <div className="mx-auto max-w-4xl space-y-6">

                <div className="flex flex-wrap items-start justify-between gap-4">

                    <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469]">
                            Estoque
                        </p>
                        <h1 className="font-display text-2xl text-[#1E2428]">
                            Endereços
                        </h1>
                        <p className="mt-1 max-w-2xl text-sm text-[#5A6469]">
                            Os lugares do seu estoque: para que serve cada um, quanto cabe e se
                            está liberado. É por este cadastro que o sistema decide sozinho onde
                            guardar o que entra.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setAberto((v) => !v)}
                        className="btn btn-primario flex items-center gap-2"
                    >
                        <FiPlus className="w-4" aria-hidden />
                        {aberto ? "Fechar" : "Novo endereço"}
                    </button>

                </div>

                {erro && (
                    <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]">
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {aviso && (
                    <div role="status" className="flex items-start gap-2.5 rounded-lg bg-[#E7F8EE] px-4 py-3 text-sm font-semibold text-[#1E9E5A]">
                        <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{aviso}</span>
                    </div>
                )}

                {aberto && (
                    <form onSubmit={cadastrar} className="card space-y-4 p-5 sm:p-6">

                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

                            <div className="space-y-1.5">
                                <label className="rotulo" htmlFor="rua">Rua</label>
                                <input
                                    id="rua"
                                    type="number"
                                    min="1"
                                    value={rua}
                                    onChange={(e) => setRua(e.target.value)}
                                    className="field num"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="rotulo" htmlFor="bloco">Bloco</label>
                                <input
                                    id="bloco"
                                    type="number"
                                    min="1"
                                    value={bloco}
                                    onChange={(e) => setBloco(e.target.value)}
                                    placeholder="1"
                                    className="field num"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="rotulo" htmlFor="andar">Andar</label>
                                <input
                                    id="andar"
                                    type="number"
                                    min="1"
                                    value={andar}
                                    onChange={(e) => setAndar(e.target.value)}
                                    placeholder="1"
                                    className="field num"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="rotulo" htmlFor="lado">Lado</label>
                                <select
                                    id="lado"
                                    value={lado}
                                    onChange={(e) => setLado(e.target.value as LadoDaPrateleira)}
                                    className="field cursor-pointer"
                                >
                                    {LADOS.map((opcao) => (
                                        <option key={opcao} value={opcao}>
                                            Lado {opcao}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="rotulo" htmlFor="capacidade">Capacidade</label>
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

                            <div className="space-y-1.5">
                                <label className="rotulo" htmlFor="tipo">Serve para</label>
                                <select
                                    id="tipo"
                                    value={tipo}
                                    onChange={(e) => setTipo(e.target.value as TipoEndereco)}
                                    className="field cursor-pointer"
                                >
                                    {TIPOS_ENDERECO.map((item) => (
                                        <option key={item.chave} value={item.chave}>
                                            {item.nome}
                                        </option>
                                    ))}
                                </select>
                            </div>

                        </div>

                        <p className="text-xs text-[#5A6469]">
                            Só a rua é obrigatória. Bloco e andar em branco valem 1 e o lado nasce
                            no A — é o estoque de quem ainda não subdividiu as prateleiras, e a
                            estrutura só cresce quando o estoque cresce. O código sai daí pronto
                            (<span className="num">001.005.01.A</span> é a rua 1, bloco 5, andar 1,
                            lado A), para caber na etiqueta.
                        </p>

                        <p className="text-xs text-[#5A6469]">
                            {TIPOS_ENDERECO.find((item) => item.chave === tipo)?.descricao}
                        </p>

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="zona">Zona</label>
                            <input
                                id="zona"
                                type="text"
                                value={zona}
                                onChange={(e) => setZona(e.target.value)}
                                placeholder="Ex: mezanino, fundo da loja"
                                className="field"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="descricao">Descrição</label>
                            <input
                                id="descricao"
                                type="text"
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                placeholder="Ex: prateleira do fundo, ao lado da porta"
                                className="field"
                            />
                        </div>

                        <button type="submit" disabled={salvando} className="btn btn-primario">
                            {salvando ? "Cadastrando..." : "Cadastrar endereço"}
                        </button>

                    </form>
                )}

                <ul className="space-y-3">
                    {enderecos.map((endereco) => (
                        <li key={endereco.id} className="card p-5">

                            <div className="flex flex-wrap items-start justify-between gap-3">

                                <div className="min-w-0">

                                    <p className="flex items-center gap-2 font-display text-base text-[#1E2428]">
                                        <FiMapPin className="w-4 shrink-0 text-[#0086FF]" aria-hidden />
                                        <span className="num">{endereco.codigo}</span>
                                    </p>

                                    <p className="mt-0.5 text-sm text-[#5A6469]">
                                        {endereco.nome}
                                        {endereco.zona ? ` · ${endereco.zona}` : ""}
                                    </p>

                                    <p className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className={`tag ${COR_DO_TIPO[endereco.tipo] ?? "tag-neutral"}`}>
                                            {endereco.tipo_nome}
                                        </span>

                                        {endereco.bloqueado && (
                                            <span className="tag tag-neutral">
                                                <FiLock className="w-3" aria-hidden />
                                                bloqueado
                                            </span>
                                        )}
                                    </p>

                                    {endereco.descricao && (
                                        <p className="mt-1 text-sm text-[#5A6469]">{endereco.descricao}</p>
                                    )}

                                    {endereco.bloqueado && endereco.motivo_bloqueio && (
                                        <p className="mt-1 text-sm text-[#D4351C]">
                                            {endereco.motivo_bloqueio}
                                        </p>
                                    )}

                                </div>

                                <div className="shrink-0 text-right">

                                    <p className="num font-bold text-[#1E2428]">
                                        {endereco.ocupacao}
                                        {endereco.capacidade > 0 ? ` / ${endereco.capacidade}` : ""} peça(s)
                                    </p>

                                    {typeof endereco.ocupacao_percentual === "number" && (
                                        <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-[#E4E9EB]">
                                            <div
                                                className={`h-full ${
                                                    endereco.ocupacao_percentual >= 100
                                                        ? "bg-[#D4351C]"
                                                        : endereco.ocupacao_percentual >= 80
                                                            ? "bg-[#B25E00]"
                                                            : "bg-[#1E9E5A]"
                                                }`}
                                                style={{ width: `${Math.min(endereco.ocupacao_percentual, 100)}%` }}
                                            />
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => alternarBloqueio(endereco)}
                                        className="btn btn-neutro mt-3 flex items-center gap-2 text-sm"
                                    >
                                        {endereco.bloqueado ? (
                                            <>
                                                <FiUnlock className="w-3.5" aria-hidden />
                                                Liberar
                                            </>
                                        ) : (
                                            <>
                                                <FiLock className="w-3.5" aria-hidden />
                                                Bloquear
                                            </>
                                        )}
                                    </button>

                                </div>

                            </div>

                        </li>
                    ))}
                </ul>

            </div>
        </main>
    )
}
