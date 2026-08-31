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

            const dados = await salvarLoja(nome, slug)

            setLoja(dados)
            setNome(dados.nome_loja)
            setSlug(dados.slug)
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
            <main className="mx-auto max-w-3xl px-4 py-10">
                <div className="card p-8 text-center text-sm text-[#5A6469]">
                    Carregando dados da loja...
                </div>
            </main>
        )
    }

    const noAr = loja?.vitrine_liberada ?? false
    const endereco = loja?.slug ? urlDaVitrine(loja.slug) : ""

    return (
        <main className="mx-auto max-w-3xl px-4 py-10">

            <h1 className="font-display text-2xl text-[#1E2428]">
                Minha loja
            </h1>

            <p className="mt-1 text-sm text-[#5A6469]">
                O nome e o endereço que os seus clientes vão ver na vitrine.
                Cada loja tem o seu, e ninguém compartilha catálogo com ninguém.
            </p>

            {/* SITUAÇÃO DA VITRINE */}
            <section className="card mt-6 p-6">

                <div className="flex items-start gap-3">

                    <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                            noAr ? "bg-[#E0FFEE] text-[#08A022]" : "bg-[#F0F3F4] text-[#8C969B]"
                        }`}
                    >
                        {noAr
                            ? <FiGlobe className="w-5" aria-hidden />
                            : <FiLock className="w-5" aria-hidden />}
                    </div>

                    <div className="min-w-0 flex-1">

                        <p className="font-display text-lg text-[#1E2428]">
                            {noAr ? "Sua vitrine está no ar" : "Sua vitrine ainda não está no ar"}
                        </p>

                        {noAr ? (
                            <>
                                <p className="mt-1 text-sm text-[#5A6469]">
                                    Este é o endereço para divulgar aos seus clientes.
                                </p>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <code className="rounded-lg bg-[#F0F3F4] px-3 py-2 font-mono text-sm text-[#1E2428]">
                                        {endereco}
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
                                        href={endereco}
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
                            <p className="mt-1 text-sm text-[#5A6469]">
                                {!loja?.slug
                                    ? "Escolha um endereço abaixo para publicar a sua loja."
                                    : (
                                        <>
                                            O endereço já está escolhido, mas a vitrine faz parte do
                                            plano com site.{" "}
                                            <Link href="/page/assinatura" className="font-semibold text-[#0086FF] hover:underline">
                                                Ver planos
                                            </Link>
                                        </>
                                    )}
                            </p>
                        )}

                    </div>

                </div>

            </section>

            {/* FORMULÁRIO */}
            <form onSubmit={handleSubmit} noValidate className="card mt-6 p-6 sm:p-7">

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

                        <p className="mt-1.5 text-xs text-[#8C969B]">
                            Aparece no cabeçalho da vitrine e no rodapé.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="slug" className="rotulo">
                            Endereço da vitrine
                        </label>

                        <div className="flex items-stretch">
                            <span className="flex items-center rounded-l-lg border border-r-0 border-[#D3DADD] bg-[#F0F3F4] px-3 font-mono text-sm text-[#5A6469]">
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

                        <p className="mt-1.5 text-xs text-[#8C969B]">
                            Letras, números e hífen. Acentos e espaços viram hífen enquanto
                            você digita. Trocar o endereço depois quebra os links já
                            divulgados, então escolha com calma.
                        </p>
                    </div>

                </div>

                {erro && (
                    <div
                        role="alert"
                        className="mt-5 flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]"
                    >
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {salvo && !erro && (
                    <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-[#E0FFEE] px-4 py-3 text-sm font-semibold text-[#08A022]">
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

        </main>
    )
}
