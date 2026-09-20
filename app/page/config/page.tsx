"use client"

import { Suspense, useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
    FiAlertCircle,
    FiArrowRight,
    FiBell,
    FiCheckCircle,
    FiCreditCard,
    FiDollarSign,
    FiGlobe,
    FiPackage,
    FiShoppingBag,
    FiTruck,
    FiUsers,
} from "react-icons/fi"
import type { IconType } from "react-icons"
import { Pagina } from "@/app/components/pagina/pagina"
import { Selecao } from "@/app/components/campo/selecao"
import { ApiError } from "@/middleware/client"
import { consultarConfiguracao, salvarConfiguracao } from "@/middleware/configuracao"
import { assinarSom, somLigado, salvarSomLigado } from "@/app/somNotificacao"
import type { AtendimentoDaLoja, ConfiguracaoDaLoja, LimiteDeCampo, OpcaoDoRamo, RamoDaLoja } from "@/app/type/type"

/**
 * Configurações da loja — referência: a tela de Settings do Stripe.
 *
 * A versão anterior era uma página só: seis seções empilhadas, cada ajuste
 * com o rótulo em cima, o campo embaixo e um parágrafo de quatro linhas
 * explicando o porquê. Tudo no mesmo peso, tudo aberto ao mesmo tempo. Quem
 * queria mudar o prazo de entrega rolava a tela inteira procurando, e o
 * parágrafo sob cada campo — que era a maior parte do texto da tela — é o
 * tique que faz painel parecer gerado em vez de desenhado.
 *
 * O que o Stripe faz, e é o que está aqui: a raiz de Configurações não é um
 * formulário, é um ÍNDICE. Cada grupo é um cartão com o nome, uma linha do
 * que tem dentro e — a parte que faz a tela valer — o VALOR ATUAL escrito
 * nele. Dá para conferir como a loja está configurada sem abrir nada. Clicar
 * abre só aquele grupo, e ali os ajustes são linhas: nome à esquerda,
 * controle à direita, um fio entre cada um.
 *
 * O texto longo saiu de propósito. Cada ajuste tem uma dica de uma linha, e
 * só. O porquê comprido continua existindo onde ele é lido de verdade — no
 * comentário do código e na recusa do servidor, que vem como frase pronta
 * quando o número está fora do limite.
 *
 * O grupo aberto mora no endereço (`?grupo=venda`), e não em estado solto:
 * assim o botão de voltar do navegador funciona e um recarregar não joga a
 * pessoa de volta para o índice.
 *
 * O salvar é um só e manda a configuração inteira, mesmo estando dentro de um
 * grupo — o estado do formulário é compartilhado. É por isso que não há
 * salvar por grupo: dois botões de salvar para o mesmo objeto é a receita de
 * um sobrescrever o outro.
 */

type IdDoGrupo = "geral" | "venda" | "pagamento" | "entrega" | "estoque" | "notificacoes"

/** Os grupos do índice, na ordem em que aparecem. */
const GRUPOS: { id: IdDoGrupo; titulo: string; linha: string; Icone: IconType }[] = [
    {
        id: "geral",
        titulo: "Geral",
        linha: "O fuso que decide onde o dia da loja começa e termina.",
        Icone: FiGlobe,
    },
    {
        id: "venda",
        titulo: "O que você vende",
        linha: "Mercadoria pronta ou comida feita na hora, e a agenda da cozinha.",
        Icone: FiShoppingBag,
    },
    {
        id: "pagamento",
        titulo: "Pagamento do pedido",
        linha: "Entrada, pedido mínimo e quanto tempo o carrinho fica reservado.",
        Icone: FiDollarSign,
    },
    {
        id: "entrega",
        titulo: "Entrega e devolução",
        linha: "Prazo padrão, janela para avisar avaria e o recado no WhatsApp.",
        Icone: FiTruck,
    },
    {
        id: "estoque",
        titulo: "Estoque",
        linha: "A partir de quantos dias sem sair uma unidade conta como parada.",
        Icone: FiPackage,
    },
    {
        id: "notificacoes",
        titulo: "Notificações",
        linha: "O som que avisa, neste computador, quando chega pedido ou mensagem.",
        Icone: FiBell,
    },
]

/** As telas de configuração que têm porta própria. */
const ATALHOS: { rota: string; titulo: string; linha: string; Icone: IconType }[] = [
    {
        rota: "/page/assinatura",
        titulo: "Assinatura",
        linha: "O plano desta conta, a cobrança e a nota.",
        Icone: FiCreditCard,
    },
    {
        rota: "/page/pagamento",
        titulo: "Receber pagamento",
        linha: "Para onde vai o dinheiro das vendas do site.",
        Icone: FiDollarSign,
    },
    {
        rota: "/page/frete",
        titulo: "Frete e entrega",
        linha: "Quanto custa entregar e a partir de quanto sai de graça.",
        Icone: FiTruck,
    },
    {
        rota: "/page/loja",
        titulo: "Meu site",
        linha: "Nome, endereço, cores e a página inicial da vitrine.",
        Icone: FiGlobe,
    },
    {
        rota: "/page/funcionarios",
        titulo: "Funcionários",
        linha: "Quem trabalha aqui e quais telas cada um abre.",
        Icone: FiUsers,
    },
]

export default function Pagina_() {
    // Ler o endereço exige Suspense no App Router.
    return (
        <Suspense fallback={<main className="com-menu min-h-[calc(100dvh-3.5rem)] bg-[var(--fundo)]" />}>
            <Configuracoes />
        </Suspense>
    )
}

function Configuracoes() {

    const router = useRouter()
    const parametros = useSearchParams()

    const pedido = parametros.get("grupo")
    const aberto = GRUPOS.find((grupo) => grupo.id === pedido) ?? null

    const [config, setConfig] = useState<ConfiguracaoDaLoja | null>(null)
    const [limites, setLimites] = useState<Record<string, LimiteDeCampo>>({})
    const [ramos, setRamos] = useState<OpcaoDoRamo[]>([])
    const [atendimentos, setAtendimentos] = useState<OpcaoDoRamo[]>([])
    const [fusos, setFusos] = useState<{ valor: string; nome: string }[]>([])

    const [carregando, setCarregando] = useState(true)
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    // O som fica fora de `config` de propósito — é preferência deste
    // navegador, não da loja (ver app/somNotificacao.ts). `useSyncExternalStore`
    // é o que resolve os dois problemas do `localStorage` de uma vez: ele não
    // existe na primeira passada do servidor (por isso o terceiro argumento,
    // o retrato do lado do servidor, sempre "ligado") e não avisa sozinho
    // quando muda (por isso `assinarSom`, que `salvarSomLigado` aciona).
    const somPedido = useSyncExternalStore(assinarSom, () => somLigado("pedido"), () => true)
    const somMensagem = useSyncExternalStore(assinarSom, () => somLigado("mensagem"), () => true)

    useEffect(() => {

        let valeu = true

        consultarConfiguracao()
            .then((resposta) => {
                if (!valeu) return

                setConfig(resposta.configuracao)
                setLimites(resposta.limites ?? {})
                setFusos(resposta.fusos ?? [])
                setRamos(resposta.ramos ?? [])
                setAtendimentos(resposta.atendimentos ?? [])
            })
            .catch((e: unknown) => {
                if (valeu) setErro(e instanceof Error ? e.message : "Não foi possível carregar a configuração.")
            })
            .finally(() => {
                if (valeu) setCarregando(false)
            })

        return () => {
            valeu = false
        }
    }, [])

    function mudar<C extends keyof ConfiguracaoDaLoja>(campo: C, valor: ConfiguracaoDaLoja[C]) {
        setConfig((atual) => (atual ? { ...atual, [campo]: valor } : atual))
        setAviso("")
    }

    async function salvar(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault()

        if (!config) return

        setSalvando(true)
        setErro("")
        setAviso("")

        try {
            const { mensagem } = await salvarConfiguracao(config)
            setAviso(mensagem ?? "Configuração salva.")
        } catch (e) {
            // A recusa do servidor vem como frase pronta ("o prazo para pagar
            // precisa ficar entre..."), e é ela que a tela mostra: quem
            // conhece a regra é quem a aplica.
            setErro(e instanceof ApiError ? e.message : "Não foi possível salvar a configuração.")
        } finally {
            setSalvando(false)
        }
    }

    /* ----------------------------------------------------------------
       O VALOR ATUAL NO CARTÃO DO ÍNDICE

       É o que separa este índice de um menu: sem ele, a pessoa tem de
       abrir os cinco grupos para saber como a loja está configurada.
       ---------------------------------------------------------------- */
    function resumo(id: IdDoGrupo): string {

        if (id === "notificacoes") {
            if (somPedido && somMensagem) return "Pedido e mensagem"
            if (somPedido) return "Só pedido"
            if (somMensagem) return "Só mensagem"
            return "Sem som"
        }

        if (!config) return ""

        if (id === "geral") {
            return fusos.find((fuso) => fuso.valor === config.fuso)?.nome ?? config.fuso
        }

        if (id === "venda") {
            const ramo = ramos.find((opcao) => opcao.valor === config.ramo)?.nome ?? config.ramo

            if (config.ramo !== "comida") return ramo

            const quando = atendimentos.find((opcao) => opcao.valor === config.atendimento)?.nome
            return quando ? `${ramo} · ${quando}` : ramo
        }

        if (id === "pagamento") {
            const partes = [`${config.minutos_para_pagar} min de carrinho`]

            if (config.aceita_entrada) partes.unshift(`entrada de ${config.percentual_da_entrada}%`)
            if (config.pedido_minimo > 0) partes.push(`mínimo de R$ ${config.pedido_minimo}`)

            return partes.join(" · ")
        }

        if (id === "entrega") {
            return `${config.dias_sem_prazo_prometido} dias de prazo · ${config.dias_para_avisar_avaria} para avisar avaria`
        }

        return `${config.dias_para_considerar_parado} dias sem sair`
    }

    /* ================================================================
       O ÍNDICE
       ================================================================ */
    if (!aberto) {
        return (
            <Pagina
                titulo="Configurações"
                descricao="As regras que valem nesta loja. Cada cartão mostra como está agora — abra para mudar."
            >
                {erro && <Alerta tipo="erro">{erro}</Alerta>}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {GRUPOS.map((grupo) => (
                        <button
                            key={grupo.id}
                            type="button"
                            onClick={() => router.push(`/page/config?grupo=${grupo.id}`)}
                            className="card group flex flex-col p-5 text-left transition-colors hover:border-[var(--azul)]"
                        >
                            <span className="flex h-9 w-9 items-center justify-center bg-[var(--azul-suave)] text-[var(--azul-escuro)]">
                                <grupo.Icone className="w-4" aria-hidden />
                            </span>

                            <span className="font-display mt-3.5 text-sm text-[var(--ink)]">
                                {grupo.titulo}
                            </span>

                            <span className="mt-1 text-xs leading-relaxed text-[var(--ink-2)]">
                                {grupo.linha}
                            </span>

                            {/* O estado atual, encostado no rodapé do cartão para
                                que os seis cartões o mostrem na mesma altura
                                mesmo com a linha de cima ocupando uma ou duas. */}
                            <span className="mt-auto flex items-center gap-1.5 pt-4 text-xs font-semibold text-[var(--azul)]">
                                {carregando ? (
                                    <span className="inline-block h-3 w-24 animate-pulse bg-[var(--linha)]" />
                                ) : (
                                    <>
                                        <span className="num truncate">{resumo(grupo.id)}</span>
                                        <FiArrowRight
                                            className="w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                                            aria-hidden
                                        />
                                    </>
                                )}
                            </span>
                        </button>
                    ))}
                </div>

                <div>
                    <h2 className="font-display mb-3 mt-2 text-sm text-[var(--ink)]">
                        Tem tela própria
                    </h2>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {ATALHOS.map((atalho) => (
                            <Link
                                key={atalho.rota}
                                href={atalho.rota}
                                className="card group flex items-start gap-3 p-4 transition-colors hover:border-[var(--azul)]"
                            >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--fundo)] text-[var(--ink-2)]">
                                    <atalho.Icone className="w-4" aria-hidden />
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-[var(--ink)]">{atalho.titulo}</span>
                                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-2)]">
                                        {atalho.linha}
                                    </span>
                                </span>

                                <FiArrowRight
                                    className="mt-1 w-4 shrink-0 text-[var(--ink-4)] transition-transform group-hover:translate-x-0.5"
                                    aria-hidden
                                />
                            </Link>
                        ))}
                    </div>
                </div>
            </Pagina>
        )
    }

    /* ================================================================
       NOTIFICAÇÕES — o único grupo que não fala com o servidor

       Sem form, sem botão de salvar: a chave já escreve no localStorage (ver
       app/somNotificacao.ts) no instante em que é virada, porque não há
       "salvar depois" para uma preferência deste navegador — outra loja
       aberta aqui do lado não tem por que herdar o clique de ninguém.
       ================================================================ */
    if (aberto.id === "notificacoes") {
        return (
            <Pagina
                titulo={aberto.titulo}
                descricao={aberto.linha}
                volta={{ nome: "Configurações", rota: "/page/config" }}
            >
                <div className="card max-w-3xl">
                    <Linha
                        nome="Som ao chegar pedido"
                        dica="Um som diferente do de mensagem — pedido é venda entrando."
                    >
                        <Chave
                            ligada={somPedido}
                            aoMudar={(v) => salvarSomLigado("pedido", v)}
                            rotulo="Tocar som quando chegar um pedido novo"
                        />
                    </Linha>

                    <Linha
                        nome="Som ao chegar mensagem"
                        dica="Vale para WhatsApp, chat do site e conversa da equipe."
                    >
                        <Chave
                            ligada={somMensagem}
                            aoMudar={(v) => salvarSomLigado("mensagem", v)}
                            rotulo="Tocar som quando chegar uma mensagem"
                        />
                    </Linha>
                </div>

                <p className="mt-3 max-w-3xl text-xs text-[var(--ink-3)]">
                    Vale só para este computador. Em outro aparelho, ajuste aqui de novo.
                </p>
            </Pagina>
        )
    }

    /* ================================================================
       UM GRUPO
       ================================================================ */
    return (
        <Pagina
            titulo={aberto.titulo}
            descricao={aberto.linha}
            volta={{ nome: "Configurações", rota: "/page/config" }}
        >
            {erro && <Alerta tipo="erro">{erro}</Alerta>}
            {aviso && <Alerta tipo="ok">{aviso}</Alerta>}

            {carregando || !config ? (
                <div className="card h-64 animate-pulse bg-[var(--fundo)]" />
            ) : (
                <form onSubmit={salvar} className="max-w-3xl space-y-4">

                    <div className="card">

                        {aberto.id === "geral" && (
                            <Linha nome="Fuso horário" dica="Decide em qual dia a venda da noite entra.">
                                <Selecao
                                    id="fuso"
                                    value={config.fuso}
                                    onChange={(e) => mudar("fuso", e.target.value)}
                                    className="w-56"
                                >
                                    {fusos.map((fuso) => (
                                        <option key={fuso.valor} value={fuso.valor}>
                                            {fuso.nome}
                                        </option>
                                    ))}
                                </Selecao>
                            </Linha>
                        )}

                        {aberto.id === "venda" && (
                            <>
                                <Linha
                                    nome="Ramo da loja"
                                    dica={ramos.find((opcao) => opcao.valor === config.ramo)?.explicacao}
                                >
                                    <Selecao
                                        id="ramo"
                                        value={config.ramo}
                                        onChange={(e) => mudar("ramo", e.target.value as RamoDaLoja)}
                                        className="w-56"
                                    >
                                        {ramos.map((opcao) => (
                                            <option key={opcao.valor} value={opcao.valor}>
                                                {opcao.nome}
                                            </option>
                                        ))}
                                    </Selecao>
                                </Linha>

                                {/* Os campos de cozinha só aparecem quando a loja é
                                    de comida. Mostrá-los desabilitados para quem
                                    vende ventilador seria encher a tela de pergunta
                                    que nunca vai ser respondida. */}
                                {config.ramo === "comida" && (
                                    <>
                                        <Linha
                                            nome="Quando o pedido sai"
                                            dica={atendimentos.find((opcao) => opcao.valor === config.atendimento)?.explicacao}
                                        >
                                            <Selecao
                                                id="atendimento"
                                                value={config.atendimento}
                                                onChange={(e) => mudar("atendimento", e.target.value as AtendimentoDaLoja)}
                                                className="w-56"
                                            >
                                                {atendimentos.map((opcao) => (
                                                    <option key={opcao.valor} value={opcao.valor}>
                                                        {opcao.nome}
                                                    </option>
                                                ))}
                                            </Selecao>
                                        </Linha>

                                        {/* Numa cozinha que só trabalha agendada não
                                            há "fica pronto em 40 minutos" — há a hora
                                            que o cliente marcou. */}
                                        {config.atendimento !== "agendado" && (
                                            <Numero
                                                id="minutos_de_preparo"
                                                nome="Tempo de preparo"
                                                dica="O que a vitrine promete a quem pede para agora."
                                                valor={config.minutos_de_preparo}
                                                limite={limites.minutos_de_preparo}
                                                sufixo="min"
                                                aoMudar={(valor) => mudar("minutos_de_preparo", valor)}
                                            />
                                        )}

                                        {config.atendimento !== "na_hora" && (
                                            <>
                                                <Numero
                                                    id="minutos_de_antecedencia"
                                                    nome="Antecedência para agendar"
                                                    dica="O mínimo entre o pedido e a hora marcada."
                                                    valor={config.minutos_de_antecedencia}
                                                    limite={limites.minutos_de_antecedencia}
                                                    sufixo="min"
                                                    aoMudar={(valor) => mudar("minutos_de_antecedencia", valor)}
                                                />

                                                <Numero
                                                    id="dias_para_agendar"
                                                    nome="Agenda aberta até"
                                                    dica="Agenda longa demais vira pedido que ninguém confirma."
                                                    valor={config.dias_para_agendar}
                                                    limite={limites.dias_para_agendar}
                                                    sufixo="dias"
                                                    aoMudar={(valor) => mudar("dias_para_agendar", valor)}
                                                />
                                            </>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {aberto.id === "pagamento" && (
                            <>
                                <Numero
                                    id="minutos_para_pagar"
                                    nome="Carrinho reservado por"
                                    dica="Enquanto espera pagamento, as unidades somem da prateleira."
                                    valor={config.minutos_para_pagar}
                                    limite={limites.minutos_para_pagar}
                                    sufixo="min"
                                    aoMudar={(valor) => mudar("minutos_para_pagar", valor)}
                                />

                                <Numero
                                    id="pedido_minimo"
                                    nome="Pedido mínimo"
                                    dica="Conta só a mercadoria, sem o frete. Zero é sem mínimo."
                                    valor={config.pedido_minimo}
                                    prefixo="R$"
                                    sufixo=""
                                    decimal
                                    aoMudar={(valor) => mudar("pedido_minimo", valor)}
                                />

                                {/* Não é de comida: é de quem vende o que demora a
                                    sair da loja — o bolo de casamento, o móvel sob
                                    medida, a festa. */}
                                <Linha
                                    nome="Aceitar entrada, resto na entrega"
                                    dica="O cliente paga uma parte pelo site e acerta o resto com você."
                                >
                                    <Chave
                                        ligada={config.aceita_entrada}
                                        aoMudar={(v) => mudar("aceita_entrada", v)}
                                        rotulo="Aceitar entrada, com o resto na entrega"
                                    />
                                </Linha>

                                {config.aceita_entrada && (
                                    <Numero
                                        id="percentual_da_entrada"
                                        nome="Quanto o cliente paga adiantado"
                                        dica="Metade é o costume."
                                        valor={config.percentual_da_entrada}
                                        limite={limites.percentual_da_entrada}
                                        sufixo="%"
                                        aoMudar={(valor) => mudar("percentual_da_entrada", valor)}
                                    />
                                )}
                            </>
                        )}

                        {aberto.id === "entrega" && (
                            <>
                                <Numero
                                    id="dias_sem_prazo_prometido"
                                    nome="Prazo padrão de entrega"
                                    dica="A partir daqui o pedido conta como atrasado no painel."
                                    valor={config.dias_sem_prazo_prometido}
                                    limite={limites.dias_sem_prazo_prometido}
                                    sufixo="dias"
                                    aoMudar={(valor) => mudar("dias_sem_prazo_prometido", valor)}
                                />

                                <Numero
                                    id="dias_para_avisar_avaria"
                                    nome="Prazo para avisar que chegou danificado"
                                    dica="Avaria de transporte se vê ao abrir o pacote."
                                    valor={config.dias_para_avisar_avaria}
                                    limite={limites.dias_para_avisar_avaria}
                                    sufixo="dias"
                                    aoMudar={(valor) => mudar("dias_para_avisar_avaria", valor)}
                                />

                                <Linha
                                    nome="Avisar no WhatsApp quando pedirem devolução"
                                    dica="Serve para o sábado à tarde, com o painel fechado. Precisa do WhatsApp conectado."
                                >
                                    <Chave
                                        ligada={config.avisar_devolucao_no_whatsapp}
                                        aoMudar={(v) => mudar("avisar_devolucao_no_whatsapp", v)}
                                        rotulo="Avisar no WhatsApp da loja quando alguém pedir devolução"
                                    />
                                </Linha>
                            </>
                        )}

                        {aberto.id === "estoque" && (
                            <Numero
                                id="dias_para_considerar_parado"
                                nome="Dias sem sair para contar como parada"
                                dica="Moda gira em semanas; eletrodoméstico, em meses."
                                valor={config.dias_para_considerar_parado}
                                limite={limites.dias_para_considerar_parado}
                                sufixo="dias"
                                aoMudar={(valor) => mudar("dias_para_considerar_parado", valor)}
                            />
                        )}

                    </div>

                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={salvando} className="btn btn-primario">
                            {salvando ? "Salvando..." : "Salvar"}
                        </button>

                        <span className="text-xs text-[var(--ink-3)]">
                            Vale para esta loja. Cada loja da rede tem a sua.
                        </span>
                    </div>

                </form>
            )}
        </Pagina>
    )
}

/** A faixa de erro ou de confirmação, no topo da tela. */
function Alerta({ tipo, children }: { tipo: "erro" | "ok"; children: React.ReactNode }) {

    const erro = tipo === "erro"
    const Icone = erro ? FiAlertCircle : FiCheckCircle

    return (
        <div
            role={erro ? "alert" : "status"}
            className={`flex items-start gap-2.5 px-4 py-3 text-sm font-semibold ${
                erro ? "bg-[var(--vermelho-fundo)] text-[var(--vermelho)]" : "bg-[var(--verde-suave)] text-[var(--verde)]"
            }`}
        >
            <Icone className="mt-0.5 w-4 shrink-0" aria-hidden />
            <span>{children}</span>
        </div>
    )
}

/**
 * Um ajuste: o nome à esquerda, o controle à direita, um fio embaixo.
 *
 * A dica é de UMA linha por regra. Quando ela cresce para um parágrafo, o
 * lugar dela não é a tela — é o comentário do código ou a mensagem que o
 * servidor devolve ao recusar o valor.
 */
function Linha({ nome, dica, children }: { nome: string; dica?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-3 border-b border-[var(--linha-suave)] px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--ink)]">{nome}</p>
                {dica && <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-2)]">{dica}</p>}
            </div>

            <div className="shrink-0">{children}</div>
        </div>
    )
}

/**
 * Uma linha cujo controle é um número com unidade e o limite ao lado.
 *
 * O sufixo ocupa largura fixa mesmo quando é vazio, e é de propósito: é ele
 * que mantém a borda direita de todos os campos na mesma coluna. Sem isso,
 * "R$ 0" e "30 min" terminam em lugares diferentes e a lista deixa de ler
 * como uma tabela.
 */
function Numero({ id, nome, dica, valor, limite, prefixo, sufixo, decimal, aoMudar }: {
    id: string
    nome: string
    dica: string
    valor: number
    limite?: LimiteDeCampo
    prefixo?: string
    sufixo: string
    decimal?: boolean
    aoMudar: (valor: number) => void
}) {
    return (
        <Linha nome={nome} dica={dica}>
            <div className="flex items-center gap-2">
                {/* O limite fica à vista em vez de só recusar depois de salvar.
                    Quem decide continua sendo o servidor — isto é o aviso, não
                    a regra. */}
                {limite && (
                    <span className="num hidden text-xs text-[var(--ink-3)] sm:inline">
                        {limite.minimo}–{limite.maximo}
                    </span>
                )}

                {prefixo && <span className="text-sm text-[var(--ink-2)]">{prefixo}</span>}

                <input
                    id={id}
                    type="number"
                    inputMode={decimal ? "decimal" : "numeric"}
                    step={decimal ? "0.01" : undefined}
                    value={valor}
                    min={limite?.minimo ?? (decimal ? 0 : undefined)}
                    max={limite?.maximo}
                    onChange={(e) => aoMudar(Number(e.target.value))}
                    className="field num w-24 text-right"
                />

                <span className="w-9 text-sm text-[var(--ink-2)]">{sufixo}</span>
            </div>
        </Linha>
    )
}

/**
 * O liga-desliga.
 *
 * Era uma caixa de marcar com o rótulo e um parágrafo ao lado dela. Virou
 * chave porque numa lista de ajustes o olho procura o estado na mesma
 * coluna: a caixa marcada some no meio do texto, a chave não.
 */
function Chave({ ligada, aoMudar, rotulo }: { ligada: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={ligada}
            aria-label={rotulo}
            onClick={() => aoMudar(!ligada)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                ligada ? "bg-[var(--azul)]" : "bg-[var(--ink-4)]"
            }`}
        >
            <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--superficie)] shadow-sm transition-[left] ${
                    ligada ? "left-[1.375rem]" : "left-0.5"
                }`}
            />
        </button>
    )
}
