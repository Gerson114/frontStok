"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { FiMapPin, FiMessageSquare, FiStar } from "react-icons/fi"
import { Pagina, Secao } from "@/app/components/pagina/pagina"
import { formatarMoeda } from "@/app/components/preco/preco"
import { telefoneLegivel } from "@/app/components/contato/telefone"
import { historicoDoCliente, type Historico } from "@/middleware/clientes"
import PrivacidadeDoCliente from "./privacidade"

/**
 * O histórico de um cliente: tudo o que a loja sabe sobre uma pessoa.
 *
 * A ordem responde às perguntas na ordem em que elas são feitas — quanto essa
 * pessoa vale, para onde a mercadoria vai, o que ela já comprou e o que ela
 * achou. Nada aqui é gravado: quem muda situação de pedido é a tela de
 * Pedidos, quem responde no chat é a de Atendimento. Duas telas gravando a
 * mesma coisa é o caminho mais curto para duas telas discordarem.
 */

const STATUS_LABEL: Record<string, string> = {
    pendente: "Recebido",
    confirmado: "Preparando",
    enviado: "Enviado",
    entregue: "Entregue",
    cancelado: "Cancelado",
}

const STATUS_TAG: Record<string, string> = {
    pendente: "tag-warning",
    confirmado: "tag-info",
    enviado: "tag-info",
    entregue: "tag-success",
    cancelado: "tag-danger",
}

function dataHora(iso: string): string {
    return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function data(iso: string | null): string {
    return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—"
}

export default function HistoricoDoClientePage() {

    // Como as outras telas de detalhe do painel: o id vem do endereço, lido
    // pelo próprio roteador.
    const { id } = useParams<{ id: string }>()

    const [dados, setDados] = useState<Historico | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    useEffect(() => {

        let vivo = true

        async function buscar() {
            try {
                const historico = await historicoDoCliente(Number(id))
                if (vivo) setDados(historico)
            } catch (e) {
                if (vivo) setErro(e instanceof Error ? e.message : "Não foi possível carregar o cliente.")
            } finally {
                if (vivo) setCarregando(false)
            }
        }

        void buscar()

        return () => {
            vivo = false
        }
    }, [id])

    if (carregando) {
        return (
            <Pagina titulo="Cliente" volta={{ nome: "Clientes", rota: "/page/clientes" }}>
                <div className="card p-8 text-center text-sm text-[var(--ink-2)]">Carregando o histórico...</div>
            </Pagina>
        )
    }

    if (erro || !dados) {
        return (
            <Pagina titulo="Cliente" volta={{ nome: "Clientes", rota: "/page/clientes" }}>
                <div role="alert" className="rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                    {erro || "Cliente não encontrado."}
                </div>
            </Pagina>
        )
    }

    const { cliente, resumo, pedidos, enderecos, avaliacoes, conversa } = dados

    return (
        <Pagina
            titulo={cliente.nome || "Cliente"}
            descricao={
                <>
                    {cliente.contato.includes("@") ? cliente.contato : telefoneLegivel(cliente.contato)}
                    {" · cliente desde "}
                    {data(cliente.cliente_desde)}
                    {!cliente.tem_conta ? " · cadastrado pela loja" : ""}
                </>
            }
            volta={{ nome: "Clientes", rota: "/page/clientes" }}
            acoes={
                conversa.id ? (
                    <Link href="/page/atendimento" className="btn btn-neutro">
                        <FiMessageSquare className="w-4" aria-hidden />
                        {conversa.nao_lidas ? `${conversa.nao_lidas} sem ler` : "Ver conversa"}
                    </Link>
                ) : null
            }
        >

            {/* O QUE ESSA PESSOA VALE */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Numero rotulo="Pedidos" valor={String(resumo.pedidos)} />
                <Numero rotulo="Total comprado" valor={formatarMoeda(resumo.total_gasto)} />
                <Numero rotulo="Ticket médio" valor={formatarMoeda(resumo.ticket_medio)} />
                <Numero
                    rotulo="Primeiro e último"
                    valor={`${data(resumo.primeiro_pedido)} → ${data(resumo.ultimo_pedido)}`}
                    miudo
                />
            </div>

            {/* PARA ONDE MANDAR */}
            {enderecos.length > 0 && (
                <Secao
                    titulo="Endereços usados"
                    descricao="Os endereços dos pedidos desta pessoa, do mais recente para o mais antigo. O endereço fica gravado no pedido: quem mudou de casa não mudou para onde o pedido de março foi."
                >
                    <ul className="space-y-2.5">
                        {enderecos.map((endereco, indice) => (
                            <li key={indice} className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
                                <FiMapPin className="mt-1 w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />
                                <span>
                                    {endereco.logradouro}, {endereco.numero}
                                    {endereco.complemento ? ` — ${endereco.complemento}` : ""}
                                    <span className="text-[var(--ink-2)]">
                                        {" · "}
                                        {endereco.bairro}, {endereco.cidade}
                                        {endereco.uf ? `/${endereco.uf}` : ""}
                                        {endereco.cep ? ` · CEP ${endereco.cep}` : ""}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </Secao>
            )}

            {/* O QUE ELA COMPROU */}
            <Secao
                titulo={`Pedidos (${pedidos.length})`}
                descricao="Todos, inclusive os cancelados e os que ficaram sem pagamento — eles contam a história, mesmo ficando de fora das somas lá em cima."
                plano
            >
                {pedidos.length === 0 ? (
                    <p className="px-5 py-6 text-center text-sm text-[var(--ink-3)]">
                        Esta pessoa ainda não fez nenhum pedido.
                    </p>
                ) : (
                    <ul className="divide-y divide-[var(--linha-suave)]">
                        {pedidos.map((pedido) => (
                            <li key={pedido.id} className="px-5 py-4">

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                    <span className="num text-sm font-semibold text-[var(--ink)]">
                                        #{pedido.codigo}
                                    </span>

                                    <span className={`tag ${STATUS_TAG[pedido.status] ?? "tag-neutral"}`}>
                                        {STATUS_LABEL[pedido.status] ?? pedido.status}
                                    </span>

                                    {pedido.pagamento_status === "aguardando" && (
                                        <span className="tag tag-warning">Sem pagamento</span>
                                    )}

                                    <span className="text-xs text-[var(--ink-3)]">{dataHora(pedido.created_at)}</span>

                                    <span className="text-xs text-[var(--ink-2)]">
                                        {pedido.entrega_tipo === "entrega"
                                            ? `Entrega · ${pedido.cidade}${pedido.uf ? `/${pedido.uf}` : ""}`
                                            : "Retirada na loja"}
                                    </span>

                                    <span className="num ml-auto text-sm font-semibold text-[var(--ink)]">
                                        {formatarMoeda(pedido.total)}
                                    </span>
                                </div>

                                <ul className="mt-2 space-y-0.5">
                                    {pedido.itens.map((item, indice) => (
                                        <li key={indice} className="text-xs text-[var(--ink-2)]">
                                            <span className="num">{item.quantidade}x</span>{" "}
                                            {item.produto_nome || `Produto #${item.produto_id}`}
                                            <span className="num text-[var(--ink-3)]">
                                                {" · "}
                                                {formatarMoeda(item.preco)} cada
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                            </li>
                        ))}
                    </ul>
                )}
            </Secao>

            {/* O QUE ELA ACHOU */}
            {avaliacoes.length > 0 && (
                <Secao
                    titulo={`Avaliações (${avaliacoes.length})`}
                    descricao="O que esta pessoa escreveu sobre o que recebeu. Aparece na página do produto, na vitrine."
                    plano
                >
                    <ul className="divide-y divide-[var(--linha-suave)]">
                        {avaliacoes.map((avaliacao, indice) => (
                            <li key={indice} className="px-5 py-3.5">

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="flex items-center gap-0.5">
                                        {[1, 2, 3, 4, 5].map((valor) => (
                                            <FiStar
                                                key={valor}
                                                aria-hidden
                                                className={`w-3.5 ${
                                                    valor <= avaliacao.nota
                                                        ? "fill-current text-[var(--ink)]"
                                                        : "text-[#D1D1D1]"
                                                }`}
                                            />
                                        ))}
                                        <span className="sr-only">nota {avaliacao.nota} de 5</span>
                                    </span>

                                    <span className="text-sm text-[var(--ink)]">
                                        {avaliacao.produto_nome || `Produto #${avaliacao.produto_id}`}
                                    </span>

                                    <span className="num text-xs text-[var(--ink-3)]">
                                        {data(avaliacao.criada_em)}
                                    </span>
                                </div>

                                {avaliacao.comentario && (
                                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-[var(--ink-2)]">
                                        {avaliacao.comentario}
                                    </p>
                                )}

                            </li>
                        ))}
                    </ul>
                </Secao>
            )}

            <PrivacidadeDoCliente id={cliente.id} nome={cliente.nome} />

        </Pagina>
    )
}

function Numero({ rotulo, valor, miudo = false }: { rotulo: string; valor: string; miudo?: boolean }) {
    return (
        <div className="card p-4">
            <p className="text-xs text-[var(--ink-3)]">{rotulo}</p>
            <p className={`num mt-1 font-bold text-[var(--ink)] ${miudo ? "text-sm" : "text-xl"}`}>
                {valor}
            </p>
        </div>
    )
}
