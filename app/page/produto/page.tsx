"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { cadastrarProduto } from "@/middleware/produtos"
import { sanitizeText, sanitizeUrl } from "@/security/sanitize"
import { validarProduto, type NovoProduto } from "@/security/validate"
import { ApiError } from "@/middleware/client"

// Mapa simples de nomes de cores em PT-BR para hex, usado no preview da etiqueta.
const COLOR_MAP: Record<string, string> = {
  preto: "#161616",
  branco: "#F7F7F5",
  bege: "#D8C8AE",
  cinza: "#8B8B8B",
  azul: "#2C4A7C",
  marinho: "#1C2B45",
  vermelho: "#8B2E2E",
  verde: "#2F5D4E",
  amarelo: "#D8B04A",
  rosa: "#C98A9A",
  roxo: "#5B3A6E",
  lilas: "#9B87B0",
  laranja: "#C9702D",
  marrom: "#5A3E2B",
  caramelo: "#A9723E",
  nude: "#D9B79C",
  dourado: "#B8973F",
  prata: "#B0B0AC",
  vinho: "#5E2233",
  offwhite: "#EFEAE1",
}

function resolveColor(name: string): string | null {
  if (!name) return null
  const key = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
  return COLOR_MAP[key] || null
}

interface FormState {
  nome: string
  preco: string
  estoque: string
  categoria: string
  tamanho: string
  tecido: string
  cor: string
  imagem_url: string
  rua: string
  bloco: string
}

const FORM_INICIAL: FormState = {
  nome: "",
  preco: "",
  estoque: "",
  categoria: "",
  tamanho: "",
  tecido: "",
  cor: "",
  imagem_url: "",
  rua: "",
  bloco: "",
}

// Sistema de loja única: não existe seletor de loja na interface, o
// cadastro sempre é feito para a loja #1.
const LOJA_ID = 1

export default function Produto() {
  const router = useRouter()

  const [formData, setFormData] = useState<FormState>(FORM_INICIAL)
  const [erros, setErros] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setSucesso(false)

    const produto: NovoProduto = {
      nome: sanitizeText(formData.nome),
      categoria: sanitizeText(formData.categoria),
      tamanho: sanitizeText(formData.tamanho),
      tecido: sanitizeText(formData.tecido),
      cor: sanitizeText(formData.cor),
      imagem_url: sanitizeUrl(formData.imagem_url),
      preco: parseFloat(formData.preco.replace(",", ".")),
      estoque: parseInt(formData.estoque, 10),
      loja_id: LOJA_ID,
      rua: parseInt(formData.rua, 10),
      bloco: formData.bloco,
    }

    const errosValidacao = validarProduto(produto)

    if (errosValidacao.length > 0) {
      setErros(errosValidacao)
      return
    }

    setErros([])

    try {
      setEnviando(true)
      await cadastrarProduto(produto)

      setSucesso(true)
      setFormData(FORM_INICIAL)

      setTimeout(() => router.push("/page/home"), 1200)

    } catch (error) {
      console.error("Erro ao cadastrar produto:", error)

      const mensagem =
        error instanceof ApiError ? error.message : "Não foi possível cadastrar o produto."

      setErros([mensagem])

    } finally {
      setEnviando(false)
    }
  }

  const handleCancelar = () => {
    setFormData(FORM_INICIAL)
    setErros([])
    router.push("/page/home")
  }

  const swatch = useMemo(() => resolveColor(formData.cor), [formData.cor])
  const precoFormatado = useMemo(() => {
    const n = parseFloat(formData.preco.replace(",", "."))
    if (Number.isNaN(n)) return null
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }, [formData.preco])

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#1C1B19] antialiased md:ml-64">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .font-display { font-family: 'Fraunces', serif; font-feature-settings: 'ss02' 1; }
        .font-body { font-family: 'Inter', system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .stitch {
          background-image: repeating-linear-gradient(to right, #C9A227 0 6px, transparent 6px 12px);
          background-size: 12px 1.5px;
          background-repeat: repeat-x;
        }
        .field {
          width: 100%;
          background: #EFEDE6;
          color: #1C1B19;
          padding: 0.7rem 0.9rem;
          font-size: 0.875rem;
          border-radius: 0.6rem;
          border: 1px solid transparent;
          transition: background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
        }
        .field::placeholder { color: #A19E93; }
        .field:focus {
          outline: none;
          background: #FFFFFF;
          border-color: #2F5D4E;
          box-shadow: 0 0 0 3px rgba(47, 93, 78, 0.15);
        }
        .field:focus-visible { outline: none; }
      `}</style>

      <main className="px-4 py-8 sm:px-6 md:px-10 md:py-12 lg:px-14 pb-16">
        <div className="max-w-6xl mx-auto">
          {/* Cabeçalho */}
          <div className="space-y-2 mb-8 md:mb-10">
            <div className="flex items-center gap-2 text-xs font-medium text-[#8E8B80] font-body">
              <span>Produtos</span>
              <span>/</span>
              <span className="text-[#1C1B19]">Novo cadastro</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1B19]">
              Novo produto
            </h1>
            <p className="text-sm text-[#6F6C61] font-body max-w-md">
              Preencha a ficha técnica da peça. A etiqueta ao lado é atualizada em tempo real.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-6 font-body min-w-0">
              {/* Bloco 1 */}
              <section className="bg-white p-5 sm:p-7 rounded-2xl border border-[#EAE7DE] space-y-5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[#2F5D4E] bg-[#2F5D4E]/10 px-2 py-1 rounded">01</span>
                  <h2 className="text-sm font-semibold text-[#1C1B19]">Informações básicas</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-xs font-medium text-[#6F6C61]">Nome do produto</label>
                    <input
                      type="text"
                      name="nome"
                      value={formData.nome}
                      onChange={handleChange}
                      placeholder="Ex: Camiseta Algodão Premium"
                      className="field"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#6F6C61]">Categoria</label>
                    <select
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleChange}
                      className="field cursor-pointer"
                    >
                      <option value="">Selecione...</option>
                      <option value="Camisetas">Camisetas</option>
                      <option value="Calças">Calças</option>
                      <option value="Vestidos">Vestidos</option>
                      <option value="Casacos">Casacos</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Bloco 2 */}
              <section className="bg-white p-5 sm:p-7 rounded-2xl border border-[#EAE7DE] space-y-5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[#2F5D4E] bg-[#2F5D4E]/10 px-2 py-1 rounded">02</span>
                  <h2 className="text-sm font-semibold text-[#1C1B19]">Especificações da peça</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#6F6C61]">Tamanho</label>
                    <select
                      name="tamanho"
                      value={formData.tamanho}
                      onChange={handleChange}
                      className="field cursor-pointer"
                    >
                      <option value="">Selecione...</option>
                      <option value="PP">PP</option>
                      <option value="P">P</option>
                      <option value="M">M</option>
                      <option value="G">G</option>
                      <option value="GG">GG</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#6F6C61]">Tecido</label>
                    <input
                      type="text"
                      name="tecido"
                      value={formData.tecido}
                      onChange={handleChange}
                      placeholder="Ex: 100% Algodão"
                      className="field"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#6F6C61]">Cor</label>
                    <input
                      type="text"
                      name="cor"
                      value={formData.cor}
                      onChange={handleChange}
                      placeholder="Ex: Preto"
                      className="field"
                    />
                  </div>
                </div>
              </section>

              {/* Bloco 3 */}
              <section className="bg-white p-5 sm:p-7 rounded-2xl border border-[#EAE7DE] space-y-5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[#2F5D4E] bg-[#2F5D4E]/10 px-2 py-1 rounded">03</span>
                  <h2 className="text-sm font-semibold text-[#1C1B19]">Valores e mídia</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#6F6C61]">Preço (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="preco"
                      value={formData.preco}
                      onChange={handleChange}
                      placeholder="89.90"
                      className="field font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#6F6C61]">Estoque</label>
                    <input
                      type="number"
                      min="0"
                      name="estoque"
                      value={formData.estoque}
                      onChange={handleChange}
                      placeholder="50"
                      className="field font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-xs font-medium text-[#6F6C61]">URL da imagem</label>
                    <input
                      type="url"
                      name="imagem_url"
                      value={formData.imagem_url}
                      onChange={handleChange}
                      placeholder="https://exemplo.com/imagem.jpg"
                      className="field"
                    />
                  </div>
                </div>
              </section>

              {/* Bloco 4 */}
              <section className="bg-white p-5 sm:p-7 rounded-2xl border border-[#EAE7DE] space-y-5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[#2F5D4E] bg-[#2F5D4E]/10 px-2 py-1 rounded">04</span>
                  <h2 className="text-sm font-semibold text-[#1C1B19]">Local no estoque</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#6F6C61]">Rua</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      name="rua"
                      value={formData.rua}
                      onChange={handleChange}
                      placeholder="Ex: 3"
                      className="field font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#6F6C61]">Bloco</label>
                    <select
                      name="bloco"
                      value={formData.bloco}
                      onChange={handleChange}
                      className="field cursor-pointer"
                    >
                      <option value="">Selecione...</option>
                      <option value="A">Bloco A</option>
                      <option value="B">Bloco B</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Feedback */}
              {erros.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-1">
                  {erros.map((mensagem) => (
                    <p key={mensagem}>{mensagem}</p>
                  ))}
                </div>
              )}

              {sucesso && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Produto cadastrado com sucesso! Redirecionando...
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCancelar}
                  disabled={enviando}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-[#6F6C61] hover:bg-[#EAE7DE] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[#2F5D4E] hover:bg-[#264C40] text-white transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {enviando ? "Cadastrando..." : "Cadastrar produto"}
                </button>
              </div>
            </form>

            {/* Etiqueta / preview ao vivo */}
            <div className="lg:sticky lg:top-10">
              <div className="bg-white rounded-2xl border border-[#EAE7DE] p-5 relative overflow-hidden">
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[#8E8B80] font-body font-semibold mb-4">
                  Pré-visualização da etiqueta
                </p>

                {/* Ticket / hang tag */}
                <div className="relative bg-[#F6F5F1] rounded-xl p-5 pt-6">
                  {/* furo da etiqueta */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#F6F5F1] border-2 border-[#D9D5C8]" />
                  <div className="h-2 stitch mb-4 opacity-70" />

                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-xl leading-snug text-[#1C1B19] break-words">
                      {formData.nome || "Nome da peça"}
                    </h3>
                    {swatch ? (
                      <span
                        className="w-6 h-6 rounded-full border border-black/10 shrink-0 mt-1"
                        style={{ backgroundColor: swatch }}
                        title={formData.cor}
                      />
                    ) : formData.cor ? (
                      <span className="text-[0.65rem] font-mono text-[#6F6C61] border border-[#D9D5C8] rounded px-1.5 py-0.5 shrink-0 mt-1">
                        {formData.cor}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-[#8E8B80] font-body mt-1">
                    {formData.categoria || "Categoria"}
                  </p>

                  <div className="flex items-center gap-2 mt-4">
                    <span className="font-mono text-2xl font-medium text-[#2F5D4E]">
                      {precoFormatado || "R$ —"}
                    </span>
                  </div>

                  <div className="h-2 stitch my-4 opacity-70" />

                  <dl className="grid grid-cols-2 gap-y-2.5 text-xs font-body">
                    <dt className="text-[#8E8B80]">Tamanho</dt>
                    <dd className="text-right font-medium text-[#1C1B19]">
                      {formData.tamanho || "—"}
                    </dd>
                    <dt className="text-[#8E8B80]">Tecido</dt>
                    <dd className="text-right font-medium text-[#1C1B19] break-words">
                      {formData.tecido || "—"}
                    </dd>
                    <dt className="text-[#8E8B80]">Estoque</dt>
                    <dd className="text-right font-medium text-[#1C1B19] font-mono">
                      {formData.estoque || "—"}
                    </dd>
                    <dt className="text-[#8E8B80]">Local</dt>
                    <dd className="text-right font-medium text-[#1C1B19] font-mono">
                      {formData.rua && formData.bloco
                        ? `Rua ${formData.rua} · Bloco ${formData.bloco}`
                        : "—"}
                    </dd>
                  </dl>
                </div>

                {formData.imagem_url && (
                  <div className="mt-4 rounded-xl overflow-hidden border border-[#EAE7DE] aspect-[4/3] bg-[#F6F5F1]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formData.imagem_url}
                      alt={formData.nome || "Pré-visualização do produto"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

