"use client"

import { useEffect, useMemo, useState } from "react"
import type { Banner, Produto } from "@/app/type/type"
import { listarBanners, criarBanner, editarBanner, excluirBanner } from "@/middleware/banners"
import { listarProdutos } from "@/middleware/produtos"
import { sanitizeText, sanitizeUrl, sanitizeDescricao } from "@/security/sanitize"
import { validarBanner, type NovoBanner } from "@/security/validate"
import { ApiError } from "@/middleware/client"
import Preco, { formatarMoeda } from "@/app/components/preco/preco"
import { FiImage } from "react-icons/fi"
import { urlDaImagem } from "@/security/imagem"
import { Pagina } from "@/app/components/pagina/pagina"

interface FormState {
    titulo: string
    descricao: string
    imagem_url: string
    valor: string
    valor_antigo: string
    link: string
    ativo: boolean
    ordem: string
}

const FORM_VAZIO: FormState = {
    titulo: "",
    descricao: "",
    imagem_url: "",
    valor: "",
    valor_antigo: "",
    link: "",
    ativo: true,
    ordem: "0",
}

export default function Banners() {
    const [banners, setBanners] = useState<Banner[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [buscaProduto, setBuscaProduto] = useState("")
    const [mostrarSugestoes, setMostrarSugestoes] = useState(false)

    const [editandoId, setEditandoId] = useState<number | null>(null)
    const [formData, setFormData] = useState<FormState>(FORM_VAZIO)
    const [errosForm, setErrosForm] = useState<string[]>([])
    const [salvando, setSalvando] = useState(false)

    const [excluindoId, setExcluindoId] = useState<number | null>(null)
    const [erroExclusao, setErroExclusao] = useState("")

    async function carregar() {
        try {
            const [listaBanners, listaProdutos] = await Promise.all([
                listarBanners(),
                listarProdutos(),
            ])
            setBanners(listaBanners)
            setProdutos(listaProdutos)
        } catch (error) {
            console.error("Erro ao buscar banners:", error)
            setErro("Não foi possível carregar os banners.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()
    }, [])

    const termoBuscaProduto = buscaProduto.trim().toLowerCase()

    const produtosFiltrados = useMemo(() => {
        if (!termoBuscaProduto) return []
        return produtos
            .filter((produto) => produto.nome.toLowerCase().includes(termoBuscaProduto))
            .slice(0, 8)
    }, [produtos, termoBuscaProduto])

    function selecionarProduto(produto: Produto) {
        setFormData((prev) => ({ ...prev, link: `/produto/${produto.id}` }))
        setBuscaProduto(produto.nome)
        setMostrarSugestoes(false)
    }

    function handleChange(
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) {
        const { name, value, type } = e.target
        const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined
        setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
    }

    function iniciarEdicao(banner: Banner) {
        setEditandoId(banner.id)
        setFormData({
            titulo: banner.titulo,
            descricao: banner.descricao,
            imagem_url: banner.imagem_url,
            valor: String(banner.valor),
            valor_antigo: banner.valor_antigo ? String(banner.valor_antigo) : "",
            link: banner.link,
            ativo: banner.ativo,
            ordem: String(banner.ordem),
        })

        // Se o link já aponta pra um produto cadastrado, mostra o nome dele
        // na busca em vez de deixar o campo em branco.
        const produtoVinculado = produtos.find((produto) => banner.link === `/produto/${produto.id}`)
        setBuscaProduto(produtoVinculado?.nome ?? "")

        setErrosForm([])
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    function cancelarEdicao() {
        setEditandoId(null)
        setFormData(FORM_VAZIO)
        setBuscaProduto("")
        setErrosForm([])
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        const banner: NovoBanner = {
            titulo: sanitizeText(formData.titulo),
            descricao: sanitizeDescricao(formData.descricao),
            imagem_url: sanitizeUrl(formData.imagem_url),
            valor: parseFloat(formData.valor.replace(",", ".")) || 0,
            valor_antigo: parseFloat(formData.valor_antigo.replace(",", ".")) || 0,
            link: sanitizeUrl(formData.link),
            ativo: formData.ativo,
            ordem: parseInt(formData.ordem, 10) || 0,
        }

        const erros = validarBanner(banner)

        if (erros.length > 0) {
            setErrosForm(erros)
            return
        }

        try {
            setSalvando(true)
            setErrosForm([])

            if (editandoId) {
                const atualizado = await editarBanner(editandoId, banner)
                setBanners((atual) => atual.map((b) => (b.id === editandoId ? atualizado : b)))
            } else {
                const criado = await criarBanner(banner)
                setBanners((atual) => [...atual, criado])
            }

            cancelarEdicao()

        } catch (error) {
            console.error("Erro ao salvar banner:", error)
            setErrosForm([error instanceof ApiError ? error.message : "Não foi possível salvar o banner."])
        } finally {
            setSalvando(false)
        }
    }

    async function handleExcluir(id: number) {
        try {
            setExcluindoId(id)
            setErroExclusao("")
            await excluirBanner(id)
            setBanners((atual) => atual.filter((b) => b.id !== id))
            if (editandoId === id) cancelarEdicao()
        } catch (error) {
            console.error("Erro ao excluir banner:", error)
            setErroExclusao(error instanceof ApiError ? error.message : "Não foi possível excluir o banner.")
        } finally {
            setExcluindoId(null)
        }
    }

    return (
        <Pagina
            titulo="Banners"
            descricao="Os slides do topo da sua vitrine: controle a imagem, o texto e o valor que cada um mostra."
        >

            <form
                onSubmit={handleSubmit}
                className="card space-y-5 p-5 sm:p-7"
            >
                <div className="flex items-center gap-3">
                    <span className={`tag ${editandoId ? "tag-warning" : "tag-info"}`}>
                        {editandoId ? "Editar" : "Novo"}
                    </span>
                    <h3 className="text-sm font-bold text-[var(--ink)]">
                        {editandoId ? `Editando banner #${editandoId}` : "Novo banner"}
                    </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label className="rotulo">Título</label>
                        <input
                            type="text"
                            name="titulo"
                            value={formData.titulo}
                            onChange={handleChange}
                            placeholder="Ex: Camiseta Básica"
                            className="field"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="rotulo">Descrição</label>
                        <textarea
                            name="descricao"
                            value={formData.descricao}
                            onChange={handleChange}
                            placeholder="Texto curto abaixo do título"
                            rows={2}
                            className="field resize-y"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="rotulo">URL da imagem</label>
                        <input
                            type="text"
                            name="imagem_url"
                            value={formData.imagem_url}
                            onChange={handleChange}
                            placeholder="https://..."
                            className="field"
                        />
                    </div>

                    <div>
                        <label className="rotulo">Valor (R$)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            name="valor"
                            value={formData.valor}
                            onChange={handleChange}
                            placeholder="0,00"
                            className="field"
                        />
                    </div>

                    <div>
                        <label className="rotulo">
                            Valor antigo (R$) — opcional
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            name="valor_antigo"
                            value={formData.valor_antigo}
                            onChange={handleChange}
                            placeholder="0,00"
                            className="field"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="rotulo">
                            Link pro clique no banner (opcional)
                        </label>

                        <div className="relative">
                            <input
                                type="text"
                                value={buscaProduto}
                                onChange={(e) => {
                                    setBuscaProduto(e.target.value)
                                    setMostrarSugestoes(true)
                                }}
                                onFocus={() => setMostrarSugestoes(true)}
                                onBlur={() => setTimeout(() => setMostrarSugestoes(false), 120)}
                                placeholder="Buscar um produto pra linkar..."
                                className="field"
                            />

                            {mostrarSugestoes && produtosFiltrados.length > 0 && (
                                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[var(--linha)] bg-[var(--superficie)] shadow-lg">
                                    {produtosFiltrados.map((produto) => (
                                        <button
                                            key={produto.id}
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.preventDefault()
                                                selecionarProduto(produto)
                                            }}
                                            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--fundo)]"
                                        >
                                            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--fundo)]">
                                                {produto.imagem_url && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={urlDaImagem(produto.imagem_url)}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                    />
                                                )}
                                            </div>
                                            <span className="min-w-0 flex-1 truncate">{produto.nome}</span>
                                            <span className="num shrink-0 text-xs font-bold text-[var(--ink-2)]">
                                                {formatarMoeda(produto.preco)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <input
                            type="text"
                            name="link"
                            value={formData.link}
                            onChange={(e) => {
                                handleChange(e)
                                setBuscaProduto("")
                            }}
                            placeholder="Ou cole um link direto: /produto/108, https://..."
                            className="field font-mono text-xs"
                        />
                    </div>

                    <div>
                        <label className="rotulo">Ordem</label>
                        <input
                            type="number"
                            name="ordem"
                            value={formData.ordem}
                            onChange={handleChange}
                            className="field"
                        />
                    </div>

                    <label className="flex items-center gap-2 self-end pb-2 text-sm text-[var(--ink)]">
                        <input
                            type="checkbox"
                            name="ativo"
                            checked={formData.ativo}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-[var(--linha)] accent-[var(--azul)]"
                        />
                        Ativo (aparece na loja)
                    </label>
                </div>

                {errosForm.length > 0 && (
                    <div role="alert" className="rounded-lg bg-[var(--vermelho-fundo)] px-4 py-2.5 text-sm font-semibold text-[var(--vermelho)]">
                        {errosForm[0]}
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={salvando}
                        className="btn btn-primario"
                    >
                        {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Criar banner"}
                    </button>

                    {editandoId && (
                        <button
                            type="button"
                            onClick={cancelarEdicao}
                            className="btn btn-neutro"
                        >
                            Cancelar
                        </button>
                    )}
                </div>
            </form>

            {erroExclusao && (
                <div role="alert" className="mb-4 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-2.5 text-sm font-semibold text-[var(--vermelho)]">
                    {erroExclusao}
                </div>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[1, 2].map((item) => (
                        <div key={item} className="card h-24 animate-pulse" />
                    ))}
                </div>
            ) : erro ? (
                <p role="alert" className="rounded-lg bg-[var(--vermelho-fundo)] px-4 py-2.5 text-sm font-semibold text-[var(--vermelho)]">
                    {erro}
                </p>
            ) : banners.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--linha)] bg-[var(--superficie)] p-16 text-center">
                    <FiImage className="mx-auto w-10 text-[var(--ink-3)]" aria-hidden />
                    <h3 className="font-display mt-5 text-xl text-[var(--ink)]">
                        Nenhum banner cadastrado
                    </h3>
                    <p className="mt-2 text-sm text-[var(--ink-2)]">
                        Crie o primeiro banner acima pra ele aparecer na loja.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {banners.map((banner) => (
                        <div
                            key={banner.id}
                            className="card flex items-center gap-4 overflow-hidden p-4"
                        >
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--fundo)]">
                                {banner.imagem_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={urlDaImagem(banner.imagem_url)}
                                        alt={banner.titulo}
                                        className="h-full w-full object-cover"
                                    />
                                ) : null}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-bold text-[var(--ink)]">
                                        {banner.titulo}
                                    </p>
                                    <span className={`tag shrink-0 ${banner.ativo ? "tag-success" : "tag-neutral"}`}>
                                        {banner.ativo ? "Ativo" : "Inativo"}
                                    </span>
                                </div>

                                <div className="mt-1">
                                    <Preco
                                        valor={banner.valor}
                                        valorAntigo={banner.valor_antigo > 0 ? banner.valor_antigo : null}
                                        className="text-lg"
                                    />
                                </div>

                                <p className="mt-0.5 truncate text-xs text-[var(--ink-3)]">
                                    ordem <span className="num">{banner.ordem}</span>
                                    {banner.link ? <> · <span className="font-mono">{banner.link}</span></> : null}
                                </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => iniciarEdicao(banner)}
                                    className="rounded-lg border border-[var(--linha)] bg-[var(--superficie)] px-3 py-2 text-xs font-bold text-[var(--ink)] transition-colors hover:bg-[var(--fundo)]"
                                >
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleExcluir(banner.id)}
                                    disabled={excluindoId === banner.id}
                                    className="rounded-lg border border-[var(--vermelho)] bg-[var(--superficie)] px-3 py-2 text-xs font-bold text-[var(--vermelho)] transition-colors hover:bg-[var(--vermelho-fundo)] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {excluindoId === banner.id ? "Excluindo..." : "Excluir"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Pagina>
    )
}
