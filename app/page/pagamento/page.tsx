"use client"

import { useCallback, useEffect, useState } from "react"
import { FiAlertTriangle, FiCheckCircle, FiCreditCard, FiLock } from "react-icons/fi"
import { Pagina, Secao } from "@/app/components/pagina/pagina"
import PagamentoPorWhatsApp from "@/app/components/pagamento/whatsapp"

/**
 * Onde o lojista conecta a conta de pagamento dele.
 *
 * O modelo é "cada loja traz a sua": ela se cadastra no Mercado Pago, gera um
 * access token e cola aqui. O dinheiro das vendas cai direto na conta dela —
 * este sistema não fica no meio do caminho do dinheiro de ninguém.
 *
 * O token vai de ida e nunca volta: o servidor o guarda cifrado com a chave
 * desta loja e devolve só os últimos caracteres, que é o bastante para
 * conferir qual está salvo sem trazer a credencial de volta para a tela.
 */

/** Um provedor que o servidor sabe operar, com as instruções dele. */
interface Provedor {
    /** Como o backend grava este provedor. Vem do servidor junto da ajuda. */
    Chave: string

    Nome: string
    RotuloChave: string
    OndeAcharChave: string
    OndeAcharWebhook: string
    ExemploChave: string

    /**
     * Se este provedor assina as notificações.
     *
     * Falso quer dizer que ele não emite segredo de webhook nenhum — e aí a
     * tela não pede (nem cobra) um. A prova de que o pagamento aconteceu vem
     * de outro lugar naquele caso: o servidor confirma cada aviso direto com
     * o provedor antes de liberar o pedido.
     */
    ExigeSegredoWebhook: boolean
}

interface Situacao {
    conectado: boolean
    provedor: string
    sufixo?: string
    ativo?: boolean
    webhook_configurado?: boolean
    disponiveis?: Provedor[]

    /** Configuração do SERVIDOR, não da loja: os endereços públicos existem? */
    enderecos_ok?: boolean

    /** O endereço que o lojista cadastra no painel do provedor. */
    url_webhook?: string
}

/*
 * A lista de provedores vem inteira do servidor — chave, nome e instruções.
 *
 * Esta tela já teve a própria lista de chaves, casada por POSIÇÃO com a que
 * chegava. Era uma armadilha silenciosa: bastava o servidor mudar a ordem (ou
 * ganhar um provedor novo no meio) para o lojista escolher um gateway e
 * salvar outro, com as instruções de um terceiro na tela. Agora cada opção
 * carrega a própria chave.
 */

export default function PagamentoPage() {

    const [situacao, setSituacao] = useState<Situacao | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [provedor, setProvedor] = useState("mercadopago")
    const [token, setToken] = useState("")
    const [segredo, setSegredo] = useState("")
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    const carregar = useCallback(async () => {
        try {
            const resposta = await fetch("/api/pagamento", { cache: "no-store" })
            const dados = await resposta.json().catch(() => null)

            if (resposta.ok && dados && typeof dados === "object" && "gateway" in dados) {
                const g = (dados as { gateway: Situacao }).gateway
                setSituacao(g)

                // Já conectada, o formulário abre no provedor que ela usa —
                // trocar de gateway tem de ser uma escolha, não um acidente de
                // o formulário abrir no outro.
                if (g.provedor) setProvedor(g.provedor)
            }
        } catch {
            setErro("Não foi possível consultar a conta de pagamento.")
        } finally {
            setCarregando(false)
        }
    }, [])

    // Buscar a situação ao abrir a tela é sincronizar com um sistema externo
    // (o servidor), que é exatamente para o que o efeito serve. O setState
    // acontece depois da resposta, nunca no corpo do efeito — a regra não
    // consegue enxergar isso através da função.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { void carregar() }, [carregar])

    async function salvar(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setErro("")
        setAviso("")
        setSalvando(true)

        try {
            const resposta = await fetch("/api/pagamento", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provedor, access_token: token, segredo_webhook: segredo }),
            })

            const dados = await resposta.json().catch(() => null)

            if (!resposta.ok) {
                setErro(
                    dados && typeof dados === "object" && "erro" in dados
                        ? String((dados as { erro: unknown }).erro)
                        : "Não foi possível salvar.",
                )
                return
            }

            // O campo é limpo assim que o token vai: credencial não fica
            // parada num input, onde o navegador pode oferecê-la para
            // preenchimento automático depois.
            setToken("")
            setSegredo("")
            setAviso("Conta de pagamento conectada.")
            await carregar()

        } catch {
            setErro("Não foi possível salvar. Tente de novo.")
        } finally {
            setSalvando(false)
        }
    }

    async function desconectar() {
        setErro("")
        setAviso("")

        try {
            const resposta = await fetch("/api/pagamento", { method: "DELETE" })

            if (!resposta.ok) {
                setErro("Não foi possível desconectar.")
                return
            }

            setAviso("Conta desconectada. A vitrine para de aceitar pagamento.")
            await carregar()
        } catch {
            setErro("Não foi possível desconectar.")
        }
    }

    if (carregando) {
        return (
            <Pagina titulo="Receber pagamento">
                <div className="card p-8 text-center text-sm text-[var(--ink-2)]">Carregando...</div>
            </Pagina>
        )
    }

    const conectado = situacao?.conectado ?? false

    // As instruções vêm do servidor, junto da lista: cada provedor sabe onde
    // ficam as próprias credenciais, e instrução de tela desencontrada da
    // integração é o jeito mais fácil de o lojista colar a chave errada.
    const disponiveis = situacao?.disponiveis ?? []

    const ajuda = disponiveis.find((p) => p.Chave === provedor)

    const nomeConectado =
        disponiveis.find((p) => p.Chave === situacao?.provedor)?.Nome ?? situacao?.provedor ?? ""

    // O provedor da loja é quem diz se o segredo faz falta: cobrar segredo de
    // quem não emite nenhum seria um aviso vermelho permanente e sem conserto.
    const exigeSegredo = disponiveis.find((p) => p.Chave === situacao?.provedor)?.ExigeSegredoWebhook ?? true

    const semWebhook = conectado && exigeSegredo && !situacao?.webhook_configurado

    // Falha do servidor, não da loja. Sem os endereços públicos nenhuma loja
    // cobra — e antes esse caso só aparecia para o comprador, como se a culpa
    // fosse do lojista.
    const semEnderecos = situacao?.enderecos_ok === false

    return (
        <Pagina
            titulo="Receber pagamento"
            descricao="Conecte a conta onde a sua loja recebe. O dinheiro das vendas do site cai direto nela — este sistema não fica no meio do caminho."
        >

            {/* Estado atual */}
            <section className="card p-6">
                <div className="flex items-start gap-3">
                    <span className={conectado ? "text-[var(--verde)]" : "text-[var(--ink-3)]"}>
                        {conectado
                            ? <FiCheckCircle className="w-5" aria-hidden />
                            : <FiCreditCard className="w-5" aria-hidden />}
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="font-display text-lg text-[var(--ink)]">
                            {conectado ? "Conta conectada" : "Nenhuma conta conectada"}
                        </p>

                        {conectado ? (
                            <p className="mt-1 text-sm text-[var(--ink-2)]">
                                {nomeConectado} · chave terminada em{" "}
                                <span className="num font-semibold">{situacao?.sufixo || "—"}</span>
                            </p>
                        ) : (
                            <p className="mt-1 text-sm text-[var(--ink-2)]">
                                Enquanto não conectar, a vitrine não consegue cobrar: quem
                                tentar fechar um pedido recebe um aviso para falar com a loja.
                            </p>
                        )}

                        {conectado ? (
                            <button type="button" onClick={desconectar} className="btn btn-perigo mt-4">
                                desconectar
                            </button>
                        ) : null}
                    </div>
                </div>
            </section>

            {semEnderecos ? (
                <p className="flex items-start gap-2 border-l-2 border-[var(--vermelho)] bg-[var(--vermelho-fundo)] px-3 py-2 text-sm text-[var(--vermelho)]">
                    <FiAlertTriangle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>
                        Servidor sem <code className="font-mono text-xs">VITRINE_URL</code>/<code className="font-mono text-xs">API_PUBLIC_URL</code> — nenhuma loja cobra pelo site agora. Fale com quem administra o servidor.
                    </span>
                </p>
            ) : null}

            {/* A forma de receber que não depende de provedor nenhum: a loja
                manda a chave Pix na conversa e confirma quando o dinheiro
                cai. Fica aqui, e não em Configurações, porque é uma forma de
                RECEBER — e esta é a tela em que o lojista pensa nisso. */}
            <PagamentoPorWhatsApp />

            {situacao?.url_webhook ? (
                <Secao
                    titulo="URL de notificação"
                    descricao={exigeSegredo
                        ? "Cadastre este endereço no painel do seu provedor, no lugar de webhooks."
                        : "Vai junto de cada cobrança automaticamente — nada para cadastrar."}
                >
                    <code className="block overflow-x-auto whitespace-nowrap rounded-lg border border-[var(--linha)] bg-[var(--superficie-2)] px-3 py-2 font-mono text-xs text-[var(--ink)]">
                        {situacao.url_webhook}
                    </code>
                </Secao>
            ) : null}

            {semWebhook ? (
                <p className="flex items-start gap-2 border-l-2 border-[var(--amarelo-forte)] bg-[var(--amarelo-fundo)] px-3 py-2 text-sm text-[var(--amarelo)]">
                    <FiAlertTriangle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>
                        Falta o segredo do webhook. Sem ele a loja até cobra, mas nunca
                        fica sabendo que foi paga — a confirmação é recusada, e o pedido
                        não chega aqui. Preencha abaixo.
                    </span>
                </p>
            ) : null}

            {/* Formulário */}
            <Secao titulo={conectado ? "Trocar credenciais" : "Conectar conta"}>

                <form onSubmit={salvar}>

                    <span className="rotulo">Onde você recebe</span>
                    <div className="mt-1 mb-5 flex flex-wrap gap-2">
                        {disponiveis.map((p) => {
                            const ativo = provedor === p.Chave
                            return (
                                <button
                                    key={p.Chave}
                                    type="button"
                                    onClick={() => setProvedor(p.Chave)}
                                    aria-pressed={ativo}
                                    className={`btn ${ativo ? "btn-primario" : "btn-neutro"} px-4 py-2 text-sm`}
                                >
                                    {p.Nome}
                                </button>
                            )
                        })}
                    </div>

                    <label htmlFor="token" className="rotulo">{ajuda?.RotuloChave ?? "Chave secreta"}</label>
                    <input
                        id="token"
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder={ajuda?.ExemploChave ?? ""}
                        autoComplete="off"
                        className="field"
                        required
                    />
                    <p className="mt-1 text-xs text-[var(--ink-2)]">{ajuda?.OndeAcharChave}</p>

                    {/* O campo só existe para provedor que assina a
                        notificação. Pedir um segredo que o provedor não emite
                        deixaria o lojista procurando por algo que não há. */}
                    {ajuda?.ExigeSegredoWebhook !== false ? (
                        <>
                            <label htmlFor="segredo" className="rotulo mt-5">Segredo do webhook</label>
                            <input
                                id="segredo"
                                type="password"
                                value={segredo}
                                onChange={(e) => setSegredo(e.target.value)}
                                placeholder={conectado ? "deixe em branco para manter o atual" : ""}
                                autoComplete="off"
                                className="field"
                            />
                            <p className="mt-1 text-xs text-[var(--ink-2)]">{ajuda?.OndeAcharWebhook}</p>
                        </>
                    ) : (
                        <p className="mt-5 border-l-2 border-[var(--azul)] bg-[var(--azul-suave)] px-3 py-2 text-xs leading-relaxed text-[var(--azul-escuro)]">
                            {ajuda?.OndeAcharWebhook}
                        </p>
                    )}

                    {erro ? (
                        <p className="mt-4 border-l-2 border-[var(--vermelho)] bg-[var(--vermelho-fundo)] px-3 py-2 text-sm text-[var(--vermelho)]">
                            {erro}
                        </p>
                    ) : null}

                    {aviso ? (
                        <p className="mt-4 border-l-2 border-[var(--verde)] bg-[var(--verde-suave)] px-3 py-2 text-sm text-[var(--verde)]">
                            {aviso}
                        </p>
                    ) : null}

                    <button type="submit" disabled={salvando} className="btn btn-primario mt-5">
                        {salvando
                            ? `conferindo com o ${ajuda?.Nome ?? "provedor"}...`
                            : conectado ? "trocar" : "conectar"}
                    </button>

                </form>

                <p className="mt-5 flex items-center gap-2 text-xs text-[var(--ink-2)]">
                    <FiLock className="w-3.5 shrink-0" aria-hidden />
                    <span>Cifrado com chave exclusiva da sua loja — nunca volta para a tela.</span>
                </p>

            </Secao>

        </Pagina>
    )
}
