"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
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
    FiCheckCircle,
    FiCopy,
    FiExternalLink,
    FiGlobe,
    FiLock,
} from "react-icons/fi"

export default function LojaPage() {
    const [loja, setLoja] = useState<Loja | null>(null)
    const [nome, setNome] = useState("")
    const [slug, setSlug] = useState("")

    // O contato público. Fica na mesma tela e no mesmo salvar: é tudo
    // "quem é esta loja para quem compra", e separar em duas telas faria o
    // lojista salvar o nome e ir embora sem preencher o resto.
    const [whatsapp, setWhatsapp] = useState("")
    const [telefone, setTelefone] = useState("")
    const [endereco, setEndereco] = useState("")
    const [horario, setHorario] = useState("")
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
                <div className="card p-8 text-center text-sm text-[#616161]">
                    Carregando dados da loja...
                </div>
            </Pagina>
        )
    }

    const noAr = loja?.vitrine_liberada ?? false
    const urlPublica = loja?.slug ? urlDaVitrine(loja.slug) : ""

    return (
        <Pagina
            titulo="Minha loja"
            descricao="O nome e o endereço que os seus clientes vão ver na vitrine. Cada loja tem o seu, e ninguém compartilha catálogo com ninguém."
        >

            {/* SITUAÇÃO DA VITRINE */}
            <section className="card p-6">

                <div className="flex items-start gap-3">

                    <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                            noAr ? "bg-[#CDFEE1] text-[#0C5132]" : "bg-[#F1F1F1] text-[#8A8A8A]"
                        }`}
                    >
                        {noAr
                            ? <FiGlobe className="w-5" aria-hidden />
                            : <FiLock className="w-5" aria-hidden />}
                    </div>

                    <div className="min-w-0 flex-1">

                        <p className="font-display text-lg text-[#303030]">
                            {noAr ? "Sua vitrine está no ar" : "Sua vitrine ainda não está no ar"}
                        </p>

                        {noAr ? (
                            <>
                                <p className="mt-1 text-sm text-[#616161]">
                                    Este é o endereço para divulgar aos seus clientes.
                                </p>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <code className="rounded-lg bg-[#F1F1F1] px-3 py-2 font-mono text-sm text-[#303030]">
                                        {urlPublica}
                                    </code>

                                    <button
                                        type="button"
                                        onClick={copiarLink}
                                        className="btn btn-neutro px-3 py-2 text-sm"
                                    >
                                        <FiCopy className="w-4" aria-hidden />
                                        {copiado ? "Copiado" : "Copiar"}
                                    </button>

                                    <a
                                        href={urlPublica}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-secundario px-3 py-2 text-sm"
                                    >
                                        <FiExternalLink className="w-4" aria-hidden />
                                        Abrir
                                    </a>
                                </div>
                            </>
                        ) : (
                            <p className="mt-1 text-sm text-[#616161]">
                                {!loja?.slug
                                    ? "Escolha um endereço abaixo para publicar a sua loja."
                                    : (
                                        <>
                                            O endereço já está escolhido, mas a vitrine só vai ao ar
                                            com a assinatura em dia.{" "}
                                            <Link href="/page/assinatura" className="font-semibold text-[#005BD3] hover:underline">
                                                Ver assinatura
                                            </Link>
                                        </>
                                    )}
                            </p>
                        )}

                    </div>

                </div>

            </section>

            {/* FORMULÁRIO */}
            <form onSubmit={handleSubmit} noValidate className="card p-6 sm:p-7">

                <div className="space-y-5">

                    <div>
                        <label htmlFor="nome" className="rotulo">
                            Nome da loja
                        </label>

                        <input
                            id="nome"
                            type="text"
                            maxLength={60}
                            placeholder="Ex: Maria Modas"
                            className="field"
                            value={nome}
                            onChange={(e) => {
                                setNome(e.target.value)
                                setSalvo(false)
                            }}
                        />

                        <p className="mt-1.5 text-xs text-[#8A8A8A]">
                            Aparece no cabeçalho da vitrine e no rodapé.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="slug" className="rotulo">
                            Endereço da vitrine
                        </label>

                        <div className="flex items-stretch">
                            <span className="flex items-center rounded-l-lg border border-r-0 border-[#E1E1E1] bg-[#F1F1F1] px-3 font-mono text-sm text-[#616161]">
                                {urlDaVitrine("")}
                            </span>

                            <input
                                id="slug"
                                type="text"
                                maxLength={40}
                                placeholder="maria-modas"
                                className="field rounded-l-none font-mono"
                                value={slug}
                                onChange={(e) => aoDigitarSlug(e.target.value)}
                            />
                        </div>

                        <p className="mt-1.5 text-xs text-[#8A8A8A]">
                            Letras, números e hífen. Acentos e espaços viram hífen enquanto
                            você digita. Trocar o endereço depois quebra os links já
                            divulgados, então escolha com calma.
                        </p>
                    </div>

                    {/* ==============================
                        CONTATO PÚBLICO

                        Vai para o rodapé da vitrine e para a tela em que o
                        cliente acompanha o pedido. Antes disso, quem tinha um
                        problema com a entrega — ou ia buscar no balcão e não
                        sabia onde era — ficava sem para onde ligar.
                    ============================== */}
                    <div className="border-t border-[#EBEBEB] pt-5">
                        <p className="text-sm font-semibold text-[#303030]">
                            Contato da loja
                        </p>
                        <p className="mt-1 text-xs text-[#8A8A8A]">
                            Aparece no rodapé da vitrine e na tela em que o cliente
                            acompanha o pedido. O que você deixar em branco simplesmente
                            não aparece lá.
                        </p>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">

                        <div>
                            <label htmlFor="whatsapp" className="rotulo">
                                WhatsApp
                            </label>

                            <input
                                id="whatsapp"
                                type="tel"
                                inputMode="tel"
                                maxLength={24}
                                placeholder="(81) 98888-7777"
                                className="field"
                                value={whatsapp}
                                onChange={(e) => {
                                    setWhatsapp(e.target.value)
                                    setSalvo(false)
                                }}
                            />

                            <p className="mt-1.5 text-xs text-[#8A8A8A]">
                                Com DDD. Vira um botão de conversa na tela do pedido, já
                                com o número dele escrito na mensagem.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="telefone" className="rotulo">
                                Telefone
                            </label>

                            <input
                                id="telefone"
                                type="tel"
                                inputMode="tel"
                                maxLength={32}
                                placeholder="(81) 3333-2222"
                                className="field"
                                value={telefone}
                                onChange={(e) => {
                                    setTelefone(e.target.value)
                                    setSalvo(false)
                                }}
                            />

                            <p className="mt-1.5 text-xs text-[#8A8A8A]">
                                Para quem prefere ligar. Opcional.
                            </p>
                        </div>

                    </div>

                    <div>
                        <label htmlFor="endereco" className="rotulo">
                            Endereço da loja
                        </label>

                        <input
                            id="endereco"
                            type="text"
                            maxLength={200}
                            placeholder="Rua das Flores, 42 — Centro, Recife/PE"
                            className="field"
                            value={endereco}
                            onChange={(e) => {
                                setEndereco(e.target.value)
                                setSalvo(false)
                            }}
                        />

                        <p className="mt-1.5 text-xs text-[#8A8A8A]">
                            Onde o cliente vai buscar o pedido. Sem isto, a tela dele diz
                            só &quot;você retira na loja&quot; e não diz onde.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="horario" className="rotulo">
                            Horário de funcionamento
                        </label>

                        <input
                            id="horario"
                            type="text"
                            maxLength={120}
                            placeholder="Seg a sex, 9h às 18h · Sáb até 13h"
                            className="field"
                            value={horario}
                            onChange={(e) => {
                                setHorario(e.target.value)
                                setSalvo(false)
                            }}
                        />

                        <p className="mt-1.5 text-xs text-[#8A8A8A]">
                            Escreva como você diria ao telefone.
                        </p>
                    </div>

                </div>

                {erro && (
                    <div
                        role="alert"
                        className="mt-5 flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]"
                    >
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {salvo && !erro && (
                    <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-[#CDFEE1] px-4 py-3 text-sm font-semibold text-[#0C5132]">
                        <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>Dados da loja salvos.</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={salvando}
                    className="btn btn-primario mt-6"
                >
                    {salvando ? "Salvando..." : "Salvar"}
                </button>

            </form>

            {/* A cara da vitrine vem depois do endereço dela de propósito:
                escolher cor antes de a loja existir é decorar casa sem
                terreno. */}
            <Aparencia />

            {/* E o conteúdo vem depois da cara, pelo mesmo motivo: montar as
                seções antes de a loja ter nome e endereço é arrumar a
                prateleira de uma loja que ainda não abriu. */}
            <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="min-w-[16rem] flex-1">
                    <p className="text-sm font-semibold text-[#303030]">Página inicial</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#616161]">
                        Escolha quais seções aparecem na sua home e em que ordem —
                        banners, prateleiras de produtos, textos e faixas de destaque —
                        arrastando cada uma para o lugar.
                    </p>
                </div>

                <Link href="/page/loja/editor" className="btn btn-neutro shrink-0">
                    Abrir o editor da home
                </Link>
            </section>

            {/* Quem responde pelos dados dos clientes é a loja, não o sistema
                — na LGPD ela é a controladora. Então ela precisa saber que a
                política existe, o que está escrito nela e onde o cliente a
                encontra: política que o próprio lojista nunca leu é a que vira
                problema quando alguém cobra. */}
            <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="min-w-[16rem] flex-1">
                    <p className="text-sm font-semibold text-[#303030]">
                        Política de privacidade (LGPD)
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#616161]">
                        Sua vitrine já publica a política, escrita com os dados desta loja
                        e ligada no rodapé de todas as páginas. Ela descreve o que o
                        sistema realmente faz — leia uma vez, porque quem responde pelos
                        dados dos clientes perante a lei é a loja. Se um cliente pedir
                        cópia dos dados ou exclusão, atenda em <strong>Clientes</strong>,
                        na ficha dele.
                    </p>
                </div>

                {urlPublica ? (
                    <a
                        href={`${urlPublica}/privacidade`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-neutro shrink-0"
                    >
                        Ler a política
                    </a>
                ) : null}
            </section>

        </Pagina>
    )
}
