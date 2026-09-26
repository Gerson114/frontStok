"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { buscarProdutoPorId, editarProduto, listarProdutos } from "@/middleware/produtos"
import { sanitizeText, sanitizeUrl, sanitizeDescricao } from "@/security/sanitize"
import { validarProdutoEditavel, type ProdutoEditavel } from "@/security/validate"
import { ApiError } from "@/middleware/client"
import {
  CamposDeFicha,
  atributosParaFicha,
  fichaParaAtributos,
  type LinhaFicha,
} from "@/app/components/produto/campos"
import Preco from "@/app/components/preco/preco"
import { FiAlertCircle, FiCheckCircle } from "react-icons/fi"
import { Pagina, Estado } from "@/app/components/pagina/pagina"
import { urlDaImagem } from "@/security/imagem"

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
  descricao: string
  preco: string
  estoque: string
  categoria: string
  variacao: string
  variacao_rotulo: string
  imagem_url: string
}

const FORM_VAZIO: FormState = {
  nome: "",
  descricao: "",
  preco: "",
  estoque: "",
  categoria: "",
  variacao: "",
  variacao_rotulo: "",
  imagem_url: "",
}

// Sistema de loja única: não existe seletor de loja na interface, a
// edição sempre preserva a loja original do produto.
const LOJA_ID = 1

export default function EditarProduto() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [carregando, setCarregando] = useState(true)

  // As categorias que ESTA loja já usou, para sugerir enquanto se digita. O
  // sistema não tem lista própria: ele não sabe (nem deve supor) se a loja
  // vende ventilador, panela ou camisa.
  const [categorias, setCategorias] = useState<string[]>([])
  const [ficha, setFicha] = useState<LinhaFicha[]>([])
  const [erroCarregamento, setErroCarregamento] = useState("")

  const [formData, setFormData] = useState<FormState>(FORM_VAZIO)
  const [erros, setErros] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {

    async function carregar() {

      try {

        const id = Number(params.id)
        const produto = await buscarProdutoPorId(id)

        if (!produto) {
          setErroCarregamento("Produto não encontrado.")
          return
        }

        setFormData({
          nome: produto.nome,
          descricao: produto.descricao,
          preco: String(produto.preco),
          estoque: String(produto.estoque),
          categoria: produto.categoria,
          variacao: produto.variacao,
          variacao_rotulo: produto.variacao_rotulo,
          imagem_url: produto.imagem_url,
        })

        setFicha(atributosParaFicha(produto.atributos))

        // As sugestões vêm depois do produto e num try próprio: falhar aqui
        // não pode impedir a edição de abrir.
        try {
          const produtos = await listarProdutos()

          const nomes = produtos
            .map((item) => item.categoria?.trim())
            .filter((nome): nome is string => Boolean(nome))

          setCategorias(Array.from(new Set(nomes)).sort((a, b) => a.localeCompare(b, "pt-BR")))
        } catch {
          // Sem sugestões, o campo continua sendo o que é: texto livre.
        }

      } catch (error) {

        console.error("Erro ao carregar produto:", error)

        setErroCarregamento("Não foi possível carregar o produto.")

      } finally {

        setCarregando(false)

      }
    }

    carregar()

  }, [params.id])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setSucesso(false)

    const produto: ProdutoEditavel = {
      nome: sanitizeText(formData.nome),
      descricao: sanitizeDescricao(formData.descricao),
      categoria: sanitizeText(formData.categoria),
      variacao: sanitizeText(formData.variacao),
      variacao_rotulo: sanitizeText(formData.variacao_rotulo),
      atributos: fichaParaAtributos(ficha),
      imagem_url: sanitizeUrl(formData.imagem_url),
      preco: parseFloat(formData.preco.replace(",", ".")),
      estoque: parseInt(formData.estoque, 10),
      loja_id: LOJA_ID,
    }

    const errosValidacao = validarProdutoEditavel(produto)

    if (errosValidacao.length > 0) {
      setErros(errosValidacao)
      return
    }

    setErros([])

    try {
      setEnviando(true)
      await editarProduto(Number(params.id), produto)

      setSucesso(true)

      setTimeout(() => router.push("/page/produtos"), 1200)

    } catch (error) {
      console.error("Erro ao editar produto:", error)

      const mensagem =
        error instanceof ApiError ? error.message : "Não foi possível salvar as alterações."

      setErros([mensagem])

    } finally {
      setEnviando(false)
    }
  }

  const handleCancelar = () => {
    router.push("/page/produtos")
  }

  // A cor deixou de ser campo fixo: vem da ficha técnica, quando houver.
  const corDaFicha = ficha.find((linha) => linha.nome.trim().toLowerCase() === "cor")?.valor ?? ""
  const swatch = useMemo(() => resolveColor(corDaFicha), [corDaFicha])
  const precoNumero = useMemo(() => {
    const n = parseFloat(formData.preco.replace(",", "."))
    return Number.isNaN(n) ? null : n
  }, [formData.preco])

  if (carregando) {
    return (
      <Pagina titulo="Editar produto" volta={{ nome: "Produtos", rota: "/page/produtos" }}>
        <div className="card p-8 text-center text-sm text-[var(--ink-2)]">Carregando...</div>
      </Pagina>
    )
  }

  if (erroCarregamento) {
    return (
      <Pagina titulo="Editar produto" volta={{ nome: "Produtos", rota: "/page/produtos" }}>
        <Estado
          Icone={FiAlertCircle}
          tom="erro"
          titulo="Não foi possível abrir este produto"
          texto={erroCarregamento}
          acao={
            <button onClick={() => router.push("/page/produtos")} className="btn btn-primario">
              Voltar para Produtos
            </button>
          }
        />
      </Pagina>
    )
  }

  return (
    <Pagina
      titulo="Editar produto"
      descricao="Atualize a ficha do produto. A etiqueta ao lado é atualizada em tempo real."
      volta={{ nome: "Produtos", rota: "/page/produtos" }}
    >

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-6 min-w-0">
          {/* Bloco 1 */}
          <section className="card p-4 sm:p-5 sm:p-7 space-y-5">
            <div className="flex items-center gap-3">
              <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--azul-suave)] text-xs font-bold text-[var(--azul-escuro)]">01</span>
              <h2 className="font-display text-sm text-[var(--ink)]">Informações básicas</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="rotulo">Nome do produto</label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  placeholder="Ex: Ventilador de teto 3 pás"
                  className="field"
                />
              </div>

              <div className="space-y-1.5">
                <label className="rotulo" htmlFor="categoria">Categoria</label>

                {/* Campo livre com sugestões, e não uma lista fixa.
                    A lista fixa que morava aqui era de vestuário, e fazia dois
                    estragos numa loja de outro ramo: não havia o que escolher,
                    e a categoria que o produto JÁ tinha sumia da tela ao abrir
                    a edição — bastava salvar para perdê-la. */}
                <input
                  id="categoria"
                  type="text"
                  name="categoria"
                  list="categorias-da-loja"
                  value={formData.categoria}
                  onChange={handleChange}
                  placeholder="Ex: Ventiladores"
                  maxLength={60}
                  className="field"
                  autoComplete="off"
                />

                <datalist id="categorias-da-loja">
                  {categorias.map((categoria) => (
                    <option key={categoria} value={categoria} />
                  ))}
                </datalist>
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
          <section className="card p-4 sm:p-5 sm:p-7 space-y-5">
            <div className="flex items-center gap-3">
              <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--azul-suave)] text-xs font-bold text-[var(--azul-escuro)]">02</span>
              <h2 className="font-display text-sm text-[var(--ink)]">Variação e ficha técnica</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="rotulo" htmlFor="variacao_rotulo">
                  O que divide este produto?
                </label>
                <input
                  id="variacao_rotulo"
                  type="text"
                  name="variacao_rotulo"
                  list="rotulos-edicao"
                  value={formData.variacao_rotulo}
                  onChange={handleChange}
                  placeholder="Ex: Tamanho, Voltagem, Peso"
                  className="field"
                />
                <datalist id="rotulos-edicao">
                  <option value="Tamanho" />
                  <option value="Voltagem" />
                  <option value="Peso" />
                  <option value="Volume" />
                  <option value="Cor" />
                  <option value="Sabor" />
                  <option value="Numeração" />
                  <option value="Modelo" />
                </datalist>
              </div>

              <div className="space-y-1.5">
                <label className="rotulo" htmlFor="variacao">
                  {formData.variacao_rotulo.trim() || "Variação"}
                </label>
                <input
                  id="variacao"
                  type="text"
                  name="variacao"
                  value={formData.variacao}
                  onChange={handleChange}
                  placeholder="Ex: P, 220V, 500 g"
                  className="field"
                />
                <p className="text-xs text-[var(--ink-2)]">
                  Cada variação é um produto próprio. Para cadastrar outra, use a
                  tela de cadastro — aqui muda só esta.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-[var(--linha-suave)] pt-5">
              <label className="rotulo">Ficha técnica</label>
              <p className="pb-1 text-xs text-[var(--ink-2)]">
                O que descreve este produto no seu ramo: material, marca, garantia,
                validade, dimensões.
              </p>

              <CamposDeFicha linhas={ficha} aoMudar={setFicha} />
            </div>
          </section>

          {/* Bloco 3 */}
          <section className="card p-4 sm:p-5 sm:p-7 space-y-5">
            <div className="flex items-center gap-3">
              <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--azul-suave)] text-xs font-bold text-[var(--azul-escuro)]">03</span>
              <h2 className="font-display text-sm text-[var(--ink)]">Valores e mídia</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
                <label className="rotulo">Estoque</label>
                <input
                  type="number"
                  min="0"
                  name="estoque"
                  value={formData.estoque}
                  onChange={handleChange}
                  placeholder="50"
                  className="field num"
                />
                <p className="text-xs text-[var(--ink-2)]">
                  Unidades novas (estoque maior) entram sem local — guarde-as na tela de Estoque.
                </p>
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

          {/* Feedback */}
          {erros.length > 0 && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]"
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
              className="flex items-start gap-2.5 rounded-lg bg-[var(--verde-fundo)] px-4 py-3 text-sm font-semibold text-[var(--verde)]"
            >
              <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
              <span>Produto atualizado com sucesso! Redirecionando...</span>
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
              {enviando ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>

        {/* Etiqueta / preview ao vivo */}
        <div className="lg:sticky lg:top-10">
          <div className="card relative overflow-hidden p-5">
            <p className="mb-4 text-[0.68rem] font-bold text-[var(--ink-3)]">
              Pré-visualização da etiqueta
            </p>

            {/* Ticket / hang tag */}
            <div className="rounded-lg bg-[var(--fundo)] p-5">

              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl leading-snug text-[var(--ink)] break-words">
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

              <p className="text-xs text-[var(--ink-2)] mt-1">
                {formData.categoria || "Categoria"}
              </p>

              <div className="mt-4">
                {precoNumero != null ? (
                  <Preco valor={precoNumero} className="text-2xl" />
                ) : (
                  <span className="preco text-2xl text-[var(--ink-3)]">R$ —</span>
                )}
              </div>


              <dl className="grid grid-cols-2 gap-y-2.5 text-xs">
                <dt className="text-[var(--ink-2)]">
                  {formData.variacao_rotulo.trim() || "Variação"}
                </dt>
                <dd className="text-right font-semibold text-[var(--ink)] break-words">
                  {formData.variacao || "—"}
                </dd>
                <dt className="text-[var(--ink-2)]">Estoque</dt>
                <dd className="num text-right font-semibold text-[var(--ink)]">
                  {formData.estoque || "—"}
                </dd>
              </dl>
            </div>

            {formData.imagem_url && (
              <div className="mt-4 rounded-xl overflow-hidden border border-[var(--linha)] aspect-[4/3] bg-[var(--fundo)]">
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
    </Pagina>
  )
}
