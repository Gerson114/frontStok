import type { Metadata } from "next"
import { Marca } from "./components/marca/marca"
import Link from "next/link"
import Preco from "./components/preco/preco"
import Topo from "./components/header/topo"
import {
  FiArrowRight,
  FiBox,
  FiCheck,
  FiImage,
  FiMapPin,
  FiPrinter,
  FiShoppingCart,
  FiTag,
  FiAlertTriangle,
} from "react-icons/fi"
import type { IconType } from "react-icons"

export const metadata: Metadata = {
  title: "Arara | Gestão de estoque peça a peça para lojas de roupa",
  description:
    "Cadastre produtos, imprima etiquetas com código de barras, controle cada peça pelo endereço em que ela está, receba pedidos pela vitrine e acompanhe vendas, avarias e cancelamentos.",
}

// Largura das barras do código de barras decorativo do topo. Índice par é
// barra preta, ímpar é o espaço em branco — o mesmo desenho da etiqueta que
// o lojista imprime em /page/produto/etiqueta.
const BARRAS = [
  3, 2, 1, 2, 4, 1, 2, 3, 1, 1, 2, 2, 3, 1, 1, 4, 2, 1, 3, 2, 1, 1, 4, 2,
  2, 3, 1, 2, 1, 1, 3, 2, 4, 1, 2, 2, 1, 3, 2, 1, 1, 2, 3, 4, 1, 2, 2, 1,
]

const passos: { titulo: string; texto: string }[] = [
  {
    titulo: "Cadastre a peça",
    texto:
      "Nome, categoria, tamanho, tecido, cor e preço. O sistema gera o código do produto e uma unidade para cada peça física que entrou.",
  },
  {
    titulo: "Imprima a etiqueta",
    texto:
      "Cada peça sai com código próprio (000618-1, 000618-2) e código de barras. Duas camisas iguais deixam de ser um número no estoque e passam a ser duas peças distintas.",
  },
  {
    titulo: "Guarde e localize",
    texto:
      "Cada peça guardada num endereço do seu estoque. Peças do mesmo produto podem estar em lugares diferentes, e você sabe onde cada uma está na hora de buscar.",
  },
  {
    titulo: "Venda e acompanhe",
    texto:
      "Venda no balcão dando baixa na unidade ou receba pedidos pela vitrine. Vendidos, cancelados e avarias ficam separados, cada um na sua tela.",
  },
]

const recursos: { titulo: string; texto: string; Icone: IconType }[] = [
  {
    titulo: "Controle peça a peça",
    texto:
      "Em vez de uma quantidade em estoque, cada peça física tem registro próprio: código, localização e situação atual.",
    Icone: FiBox,
  },
  {
    titulo: "Etiqueta com código de barras",
    texto:
      "Etiqueta pronta para impressão, com o código de barras da peça — o mesmo que o leitor do balcão reconhece.",
    Icone: FiPrinter,
  },
  {
    titulo: "Endereçamento peça a peça",
    texto:
      "Diga onde a peça está guardada e transfira de lugar quando ela mudar. Peça sem local definido aparece sinalizada.",
    Icone: FiMapPin,
  },
  {
    titulo: "Pedidos da vitrine",
    texto:
      "O pedido chega com cliente, contato e itens, e caminha por pendente, confirmado, enviado e entregue — sem baixar estoque antes da hora.",
    Icone: FiShoppingCart,
  },
  {
    titulo: "Avarias sem perder o histórico",
    texto:
      "Marque a peça danificada e ela sai do estoque disponível sem sumir do sistema. Se tiver conserto, é só restaurar.",
    Icone: FiAlertTriangle,
  },
  {
    titulo: "Promoções e banners",
    texto:
      "Defina preço promocional por produto e monte os banners do topo da vitrine, com ordem e ativação controladas por você.",
    Icone: FiImage,
  },
]

// O que a assinatura entrega, como isso se apresenta a quem ainda está
// decidindo. É uma só, com tudo dentro: o cadastro da loja física — o
// produto, a peça com código próprio, a etiqueta, a entrada de mercadoria, os
// endereços das prateleiras e a venda no balcão — mais a vitrine pública e
// tudo o que vive dela: pedidos online, separação, devoluções, banners e o
// estoque se organizando sozinho.
//
// A lista que vale é a do servidor (ver RecursosDoSistema, em
// internal/services/assinatura/recursos.go), que é a mesma que a tela de
// assinatura mostra. Quem mudar o que o sistema inclui mexe lá, e passa aqui
// para esta página não desmentir aquela.
//
// O valor está escrito aqui de propósito, e é o único lugar do sistema em que
// isso acontece: esta página é lida por quem ainda não tem conta, e buscar
// preço no servidor para desenhá-la deixaria a tela de vendas na mão de uma
// chamada que pode falhar. Quem mudar o preço muda aqui e no provedor de
// cobrança — no painel de quem já é cliente o valor continua vindo de lá,
// sempre igual ao da fatura.
const MENSALIDADE = 100

const inclui: string[] = [
  "Cadastro de produtos, com tamanho, tecido e cor",
  "Controle peça a peça, cada uma com código próprio",
  "Etiqueta com código de barras para imprimir",
  "Entrada de mercadoria, com custo e fornecedor",
  "Endereços das prateleiras, com placas para imprimir",
  "Venda no balcão, bipando a etiqueta",
  "Promoções, avarias e histórico de vendas",
  "WhatsApp da loja dentro do painel",
  "Vitrine pública alimentada pelo seu próprio estoque",
  "Pedidos online, de pendente a entregue",
  "Pedidos de WhatsApp e telefone na mesma separação",
  "Separação com o endereço de cada peça, uma volta só",
  "Etiquetas de pedido prontas para imprimir",
  "Devoluções isoladas até a tratativa",
  "Tarefas, contagem e reposição de prateleira",
  "Banners do topo, com ordem e ativação",
]

export default function Home() {
  return (
    <div className="min-h-screen bg-white">

      {/* Topo público, compartilhado com as telas de login e cadastro. */}
      <Topo />

      {/* ==================================================================
          HERO
          ================================================================== */}
      <section className="border-b border-[#E4E9EB] bg-[#F0F3F4]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">

          <div>
            <span className="tag tag-info">Gestão de loja de roupas</span>

            <h1 className="font-display mt-4 text-3xl leading-tight text-[#1E2428] sm:text-[2.6rem]">
              Cada peça da sua loja com código, lugar e situação própria.
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#5A6469]">
              O Arara troca o &ldquo;tenho 8 no estoque&rdquo; por oito peças identificadas
              uma a uma: etiqueta com código de barras, endereço de guarda,
              venda no balcão, pedidos da vitrine e o histórico de tudo o que
              saiu, quebrou ou foi cancelado.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/cadastro" className="btn btn-primario px-6 py-3 text-base">
                Criar conta
                <FiArrowRight className="w-[1.05rem]" aria-hidden />
              </Link>

              <Link href="/login" className="btn btn-secundario px-6 py-3 text-base">
                Já tenho conta
              </Link>
            </div>

            <p className="mt-5 text-sm text-[#8C969B]">
              Uma assinatura mensal de R$ 100, com tudo incluído. Sem
              fidelidade: o cancelamento é feito por você mesmo.
            </p>
          </div>

          {/* Etiqueta de peça — o objeto concreto que o sistema produz. */}
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-[#E4E9EB] pb-4">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#8C969B]">
                Etiqueta da peça
              </p>
              <span className="tag tag-success">
                <FiCheck className="w-3" aria-hidden />
                Em estoque
              </span>
            </div>

            <div className="pt-4">
              <p className="font-display text-lg text-[#1E2428]">
                Camisa social manga longa
              </p>

              <p className="mt-1 text-sm text-[#5A6469]">
                Algodão egípcio · Branco · Tamanho M
              </p>

              {/* Código de barras desenhado com as próprias barras: é o que
                  o leitor do balcão lê na etiqueta impressa. */}
              <div className="mt-5 rounded-lg border border-[#E4E9EB] bg-white p-4">
                <div className="flex h-16 items-stretch gap-0 overflow-hidden" aria-hidden>
                  {BARRAS.map((largura, i) => (
                    <span
                      key={i}
                      style={{ width: `${largura * 3}px` }}
                      className={i % 2 === 0 ? "bg-[#1E2428]" : "bg-transparent"}
                    />
                  ))}
                </div>

                <p className="mt-3 text-center font-mono text-sm tracking-[0.25em] text-[#1E2428]">
                  000618-1
                </p>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#8C969B]">
                    Localização
                  </dt>
                  <dd className="num mt-1 flex items-center gap-1.5 text-sm font-bold text-[#1E2428]">
                    <FiMapPin className="w-4 text-[#5A6469]" aria-hidden />
                    001.005.01.A
                  </dd>
                </div>

                <div>
                  <dt className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#8C969B]">
                    Preço
                  </dt>
                  <dd className="mt-1">
                    <Preco valor={189.9} valorAntigo={249.9} className="text-xl" />
                  </dd>
                </div>
              </dl>
            </div>
          </div>

        </div>
      </section>

      {/* Faixa de capacidades — sem números inventados, só o que o sistema faz. */}
      <div className="border-b border-[#E4E9EB] bg-white">
        <ul className="mx-auto grid max-w-6xl gap-x-8 gap-y-3 px-4 py-5 text-sm font-semibold text-[#5A6469] sm:grid-cols-2 lg:grid-cols-4">
          {[
            { texto: "Código de barras por peça", Icone: FiTag },
            { texto: "Endereço de cada peça", Icone: FiMapPin },
            { texto: "Vitrine pública da loja", Icone: FiImage },
            { texto: "Pedidos e status de entrega", Icone: FiShoppingCart },
          ].map(({ texto, Icone }) => (
            <li key={texto} className="flex items-center gap-2.5">
              <Icone className="w-[1.05rem] shrink-0 text-[#0086FF]" aria-hidden />
              {texto}
            </li>
          ))}
        </ul>
      </div>

      {/* ==================================================================
          COMO FUNCIONA
          ================================================================== */}
      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:py-20">
        <h2 className="font-display text-2xl text-[#1E2428] sm:text-3xl">
          Do cabide ao caixa, em quatro passos
        </h2>

        <p className="mt-3 max-w-2xl text-base text-[#5A6469]">
          O caminho é o mesmo que a peça já faz na sua loja hoje — a diferença
          é que agora cada etapa fica registrada.
        </p>

        <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {passos.map((passo, i) => (
            <li key={passo.titulo} className="card card-hover p-6">
              <span className="num flex h-9 w-9 items-center justify-center rounded-lg bg-[#E6F3FF] text-sm font-extrabold text-[#0075E2]">
                {i + 1}
              </span>

              <h3 className="font-display mt-4 text-lg text-[#1E2428]">
                {passo.titulo}
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-[#5A6469]">
                {passo.texto}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ==================================================================
          RECURSOS
          ================================================================== */}
      <section id="recursos" className="scroll-mt-20 border-y border-[#E4E9EB] bg-[#F0F3F4]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 className="font-display text-2xl text-[#1E2428] sm:text-3xl">
            O que vem no painel
          </h2>

          <p className="mt-3 max-w-2xl text-base text-[#5A6469]">
            Tudo dividido por tela, do jeito que a loja funciona: catálogo,
            estoque, vendas e conta.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {recursos.map(({ titulo, texto, Icone }) => (
              <article key={titulo} className="card card-hover p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E6F3FF]">
                  <Icone className="w-5 text-[#0075E2]" aria-hidden />
                </span>

                <h3 className="font-display mt-4 text-lg text-[#1E2428]">
                  {titulo}
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-[#5A6469]">
                  {texto}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================================
          VITRINE
          Bloco azul cheio — a mesma presença de cor da marca no topo do painel.
          ================================================================== */}
      <section id="vitrine" className="scroll-mt-20 bg-[#0086FF]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2">

          <div>
            <span className="tag bg-white/15 text-white">Incluído na assinatura</span>

            <h2 className="font-display mt-4 text-2xl text-white sm:text-3xl">
              Sua loja também fica de pé na internet
            </h2>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85">
              A vitrine mostra o mesmo estoque do painel: quando a peça é
              vendida no balcão, ela deixa de aparecer para o cliente. O pedido
              feito ali chega direto na tela de pedidos, com nome, contato e
              itens. A vitrine já vem na assinatura, sem custo à parte.
            </p>

            <ul className="mt-6 space-y-2.5">
              {[
                "Catálogo alimentado pelo próprio estoque",
                "Banners do topo montados por você, com ordem e ativação",
                "Preço promocional com o valor cheio riscado ao lado",
                "Pedido com status de pendente até entregue",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm font-semibold text-white">
                  <FiCheck className="mt-0.5 w-4 shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Prévia de um card da vitrine. */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E4E9EB] px-5 py-3">
              <p className="font-display text-sm text-[#1E2428]">Vitrine</p>
              <span className="tag tag-danger">Última peça</span>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-[7rem_1fr]">
              <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-[#F0F3F4] text-[#B8C0C4]">
                <FiTag className="w-7" aria-hidden />
              </div>

              <div className="min-w-0">
                <p className="font-display text-base text-[#1E2428]">
                  Vestido midi plissado
                </p>

                <p className="mt-1 text-sm text-[#5A6469]">
                  Viscose · Verde · Tamanho P
                </p>

                <div className="mt-3">
                  <Preco valor={229.9} valorAntigo={299.9} className="text-2xl" />
                </div>

                <p className="num mt-3 font-mono text-xs text-[#8C969B]">
                  000742-1 · 001.005.01.A
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ==================================================================
          ASSINATURA
          Um cartão só, no meio da página: não há o que comparar, e uma
          tabela de comparação com uma coluna seria uma pergunta sem escolha.
          ================================================================== */}
      <section id="assinatura" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl text-[#1E2428] sm:text-3xl">
            Um preço, sem pegadinha
          </h2>

          <p className="mt-3 text-base text-[#5A6469]">
            Não há plano básico nem versão capada: quem assina recebe o sistema
            inteiro, do cadastro da primeira peça à loja no ar. Sem fidelidade,
            e o cancelamento é feito por você mesmo.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <article className="card flex flex-col border-[#0086FF] p-7 shadow-[0_2px_12px_rgba(30,36,40,0.08)] sm:p-8">

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg text-[#1E2428]">
                  Arara
                </p>
                <p className="mt-1 text-sm text-[#5A6469]">
                  A loja física e a loja na internet, no mesmo estoque.
                </p>
              </div>

              <span className="tag tag-info shrink-0">Tudo incluído</span>
            </div>

            <div className="mt-6 flex items-baseline gap-1.5 border-b border-[#E4E9EB] pb-6">
              <Preco valor={MENSALIDADE} className="text-4xl" />
              <span className="text-sm font-bold text-[#5A6469]">/mês</span>
            </div>

            <ul className="mt-6 mb-8 grid gap-2.5 sm:grid-cols-2">
              {inclui.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm font-semibold text-[#1E2428]">
                  <FiCheck className="mt-0.5 w-4 shrink-0 text-[#08A022]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/cadastro"
              className="btn btn-primario mt-auto w-full py-3 text-base"
            >
              Criar a minha conta
              <FiArrowRight className="w-[1.05rem]" aria-hidden />
            </Link>
          </article>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-[#8C969B]">
          A assinatura é cobrada todo mês no cartão. Nenhum dado de cartão passa
          por este sistema: o pagamento é feito numa página segura do
          processador de cobrança, e o cancelamento fica na tela de assinatura
          do seu painel.
        </p>
      </section>

      {/* ==================================================================
          RODAPÉ
          ================================================================== */}
      <footer className="border-t border-[#D3DADD] bg-[#F0F3F4]">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-wrap items-center justify-between gap-6">

            <div className="flex items-center gap-2.5">
              <Marca />
              <div className="leading-tight">
                <p className="font-display text-[1.05rem] text-[#1E2428]">
                  Arara
                </p>
                <p className="text-xs text-[#8C969B]">
                  Gestão de estoque e vendas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/login" className="btn btn-neutro px-4 py-2 text-sm">
                Entrar
              </Link>
              <Link href="/cadastro" className="btn btn-primario px-4 py-2 text-sm">
                Criar conta
              </Link>
            </div>

          </div>

          <p className="mt-8 border-t border-[#D3DADD] pt-6 text-xs text-[#8C969B]">
            © {new Date().getFullYear()} Arara. Todos os direitos reservados.
          </p>
        </div>
      </footer>

    </div>
  )
}
