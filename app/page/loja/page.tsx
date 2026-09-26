"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
    consultarLoja,
    normalizarSlug,
    salvarLoja,
    urlDaVitrine,
} from "@/middleware/loja"
import type { Loja } from "@/app/type/type"
import Aparencia from "@/app/components/loja/aparencia"
import { Pagina } from "@/app/components/pagina/pagina"
import {
    FiAlertCircle,
    FiArrowRight,
    FiCheckCircle,
    FiCopy,
    FiDroplet,
    FiExternalLink,
    FiGlobe,
    FiLayout,
    FiLock,
    FiMapPin,
    FiPhone,
    FiShield,
} from "react-icons/fi"
import type { IconType } from "react-icons"

/**
 * "Minha loja" — mesmo padrão de índice do app/page/config/page.tsx: a
 * raiz é um índice de cartões (nome do grupo, uma linha de resumo, o valor
 * atual), e cada cartão abre um grupo pequeno em vez de despejar nome,
 * endereço, contato e coordenada — sete campos, cada um com um parágrafo —
 * tudo aberto ao mesmo tempo. O grupo aberto mora no endereço
 * (`?grupo=contato`), pela mesma razão de lá: o botão de voltar do
 * navegador volta para o índice, e recarregar não perde o lugar.
 *
 * Salvar continua sendo UM só, e manda a loja inteira mesmo estando dentro
 * de um grupo — os três grupos de formulário (identidade, contato, mapa)
 * dividem o mesmo estado, então abrir "Contato" e salvar não apaga o nome
 * que está guardado em "Identidade e endereço".
 */

type IdDoGrupo = "identidade" | "contato" | "mapa" | "aparencia"

const GRUPOS: { id: IdDoGrupo; titulo: string; linha: string; Icone: IconType }[] = [
    {
        id: "identidade",
        titulo: "Identidade e endereço",
        linha: "O nome que aparece na vitrine e o endereço do site.",
        Icone: FiGlobe,
    },
    {
        id: "contato",
        titulo: "Contato da loja",
        linha: "WhatsApp, telefone, endereço físico e horário.",
        Icone: FiPhone,
    },
    {
        id: "mapa",
        titulo: "Ponto no mapa",
        linha: "Para o site oferecer a unidade mais perto do cliente.",
        Icone: FiMapPin,
    },
    {
        id: "aparencia",
        titulo: "Aparência",
        linha: "Cores, logotipo e capa da vitrine.",
        Icone: FiDroplet,
    },
]

/** As telas de configuração que têm porta própria, mais o link para a
 *  política de privacidade, que é externo. */
const ATALHOS: { rota: string; titulo: string; linha: string; Icone: IconType; externo?: boolean }[] = [
    {
        rota: "/page/loja/editor",
        titulo: "Página inicial",
        linha: "Banners, prateleiras e textos da home, na ordem que você arrastar.",
        Icone: FiLayout,
    },
]

/**
 * Lê a coordenada digitada.
 *
 * Aceita vírgula decimal, que é como o teclado brasileiro escreve número — e
 * como o lojista vai digitar se não colar do mapa. Campo vazio ou ilegível
 * vira nulo: a loja fica de fora da ordenação por distância em vez de ser
 * posta num ponto qualquer.
 */
function coordenada(texto: string): number | null {

    const limpo = texto.trim().replace(",", ".")

    if (limpo === "") return null

    const numero = Number(limpo)

    return Number.isFinite(numero) ? numero : null
}

export default function LojaPage() {
    return (
        <Suspense fallback={<main className="com-menu min-h-[calc(100dvh-3.5rem)] bg-[var(--fundo)]" />}>
            <LojaConteudo />
        </Suspense>
    )
}

function LojaConteudo() {

    const router = useRouter()
    const parametros = useSearchParams()

    const pedido = parametros.get("grupo")
    const aberto = GRUPOS.find((grupo) => grupo.id === pedido) ?? null

    const [loja, setLoja] = useState<Loja | null>(null)
    const [nome, setNome] = useState("")
    const [slug, setSlug] = useState("")

    // O contato público. Fica no mesmo salvar que o resto: é tudo "quem é
    // esta loja para quem compra", e separar em requisições diferentes faria
    // o lojista salvar o nome e ir embora sem preencher o resto.
    const [whatsapp, setWhatsapp] = useState("")
    const [telefone, setTelefone] = useState("")
    const [endereco, setEndereco] = useState("")
    const [horario, setHorario] = useState("")

    // A coordenada da loja, como texto: o campo aceita o que a pessoa colou
    // do mapa, e a conversão para número acontece na hora de salvar. Guardar
    // número aqui apagaria o "-8," enquanto ela ainda está digitando.
    const [latitude, setLatitude] = useState("")
    const [longitude, setLongitude] = useState("")
    const [carregando, setCarregando] = useState(true)
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro] = useState("")
    const [salvo, setSalvo] = useState(false)
    const [copiado, setCopiado] = useState(false)

    useEffect(() => {
        let cancelado = false

        async function buscar() {
            try {
                const dados = await consultarLoja()

                if (cancelado) return

                setLoja(dados)
                setNome(dados.nome_loja)
                setSlug(dados.slug)
                setWhatsapp(dados.whatsapp ?? "")
                setTelefone(dados.telefone ?? "")
                setEndereco(dados.endereco ?? "")
                setHorario(dados.horario ?? "")
                setLatitude(dados.latitude != null ? String(dados.latitude) : "")
                setLongitude(dados.longitude != null ? String(dados.longitude) : "")
                setErro("")
            } catch (e) {
                if (cancelado) return
                setErro(e instanceof Error ? e.message : "Erro ao consultar a loja")
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [])

    // O endereço se forma enquanto o lojista digita: ver "maria-modas"
    // aparecendo explica a regra melhor do que qualquer texto de ajuda.
    const aoDigitarSlug = useCallback((valor: string) => {
        setSlug(normalizarSlug(valor))
        setSalvo(false)
    }, [])

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        setErro("")
        setSalvo(false)

        if (slug.length < 3) {
            setErro("O endereço precisa ter pelo menos 3 letras")
            return
        }

        try {
            setSalvando(true)

            const dados = await salvarLoja({
                nome_loja: nome,
                slug,
                whatsapp,
                telefone,
                endereco,
                horario,
                latitude: coordenada(latitude),
                longitude: coordenada(longitude),
            })

            setLoja(dados)
            setNome(dados.nome_loja)
            setSlug(dados.slug)

            // O que volta é o que ficou GRAVADO: o WhatsApp digitado torto
            // não é publicado, e o campo se esvaziando na tela é como o
            // lojista descobre isso — sem uma mensagem de erro que o
            // impediria de salvar o resto.
            setWhatsapp(dados.whatsapp ?? "")
            setTelefone(dados.telefone ?? "")
            setEndereco(dados.endereco ?? "")
            setHorario(dados.horario ?? "")
            setLatitude(dados.latitude != null ? String(dados.latitude) : "")
            setLongitude(dados.longitude != null ? String(dados.longitude) : "")

            setSalvo(true)

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível salvar")
        } finally {
            setSalvando(false)
        }
    }

    async function copiarLink() {
        if (!loja?.slug) return

        try {
            await navigator.clipboard.writeText(urlDaVitrine(loja.slug))
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
        } catch {
            setErro("Não foi possível copiar — selecione o endereço e copie manualmente")
        }
    }

    if (carregando) {
        return (
            <Pagina titulo="Minha loja">
                <div className="card p-8 text-center text-sm text-[var(--ink-2)]">
                    Carregando dados da loja...
                </div>
            </Pagina>
        )
    }

    const noAr = loja?.vitrine_liberada ?? false
    const urlPublica = loja?.slug ? urlDaVitrine(loja.slug) : ""

    /* ----------------------------------------------------------------
       O VALOR ATUAL NO CARTÃO DO ÍNDICE
       ---------------------------------------------------------------- */
    function resumo(id: IdDoGrupo): string {

        if (id === "identidade") {
            return nome ? `${nome} · /${slug || "?"}` : "Sem nome ainda"
        }

        if (id === "contato") {
            const partes = [
                whatsapp && "WhatsApp",
                telefone && "Telefone",
                endereco && "Endereço",
                horario && "Horário",
            ].filter(Boolean)

            return partes.length > 0 ? partes.join(" · ") : "Nenhum contato preenchido"
        }

        if (id === "mapa") {
            return coordenada(latitude) != null && coordenada(longitude) != null ? "Definido" : "Não definido"
        }

        return "Cores e logotipo"
    }

    /* ================================================================
       O ÍNDICE
       ================================================================ */
    if (!aberto) {
        return (
            <Pagina
                titulo="Minha loja"
                descricao="O que os seus clientes veem na vitrine. Cada cartão mostra como está agora — abra para mudar."
            >
                {erro && <Alerta tipo="erro">{erro}</Alerta>}

                {/* SITUAÇÃO DA VITRINE */}
                <section className="card p-4 sm:p-6">
                    <div className="flex items-start gap-3">
                        <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                                noAr ? "bg-[var(--verde-fundo)] text-[var(--verde)]" : "bg-[var(--fundo)] text-[var(--ink-3)]"
                            }`}
                        >
                            {noAr
                                ? <FiGlobe className="w-5" aria-hidden />
                                : <FiLock className="w-5" aria-hidden />}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="font-display text-lg text-[var(--ink)]">
                                {noAr ? "Sua vitrine está no ar" : "Sua vitrine ainda não está no ar"}
                            </p>

                            {noAr ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <code className="rounded-lg bg-[var(--fundo)] px-3 py-2 font-mono text-sm text-[var(--ink)]">
                                        {urlPublica}
                                    </code>

                                    <button type="button" onClick={copiarLink} className="btn btn-neutro px-3 py-2 text-sm">
                                        <FiCopy className="w-4" aria-hidden />
                                        {copiado ? "Copiado" : "Copiar"}
                                    </button>

                                    <a href={urlPublica} target="_blank" rel="noreferrer" className="btn btn-secundario px-3 py-2 text-sm">
                                        <FiExternalLink className="w-4" aria-hidden />
                                        Abrir
                                    </a>
                                </div>
                            ) : (
                                <p className="mt-1 text-sm text-[var(--ink-2)]">
                                    {!loja?.slug
                                        ? "Escolha um endereço em “Identidade e endereço” para publicar."
                                        : (
                                            <>
                                                O endereço já está escolhido — falta a assinatura em dia.{" "}
                                                <Link href="/page/assinatura" className="font-semibold text-[var(--azul)] hover:underline">
                                                    Ver assinatura
                                                </Link>
                                            </>
                                        )}
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {GRUPOS.map((grupo) => (
                        <button
                            key={grupo.id}
                            type="button"
                            onClick={() => router.push(`/page/loja?grupo=${grupo.id}`)}
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

                            <span className="mt-auto flex items-center gap-1.5 pt-4 text-xs font-semibold text-[var(--azul)]">
                                <span className="num truncate">{resumo(grupo.id)}</span>
                                <FiArrowRight className="w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
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
                                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-2)]">{atalho.linha}</span>
                                </span>

                                <FiArrowRight className="mt-1 w-4 shrink-0 text-[var(--ink-4)] transition-transform group-hover:translate-x-0.5" aria-hidden />
                            </Link>
                        ))}

                        {/* Externo — política de privacidade da própria vitrine,
                            escrita com os dados desta loja. Quem responde por ela
                            perante a LGPD é a loja, por isso o link mora aqui e
                            não só no rodapé do site. */}
                        {urlPublica && (
                            <a
                                href={`${urlPublica}/privacidade`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="card group flex items-start gap-3 p-4 transition-colors hover:border-[var(--azul)]"
                            >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--fundo)] text-[var(--ink-2)]">
                                    <FiShield className="w-4" aria-hidden />
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-[var(--ink)]">Política de privacidade</span>
                                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-2)]">
                                        A que a vitrine já publica no rodapé, escrita com os dados desta loja.
                                    </span>
                                </span>

                                <FiExternalLink className="mt-1 w-4 shrink-0 text-[var(--ink-4)]" aria-hidden />
                            </a>
                        )}
                    </div>
                </div>
            </Pagina>
        )
    }

    /* ================================================================
       APARÊNCIA — o componente já cuida do próprio carregar/salvar
       ================================================================ */
    if (aberto.id === "aparencia") {
        return (
            <Pagina titulo={aberto.titulo} descricao={aberto.linha} volta={{ nome: "Minha loja", rota: "/page/loja" }}>
                <Aparencia />
            </Pagina>
        )
    }

    /* ================================================================
       IDENTIDADE, CONTATO OU MAPA — um formulário, o mesmo salvar
       ================================================================ */
    return (
        <Pagina titulo={aberto.titulo} descricao={aberto.linha} volta={{ nome: "Minha loja", rota: "/page/loja" }}>

            {erro && <Alerta tipo="erro">{erro}</Alerta>}
            {salvo && !erro && <Alerta tipo="ok">Dados da loja salvos.</Alerta>}

            <form onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-5">

                {aberto.id === "identidade" && (
                    <div className="card space-y-5 p-6 sm:p-7">
                        <div>
                            <label htmlFor="nome" className="rotulo">Nome da loja</label>

                            <input
                                id="nome"
                                type="text"
                                maxLength={60}
                                placeholder="Ex: Maria Modas"
                                className="field"
                                value={nome}
                                onChange={(e) => { setNome(e.target.value); setSalvo(false) }}
                            />

                            <p className="mt-1.5 text-xs text-[var(--ink-3)]">
                                Aparece no cabeçalho e no rodapé da vitrine.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="slug" className="rotulo">Endereço da vitrine</label>

                            {/* Em pé no celular, lado a lado a partir de sm: o
                                domínio inteiro ("https://vitrine.seudominio.com/")
                                não cabe ao lado do campo numa tela de 360px —
                                o campo ficava espremido a quase nada, ou a
                                linha vazava para fora do cartão. */}
                            <div className="flex flex-col sm:flex-row sm:items-stretch">
                                <span className="break-all rounded-t-lg border border-b-0 border-[var(--linha)] bg-[var(--fundo)] px-3 py-2 font-mono text-sm text-[var(--ink-2)] sm:rounded-l-lg sm:rounded-t-none sm:border-b sm:border-r-0 sm:py-0">
                                    {urlDaVitrine("")}
                                </span>

                                <input
                                    id="slug"
                                    type="text"
                                    maxLength={40}
                                    placeholder="maria-modas"
                                    className="field min-w-0 flex-1 rounded-t-none sm:rounded-l-none sm:rounded-t-lg font-mono"
                                    value={slug}
                                    onChange={(e) => aoDigitarSlug(e.target.value)}
                                />
                            </div>

                            <p className="mt-1.5 text-xs text-[var(--ink-3)]">
                                Letras, números e hífen. Trocar depois quebra os links já divulgados.
                            </p>
                        </div>
                    </div>
                )}

                {aberto.id === "contato" && (
                    <div className="card space-y-5 p-6 sm:p-7">
                        <p className="text-xs text-[var(--ink-3)]">
                            Aparece no rodapé da vitrine e na tela em que o cliente acompanha o pedido. O que ficar em branco não aparece lá.
                        </p>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <label htmlFor="whatsapp" className="rotulo">WhatsApp</label>

                                <input
                                    id="whatsapp"
                                    type="tel"
                                    inputMode="tel"
                                    maxLength={24}
                                    placeholder="(81) 98888-7777"
                                    className="field"
                                    value={whatsapp}
                                    onChange={(e) => { setWhatsapp(e.target.value); setSalvo(false) }}
                                />

                                <p className="mt-1.5 text-xs text-[var(--ink-3)]">
                                    Com DDD. Vira botão de conversa na tela do pedido.
                                </p>
                            </div>

                            <div>
                                <label htmlFor="telefone" className="rotulo">Telefone</label>

                                <input
                                    id="telefone"
                                    type="tel"
                                    inputMode="tel"
                                    maxLength={32}
                                    placeholder="(81) 3333-2222"
                                    className="field"
                                    value={telefone}
                                    onChange={(e) => { setTelefone(e.target.value); setSalvo(false) }}
                                />

                                <p className="mt-1.5 text-xs text-[var(--ink-3)]">
                                    Para quem prefere ligar. Opcional.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="endereco" className="rotulo">Endereço da loja</label>

                            <input
                                id="endereco"
                                type="text"
                                maxLength={200}
                                placeholder="Rua das Flores, 42 — Centro, Recife/PE"
                                className="field"
                                value={endereco}
                                onChange={(e) => { setEndereco(e.target.value); setSalvo(false) }}
                            />

                            <p className="mt-1.5 text-xs text-[var(--ink-3)]">
                                Onde o cliente vai buscar o pedido.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="horario" className="rotulo">Horário de funcionamento</label>

                            <input
                                id="horario"
                                type="text"
                                maxLength={120}
                                placeholder="Seg a sex, 9h às 18h · Sáb até 13h"
                                className="field"
                                value={horario}
                                onChange={(e) => { setHorario(e.target.value); setSalvo(false) }}
                            />

                            <p className="mt-1.5 text-xs text-[var(--ink-3)]">
                                Escreva como você diria ao telefone.
                            </p>
                        </div>
                    </div>
                )}

                {aberto.id === "mapa" && (
                    <div className="card space-y-5 p-6 sm:p-7">
                        <div>
                            <p className="rotulo">Latitude e longitude</p>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="Latitude — ex: -8.0476"
                                    aria-label="Latitude"
                                    className="field"
                                    value={latitude}
                                    onChange={(e) => { setLatitude(e.target.value); setSalvo(false) }}
                                />

                                <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="Longitude — ex: -34.8770"
                                    aria-label="Longitude"
                                    className="field"
                                    value={longitude}
                                    onChange={(e) => { setLongitude(e.target.value); setSalvo(false) }}
                                />
                            </div>

                            <p className="mt-1.5 text-xs text-[var(--ink-3)]">
                                Só conta com mais de uma loja. Copie do Google Maps (botão direito no ponto). Deixe em branco para não entrar na ordenação.
                            </p>
                        </div>
                    </div>
                )}

                <button type="submit" disabled={salvando} className="btn btn-primario">
                    {salvando ? "Salvando..." : "Salvar"}
                </button>
            </form>
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
