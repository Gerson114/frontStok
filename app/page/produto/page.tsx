"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { cadastrarProdutoVariantes } from "@/middleware/produtos"
import { listarEnderecos, type EnderecoEstoque } from "@/middleware/estoque"
import { sanitizeText, sanitizeUrl, sanitizeDescricao } from "@/security/sanitize"
import { validarProdutoVariantes, type NovoProdutoVariantes } from "@/security/validate"
import { ApiError } from "@/middleware/client"
import Preco from "@/app/components/preco/preco"
import {
  CamposDeFicha,
  CamposDeVariacao,
  fichaParaAtributos,
  type LinhaFicha,
  type LinhaVariacao,
} from "@/app/components/produto/campos"
import { FiAlertCircle, FiCheckCircle } from "react-icons/fi"
import { urlDaImagem } from "@/security/imagem"

// Mapa simples de nomes de cores em PT-BR para hex, usado no preview da
// etiqueta quando a ficha técnica traz uma cor.
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
  descricao: string
  preco: string
  categoria: string
  imagem_url: string

  /**
   * Código da prateleira onde guardar as peças. Em branco é o caso normal: o
   * servidor escolhe, pondo o produto junto do que já existe dele ou no
   * trecho mais vazio.
   */
  endereco: string
}

const FORM_INICIAL: FormState = {
  nome: "",
  descricao: "",
  preco: "",
  categoria: "",
  imagem_url: "",
  endereco: "",
}

// Uma linha de variação já aberta: o produto mais simples tem uma só, e o
// lojista só precisa digitar o estoque dela.
const VARIACOES_INICIAIS: LinhaVariacao[] = [{ variacao: "", estoque: "" }]

// Sistema de loja única: não existe seletor de loja na interface, o
// cadastro sempre é feito para a loja #1.
const LOJA_ID = 1

export default function Produto() {
  const router = useRouter()

  const [formData, setFormData] = useState<FormState>(FORM_INICIAL)
  const [variacaoRotulo, setVariacaoRotulo] = useState("")
  const [variacoes, setVariacoes] = useState<LinhaVariacao[]>(VARIACOES_INICIAIS)
  const [ficha, setFicha] = useState<LinhaFicha[]>([])
  const [erros, setErros] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  // Os endereços cadastrados, para o lojista poder dizer onde guardar quando
  // quiser. Só os liberados: mandar peça para prateleira bloqueada é recusado
  // pelo servidor, e oferecê-la seria prometer o que não vai acontecer.
  const [enderecos, setEnderecos] = useState<EnderecoEstoque[]>([])

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      try {
        const lista = await listarEnderecos()
        if (!cancelado) setEnderecos(lista.filter((endereco) => !endereco.bloqueado))
      } catch {
        // Sem a lista, o cadastro continua funcionando: endereço em branco é
        // o caso normal, e aí quem escolhe onde guardar é o servidor.
      }
    }

    carregar()

    return () => {
      cancelado = true
    }
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setSucesso(false)

    const produto: NovoProdutoVariantes = {
      nome: sanitizeText(formData.nome),
      descricao: sanitizeDescricao(formData.descricao),
      categoria: sanitizeText(formData.categoria),
      variacao_rotulo: sanitizeText(variacaoRotulo),
      atributos: fichaParaAtributos(ficha),
      imagem_url: sanitizeUrl(formData.imagem_url),
      preco: parseFloat(formData.preco.replace(",", ".")),
      loja_id: LOJA_ID,
      endereco: formData.endereco,
      // Linha em branco é linha que o lojista não usou: some antes de virar
      // erro de validação.
      variacoes: variacoes
        .filter((linha) => linha.variacao.trim() || linha.estoque.trim())
        .map((linha) => ({
          variacao: sanitizeText(linha.variacao),
          estoque: parseInt(linha.estoque, 10),
        })),
    }

    const errosValidacao = validarProdutoVariantes(produto)

    if (errosValidacao.length > 0) {
      setErros(errosValidacao)
      return
    }

    setErros([])

    try {
      setEnviando(true)
      await cadastrarProdutoVariantes(produto)

      setSucesso(true)
      setFormData(FORM_INICIAL)
      setVariacaoRotulo("")
      setVariacoes(VARIACOES_INICIAIS)
      setFicha([])

      setTimeout(() => router.push("/page/produtos"), 1200)

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
    setVariacaoRotulo("")
    setVariacoes(VARIACOES_INICIAIS)
    setFicha([])
    setErros([])
    router.push("/page/produtos")
  }

  // A cor deixou de ser campo fixo: se o lojista puser "Cor" na ficha
  // técnica, o preview continua mostrando a bolinha.
  const corDaFicha = ficha.find((linha) => linha.nome.trim().toLowerCase() === "cor")?.valor ?? ""
  const swatch = useMemo(() => resolveColor(corDaFicha), [corDaFicha])
  const precoNumero = useMemo(() => {
    const n = parseFloat(formData.preco.replace(",", "."))
    return Number.isNaN(n) ? null : n
  }, [formData.preco])

  const variacoesPreenchidas = variacoes.filter((linha) => linha.variacao.trim())
  const estoqueTotal = variacoes.reduce(
    (total, linha) => total + (parseInt(linha.estoque, 10) || 0),
    0
  )

  return (
    <div className="min-h-screen bg-[#F0F3F4] text-[#1E2428] antialiased md:ml-64">
      <main className="px-4 py-8 sm:px-6 md:px-10 md:py-12 lg:px-14 pb-16">
        <div className="max-w-6xl mx-auto">
          {/* Cabeçalho */}
          <div className="space-y-2 mb-8 md:mb-10">
            <div className="flex items-center gap-2 text-xs font-medium text-[#5A6469]">
              <span>Produtos</span>
              <span>/</span>
              <span className="text-[#1E2428]">Novo cadastro</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-[#1E2428]">
              Novo produto
            </h1>
            <p className="text-sm text-[#5A6469] max-w-md">
              Preencha a ficha do produto. A etiqueta ao lado é atualizada em tempo real.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-6 min-w-0">
              {/* Bloco 1 */}
              <section className="card p-5 sm:p-7 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E6F3FF] text-xs font-bold text-[#0075E2]">01</span>
                  <h2 className="font-display text-sm text-[#1E2428]">Informações básicas</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="rotulo">Nome do produto</label>
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
                    <label className="rotulo">Categoria</label>
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

                <div className="space-y-1.5">
                  <label className="rotulo">Descrição</label>
                  <textarea
                    name="descricao"
                    value={formData.descricao}
                    onChange={handleChange}
                    placeholder="Detalhes do produto para o cliente: o que é, para que serve, como usar..."
                    rows={4}
                    className="field resize-y"
                  />
                </div>
              </section>

              {/* Bloco 2 */}
              <section className="card p-5 sm:p-7 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E6F3FF] text-xs font-bold text-[#0075E2]">02</span>
                  <h2 className="font-display text-sm text-[#1E2428]">Variações e ficha técnica</h2>
                </div>

                <CamposDeVariacao
                  rotulo={variacaoRotulo}
                  aoMudarRotulo={setVariacaoRotulo}
                  linhas={variacoes}
                  aoMudarLinhas={setVariacoes}
                />

                <div className="space-y-1.5 border-t border-[#E4E9EB] pt-5">
                  <label className="rotulo">Ficha técnica</label>
                  <p className="pb-1 text-xs text-[#5A6469]">
                    O que descreve este produto no seu ramo: material, marca, garantia,
                    validade, dimensões. Vale para todas as variações.
                  </p>

                  <CamposDeFicha linhas={ficha} aoMudar={setFicha} />
                </div>
              </section>

              {/* Bloco 3 */}
              <section className="card p-5 sm:p-7 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E6F3FF] text-xs font-bold text-[#0075E2]">03</span>
                  <h2 className="font-display text-sm text-[#1E2428]">Valores e mídia</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="rotulo">Preço (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="preco"
                      value={formData.preco}
                      onChange={handleChange}
                      placeholder="89.90"
                      className="field num"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="rotulo">URL da imagem</label>
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
              <section className="card p-5 sm:p-7 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E6F3FF] text-xs font-bold text-[#0075E2]">04</span>
                  <h2 className="font-display text-sm text-[#1E2428]">Local no estoque</h2>
                </div>

                <div className="space-y-1.5">
                  <label className="rotulo">Endereço</label>
                  <select
                    name="endereco"
                    value={formData.endereco}
                    onChange={handleChange}
                    className="field cursor-pointer"
                  >
                    <option value="">Deixar o sistema escolher</option>

                    {enderecos.map((endereco) => (
                      <option key={endereco.id} value={endereco.codigo}>
                        {endereco.codigo} · {endereco.nome} ({endereco.tipo_nome})
                      </option>
                    ))}
                  </select>

                  <p className="text-xs text-[#5A6469]">
                    Em branco, o servidor guarda as peças junto do que já existe deste produto
                    ou no trecho mais vazio. Guardar mercadoria não deveria exigir que alguém
                    decida, caixa por caixa, em que prateleira ela cabe.
                  </p>
                </div>
              </section>

              {/* Feedback */}
              {erros.length > 0 && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]"
                >
                  <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                  <div className="space-y-1">
                    {erros.map((mensagem) => (
                      <p key={mensagem}>{mensagem}</p>
                    ))}
                  </div>
                </div>
              )}

              {sucesso && (
                <div
                  role="status"
                  className="flex items-start gap-2.5 rounded-lg bg-[#E0FFEE] px-4 py-3 text-sm font-semibold text-[#08A022]"
                >
                  <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                  <span>Produto cadastrado com sucesso! Redirecionando...</span>
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCancelar}
                  disabled={enviando}
                  className="btn btn-neutro"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className="btn btn-primario"
                >
                  {enviando ? "Cadastrando..." : "Cadastrar produto"}
                </button>
              </div>
            </form>

            {/* Etiqueta / preview ao vivo */}
            <div className="lg:sticky lg:top-10">
              <div className="card relative overflow-hidden p-5">
                <p className="mb-4 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#8C969B]">
                  Pré-visualização da etiqueta
                </p>

                {/* Ticket / hang tag */}
                <div className="rounded-lg bg-[#F0F3F4] p-5">

                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-xl leading-snug text-[#1E2428] break-words">
                      {formData.nome || "Nome do produto"}
                    </h3>
                    {swatch ? (
                      <span
                        className="w-6 h-6 rounded-full border border-black/10 shrink-0 mt-1"
                        style={{ backgroundColor: swatch }}
                        title={corDaFicha}
                      />
                    ) : corDaFicha ? (
                      <span className="tag tag-neutral shrink-0 mt-1">
                        {corDaFicha}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-[#5A6469] mt-1">
                    {formData.categoria || "Categoria"}
                  </p>

                  <div className="mt-4">
                    {precoNumero != null ? (
                      <Preco valor={precoNumero} className="text-2xl" />
                    ) : (
                      <span className="preco text-2xl text-[#8C969B]">R$ —</span>
                    )}
                  </div>


                  <dl className="grid grid-cols-2 gap-y-2.5 text-xs">
                    <dt className="text-[#5A6469]">{variacaoRotulo.trim() || "Variações"}</dt>
                    <dd className="text-right font-semibold text-[#1E2428] break-words">
                      {variacoesPreenchidas.length > 0
                        ? variacoesPreenchidas.map((linha) => linha.variacao.trim()).join(", ")
                        : "—"}
                    </dd>
                    <dt className="text-[#5A6469]">Estoque total</dt>
                    <dd className="num text-right font-semibold text-[#1E2428]">
                      {variacoesPreenchidas.length > 0 ? estoqueTotal : "—"}
                    </dd>
                    <dt className="text-[#5A6469]">Local</dt>
                    <dd className="num text-right font-semibold text-[#1E2428]">
                      {formData.endereco || "o sistema escolhe"}
                    </dd>
                  </dl>
                </div>

                {formData.imagem_url && (
                  <div className="mt-4 rounded-xl overflow-hidden border border-[#D3DADD] aspect-[4/3] bg-[#F0F3F4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={urlDaImagem(formData.imagem_url)}
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

