"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { FiMessageSquare, FiSearch, FiUsers, FiX } from "react-icons/fi"
import { Pagina, Estado } from "@/app/components/pagina/pagina"
import Pagination from "@/app/components/pagination/pagination"
import { formatarMoeda } from "@/app/components/preco/preco"
import { telefoneLegivel } from "@/app/components/contato/telefone"
import { listarClientes, type ClienteResumo } from "@/middleware/clientes"

/**
 * Clientes.
 *
 * O painel sabia dizer o que foi vendido e não sabia dizer para quem. Esta
 * tela é a mesma informação dos pedidos agrupada pela PESSOA — que é a
 * pergunta de quem quer vender de novo para quem já comprou, e não só
 * despachar o pedido de hoje.
 *
 * A ordem padrão é por quem comprou mais recentemente, e não por nome: uma
 * lista alfabética é um catálogo, e o que o lojista abre para ver é quem
 * esteve aqui esta semana. As somas contam só o que virou venda — cancelado e
 * carrinho abandonado ficam de fora, senão a lista promoveria a bom cliente
 * quem nunca pagou nada.
 */

const POR_PAGINA = 20

type Ordem = "recentes" | "gastaram" | "nome"

const ORDENS: { chave: Ordem; nome: string }[] = [
    { chave: "recentes", nome: "Compraram por último" },
    { chave: "gastaram", nome: "Gastaram mais" },
    { chave: "nome", nome: "Nome" },
]

function data(iso: string | null): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("pt-BR")
}

export default function ClientesPage() {

    const [clientes, setClientes] = useState<ClienteResumo[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [busca, setBusca] = useState("")
    const [ordem, setOrdem] = useState<Ordem>("recentes")
    const [pagina, setPagina] = useState(1)

    useEffect(() => {

        let vivo = true

        async function buscar() {
            try {
                const lista = await listarClientes()
                if (vivo) setClientes(lista)
            } catch (e) {
                if (vivo) setErro(e instanceof Error ? e.message : "Não foi possível carregar os clientes.")
            } finally {
                if (vivo) setCarregando(false)
            }
        }

        void buscar()

        return () => {
            vivo = false
        }
    }, [])

    const filtrados = useMemo(() => {

        const termo = busca.trim().toLowerCase()
        const digitos = termo.replace(/\D+/g, "")

        const lista = termo
            ? clientes.filter((cliente) =>
                cliente.nome.toLowerCase().includes(termo) ||
                cliente.contato.toLowerCase().includes(termo) ||
                (digitos.length >= 3 && cliente.contato.replace(/\D+/g, "").includes(digitos)))
            : [...clientes]

        return lista.sort((um, outro) => {

            if (ordem === "nome") return um.nome.localeCompare(outro.nome, "pt-BR")

            if (ordem === "gastaram") return outro.total_gasto - um.total_gasto

            // Quem nunca comprou vai para o fim: a lista é de quem compra.
            const dele = um.ultimo_pedido ? new Date(um.ultimo_pedido).getTime() : 0
            const doOutro = outro.ultimo_pedido ? new Date(outro.ultimo_pedido).getTime() : 0

            return doOutro - dele
        })

    }, [clientes, busca, ordem])

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
    const paginaAtual = Math.min(pagina, totalPaginas)

    const daPagina = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

    // As somas da loja inteira, no cabeçalho: é o retrato que a tela dá de
    // graça, e é o número que o lojista repete quando alguém pergunta como
    // vai a loja.
    const totais = useMemo(() => {

        const compradores = clientes.filter((cliente) => cliente.pedidos > 0)
        const faturado = compradores.reduce((soma, cliente) => soma + cliente.total_gasto, 0)

        return {
            compradores: compradores.length,
            faturado,
            recorrentes: compradores.filter((cliente) => cliente.pedidos > 1).length,
        }
    }, [clientes])

    return (
        <Pagina
            titulo="Clientes"
            descricao="Quem compra na sua loja, e o que cada um já fez nela. As somas contam só o que virou venda."
        >

            {erro && (
                <div role="alert" className="rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]">
                    {erro}
                </div>
            )}

            {carregando ? (
                <div className="card p-8 text-center text-sm text-[#616161]">Carregando os clientes...</div>
            ) : clientes.length === 0 ? (
                <Estado
                    Icone={FiUsers}
                    titulo="Nenhum cliente ainda"
                    texto="Cada pessoa que cria conta na sua vitrine, ou que você cadastra ao lançar um pedido de fora, aparece aqui com o histórico dela."
                    acao={
                        <Link href="/page/pedidos" className="btn btn-neutro">
                            Ver pedidos
                        </Link>
                    }
                />
            ) : (
                <>
                    {/* O RETRATO */}
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Numero rotulo="Clientes que compraram" valor={String(totais.compradores)} />
                        <Numero rotulo="Compraram mais de uma vez" valor={String(totais.recorrentes)} />
                        <Numero rotulo="Total comprado por eles" valor={formatarMoeda(totais.faturado)} />
                    </div>

                    {/* BUSCA E ORDEM */}
                    <div className="flex flex-wrap items-center gap-3">

                        <div className="relative min-w-[14rem] flex-1">
                            <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8A8A8A]" aria-hidden />

                            <label className="sr-only" htmlFor="busca-clientes">Buscar cliente</label>

                            <input
                                id="busca-clientes"
                                value={busca}
                                onChange={(e) => {
                                    setBusca(e.target.value)
                                    setPagina(1)
                                }}
                                placeholder="Nome, e-mail ou telefone"
                                className="field pl-9"
                            />

                            {busca && (
                                <button
                                    type="button"
                                    onClick={() => setBusca("")}
                                    aria-label="Limpar busca"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#303030]"
                                >
                                    <FiX className="w-4" aria-hidden />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5">
                            {ORDENS.map((opcao) => (
                                <button
                                    key={opcao.chave}
                                    type="button"
                                    onClick={() => setOrdem(opcao.chave)}
                                    aria-pressed={ordem === opcao.chave}
                                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                                        ordem === opcao.chave
                                            ? "border-[#303030] bg-[#303030] text-white"
                                            : "border-[#E1E1E1] text-[#616161] hover:border-[#303030]"
                                    }`}
                                >
                                    {opcao.nome}
                                </button>
                            ))}
                        </div>

                    </div>

                    {/* A LISTA */}
                    {daPagina.length === 0 ? (
                        <div className="card p-8 text-center text-sm text-[#616161]">
                            Nenhum cliente encontrado para “{busca}”.
                        </div>
                    ) : (
                        <div className="card overflow-hidden">
                            <ul className="divide-y divide-[#EBEBEB]">
                                {daPagina.map((cliente) => (
                                    <li key={cliente.id}>
                                        <Link
                                            href={`/page/clientes/${cliente.id}`}
                                            className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 transition-colors hover:bg-[#F7F7F7]"
                                        >

                                            <div className="min-w-[12rem] flex-1">
                                                <p className="flex items-center gap-2 text-sm font-semibold text-[#303030]">
                                                    {cliente.nome || "Cliente"}

                                                    {cliente.nao_lidas > 0 && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-[#005BD3] px-2 py-0.5 text-[0.65rem] font-bold text-white">
                                                            <FiMessageSquare className="w-3" aria-hidden />
                                                            {cliente.nao_lidas}
                                                        </span>
                                                    )}

                                                    {!cliente.tem_conta && (
                                                        <span className="tag tag-neutral text-[0.65rem]">sem conta</span>
                                                    )}
                                                </p>

                                                <p className="mt-0.5 text-xs text-[#8A8A8A]">
                                                    {cliente.contato.includes("@")
                                                        ? cliente.contato
                                                        : telefoneLegivel(cliente.contato)}
                                                </p>
                                            </div>

                                            <div className="w-20 text-right">
                                                <p className="num text-sm font-semibold text-[#303030]">
                                                    {cliente.pedidos}
                                                </p>
                                                <p className="text-[0.7rem] text-[#8A8A8A]">
                                                    {cliente.pedidos === 1 ? "pedido" : "pedidos"}
                                                </p>
                                            </div>

                                            <div className="w-32 text-right">
                                                <p className="num text-sm font-semibold text-[#303030]">
                                                    {formatarMoeda(cliente.total_gasto)}
                                                </p>
                                                <p className="text-[0.7rem] text-[#8A8A8A]">comprado</p>
                                            </div>

                                            <div className="w-28 text-right">
                                                <p className="num text-sm text-[#616161]">
                                                    {data(cliente.ultimo_pedido)}
                                                </p>
                                                <p className="text-[0.7rem] text-[#8A8A8A]">último</p>
                                            </div>

                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <Pagination
                        paginaAtual={paginaAtual}
                        totalPaginas={totalPaginas}
                        aoMudarPagina={setPagina}
                    />
                </>
            )}

        </Pagina>
    )
}

/** Um número do retrato da loja. */
function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
    return (
        <div className="card p-4">
            <p className="text-xs text-[#8A8A8A]">{rotulo}</p>
            <p className="num mt-1 text-xl font-bold text-[#303030]">{valor}</p>
        </div>
    )
}
