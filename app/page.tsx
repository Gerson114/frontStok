import type { Metadata } from "next"
import Link from "next/link"
import { url } from "@/app/api/backend"
import { publico } from "@/app/api/rotas"
import { Marca } from "./components/marca/marca"
import Preco, { formatarMoeda } from "./components/preco/preco"
import Topo from "./components/header/topo"
import {
  MockupAgenda,
  MockupAtendimento,
  MockupComprovante,
  MockupEtiqueta,
  MockupPainel,
  MockupVitrine,
} from "./components/apresentacao/mockups"
import {
  FiArrowRight,
  FiBox,
  FiCalendar,
  FiCheck,
  FiCreditCard,
  FiLayout,
  FiMapPin,
  FiMessageSquare,
  FiPrinter,
  FiShoppingCart,
  FiStar,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi"
import type { IconType } from "react-icons"

export const metadata: Metadata = {
  title: "Arara | Estoque, vitrine e vendas para lojas de qualquer ramo",
  description:
    "Controle cada item com código próprio, venda no balcão e pela sua vitrine na internet, organize entregas, atenda os clientes e saiba quanto cada pessoa da equipe vendeu — tudo no mesmo sistema, por uma assinatura só. Serve loja de eletro, casa, mercearia, vestuário e o que mais você vender.",
}

/**
 * A porta de entrada: a página que quem ainda não é cliente encontra.
 *
 * Ela responde três perguntas, nesta ordem, porque é nesta ordem que quem
 * está decidindo as faz: **o que este sistema faz**, **como ele funciona na
 * minha loja** e **quanto custa**.
 *
 * O que ela NÃO faz: número inventado, depoimento de cliente que não existe e
 * selo que não corresponde a nada. Numa página de vendas, isso é a coisa mais
 * fácil de escrever e a mais cara quando alguém descobre — e quem compra
 * sistema de gestão está justamente procurando em quem confiar.
 *
 * As telas são desenhadas em HTML (ver components/apresentacao/mockups), e
 * não fotografadas: quem decide assinar quer ver o sistema, e é a tela dele
 * que convence. Fora que a CSP do painel fecha `img-src` em 'self' — figura
 * de servidor de terceiro não carrega aqui, e afrouxar isso para enfeitar
 * esta página seria trocar proteção real por imagem.
 */

/* ==========================================================================
   O conteúdo
   ========================================================================== */

/** Os três pilares. É o "por que este sistema é diferente" em três frases. */
const fundamentos: { titulo: string; texto: string; Icone: IconType }[] = [
  {
    titulo: "A peça, e não a quantidade",
    texto:
      "Em vez de “tenho 8 no estoque”, oito unidades com código próprio — sejam elas ventiladores, panelas ou camisas. Cada uma sabe onde está guardada, por quanto entrou, por quanto saiu e quem a vendeu. É daí que vem todo o resto: a etiqueta, a busca no corredor, a margem real e o histórico que não se perde.",
    Icone: FiBox,
  },
  {
    titulo: "Uma loja só, em dois lugares",
    texto:
      "O balcão e a internet bebem do mesmo estoque. A peça vendida na loja some da vitrine no mesmo instante, e o pedido do site cai na mesma tela em que você separa o pedido do WhatsApp. Nada de conferir duas listas e descobrir a diferença na hora de entregar.",
    Icone: FiShoppingCart,
  },
  {
    titulo: "Tudo o que aconteceu fica escrito",
    texto:
      "Quem vendeu, quem atendeu, quando o pagamento entrou, que dia o pedido saiu, o que voltou e por quê. Não é burocracia: é o que permite responder ao cliente que liga e fechar o mês sabendo o que de fato aconteceu.",
    Icone: FiTrendingUp,
  },
]

const passos: { titulo: string; texto: string }[] = [
  {
    titulo: "Cadastre a peça",
    texto:
      "Nome, categoria, preço e as variações que a SUA loja usa: voltagem, tamanho, peso, sabor, cor. Nada é fixo — o sistema não decide por você o que descreve o seu produto. Cada unidade física que entrou vira um registro.",
  },
  {
    titulo: "Imprima a etiqueta",
    texto:
      "Cada unidade sai com código próprio e código de barras. Dois ventiladores iguais deixam de ser um número no estoque e passam a ser duas peças distintas.",
  },
  {
    titulo: "Guarde e ache",
    texto:
      "Cada unidade num endereço da sua prateleira. Na hora de separar, o sistema diz onde ela está — e monta a volta pelo corredor na ordem certa.",
  },
  {
    titulo: "Venda e entregue",
    texto:
      "Bipe no balcão ou receba o pedido pela vitrine. A agenda diz o que tem de sair em cada dia, e o cliente acompanha tudo pela tela dele.",
  },
]

const recursos: { titulo: string; texto: string; Icone: IconType }[] = [
  {
    titulo: "Controle unidade a unidade",
    texto:
      "Cada unidade física com registro próprio: código, endereço na prateleira, custo de entrada, preço de saída e situação atual.",
    Icone: FiBox,
  },
  {
    titulo: "Etiqueta com código de barras",
    texto:
      "Pronta para imprimir, com o código que o leitor do balcão reconhece. A venda vira um bipe, e a baixa acontece na peça certa.",
    Icone: FiPrinter,
  },
  {
    titulo: "Endereços e separação",
    texto:
      "Diga onde cada peça está guardada. Na separação de vários pedidos, o sistema monta uma volta só pelo corredor, na ordem das prateleiras.",
    Icone: FiMapPin,
  },
  {
    titulo: "Agenda de entregas",
    texto:
      "Um calendário do que tem de sair em cada dia. Pedido em preparo fica de fora até você marcar o dia — e o que passou da data aparece em vermelho.",
    Icone: FiCalendar,
  },
  {
    titulo: "Atendimento no painel",
    texto:
      "O chat da sua vitrine e o WhatsApp da loja na mesma tela. Conversa nova entra numa fila que a equipe inteira vê; quem pega, atende.",
    Icone: FiMessageSquare,
  },
  {
    titulo: "Sua equipe, cada um com o seu nome",
    texto:
      "Cinco pessoas atendendo sem pisar no pé uma da outra: cada cliente tem dono, e o início mostra quanto cada um vendeu e quantos atendeu.",
    Icone: FiUsers,
  },
  {
    titulo: "Clientes com histórico",
    texto:
      "Quem compra na sua loja, quanto já gastou, o que comprou, para onde mandar e o que achou do que recebeu — numa tela só.",
    Icone: FiUsers,
  },
  {
    titulo: "Pagamento pela vitrine",
    texto:
      "O cliente paga no site por Pix ou cartão, na página do provedor. O pedido só entra na sua fila quando o dinheiro entra de verdade.",
    Icone: FiCreditCard,
  },
  {
    titulo: "A cara da loja é sua",
    texto:
      "Cores, logo e a página inicial montada por você, arrastando as seções — banners, prateleiras, textos e faixas de destaque.",
    Icone: FiLayout,
  },
]

/**
 * O que a assinatura entrega.
 *
 * A lista que vale é a do servidor (ver RecursosDoSistema, em
 * internal/services/assinatura/recursos.go), que é a mesma que a tela de
 * assinatura mostra. Quem mudar o que o sistema inclui mexe lá, e passa aqui
 * para esta página não desmentir aquela.
 */
const inclui: string[] = [
  "Cadastro de produtos, com as variações do seu ramo",
  "Controle unidade a unidade, cada uma com código próprio",
  "Etiqueta com código de barras para imprimir",
  "Entrada de mercadoria, com custo e fornecedor",
  "Endereços das prateleiras, com placas para imprimir",
  "Venda no balcão, bipando a etiqueta",
  "Vitrine pública alimentada pelo seu próprio estoque",
  "Editor da home da vitrine, arrastando as seções",
  "Pagamento online, com o pedido liberado só depois de pago",
  "Pedidos de WhatsApp e telefone na mesma separação",
  "Agenda de entregas, com o que sai em cada dia",
  "Separação com o endereço de cada peça, uma volta só",
  "Etiquetas de pedido e comprovante para o cliente",
  "Chat da vitrine e WhatsApp da loja dentro do painel",
  "Fila de atendimento com um responsável por cliente",
  "Clientes com histórico de compras e avaliações",
  "Equipe com permissões e desempenho por pessoa",
  "Fechamento de caixa e margem, dia a dia",
  "Devoluções, avarias e cancelamentos separados",
  "Tarefas, contagem e reposição de prateleira",
]

/**
 * O que a página promete: quanto custa e quantos dias de teste vêm antes da
 * primeira cobrança.
 *
 * Os dois saem do servidor (`/public/oferta`), que por sua vez lê o preço no
 * provedor de cobrança e o teste da configuração — assim a página nunca
 * promete um número diferente do que a fatura vai dizer. Trocar o preço é
 * trocar lá, e esta página acompanha sozinha.
 *
 * Os valores abaixo são a rede de segurança para quando o servidor não
 * responder. Esta é a página de vendas: ela sai no ar de qualquer jeito, com
 * o número escrito à mão, em vez de dar erro para quem estava decidindo
 * assinar. Se um dia divergirem, quem manda é o servidor — e é por isso que a
 * página tenta ele primeiro.
 */
const MENSALIDADE_RESERVA = 99.9
const TESTE_DIAS_RESERVA = 7

interface OfertaDaPagina {
  mensalidade: number
  testeDias: number
  pedeCartao: boolean
}

async function ofertaDaPagina(): Promise<OfertaDaPagina> {

  const reserva: OfertaDaPagina = {
    mensalidade: MENSALIDADE_RESERVA,
    testeDias: TESTE_DIAS_RESERVA,
    pedeCartao: false,
  }

  try {
    // Revalidação de cinco minutos: preço e teste mudam de mês em mês, no
    // máximo, e a página não precisa perguntar isso a cada visita.
    const resposta = await fetch(url(publico.oferta()), { next: { revalidate: 300 } })

    if (!resposta.ok) return reserva

    const dados = await resposta.json()
    const oferta = dados?.oferta ?? {}
    const centavos = oferta?.preco?.centavos

    return {
      mensalidade: typeof centavos === "number" && centavos > 0 ? centavos / 100 : reserva.mensalidade,
      testeDias: typeof oferta?.teste_dias === "number" ? oferta.teste_dias : reserva.testeDias,
      pedeCartao: oferta?.teste_pede_cartao === true,
    }

  } catch {
    return reserva
  }
}

/* ==========================================================================
   A página
   ========================================================================== */

export default async function Home() {

  const { mensalidade, testeDias, pedeCartao } = await ofertaDaPagina()

  // Sem teste configurado a página volta a falar como falava: assine e pague.
  // É o mesmo texto de antes, e não um "0 dias grátis" sem sentido.
  const temTeste = testeDias > 0

  const chamada = temTeste ? `Testar ${testeDias} dias grátis` : "Criar conta"

  return (
    <div className="min-h-screen bg-white">

      <Topo />

      {/* ==================================================================
          HERO
          ================================================================== */}
      <section className="border-b border-[#EBEBEB] bg-[#F1F1F1]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">

          <div>
            <span className="tag tag-info">Para lojas de qualquer ramo, no balcão e na internet</span>

            <h1 className="font-display mt-4 text-3xl leading-tight text-[#303030] sm:text-[2.6rem]">
              A sua loja inteira, da prateleira ao caixa.
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#616161]">
              Cada item com código próprio, a vitrine na internet vivendo do
              mesmo estoque, os pedidos organizados por dia de entrega, o
              atendimento no painel e o fechamento do caixa no fim do dia — sem
              planilha paralela e sem dois sistemas para conciliar.
              <span className="mt-2 block text-sm text-[#8A8A8A]">
                Eletro, casa, ferramentas, mercearia, vestuário: o sistema não
                supõe o que você vende.
              </span>
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/cadastro" className="btn btn-primario px-6 py-3 text-base">
                {chamada}
                <FiArrowRight className="w-[1.05rem]" aria-hidden />
              </Link>

              <Link href="/login" className="btn btn-secundario px-6 py-3 text-base">
                Já tenho conta
              </Link>
            </div>

            {/* O que vem depois do clique, dito antes do clique: quanto custa,
                quando começa a custar e se o cartão vai ser pedido agora. É a
                dúvida que faz a pessoa não clicar. */}
            <p className="mt-5 text-sm text-[#8A8A8A]">
              {temTeste ? (
                <>
                  {testeDias} dias para usar o sistema inteiro
                  {pedeCartao ? "" : ", sem cartão de crédito"}. Depois,{" "}
                  {formatarMoeda(mensalidade)} por mês, com tudo incluído.
                </>
              ) : (
                <>
                  Uma assinatura de {formatarMoeda(mensalidade)} por mês, com tudo
                  incluído.
                </>
              )}{" "}
              Sem fidelidade: o cancelamento é feito por você mesmo, no painel.
            </p>
          </div>

          <MockupPainel />

        </div>
      </section>

      {/* Faixa de capacidades — sem números inventados, só o que o sistema faz. */}
      <div className="border-b border-[#EBEBEB] bg-white">
        <ul className="mx-auto grid max-w-6xl gap-x-8 gap-y-3 px-4 py-5 text-sm font-semibold text-[#616161] sm:grid-cols-2 lg:grid-cols-4">
          {[
            { texto: "Código de barras por peça", Icone: FiPrinter },
            { texto: "Vitrine com pagamento online", Icone: FiCreditCard },
            { texto: "Agenda de entregas", Icone: FiCalendar },
            { texto: "Atendimento e equipe", Icone: FiUsers },
          ].map(({ texto, Icone }) => (
            <li key={texto} className="flex items-center gap-2.5">
              <Icone className="w-[1.05rem] shrink-0 text-[#005BD3]" aria-hidden />
              {texto}
            </li>
          ))}
        </ul>
      </div>

      {/* ==================================================================
          O FUNDAMENTO
          Antes das funções, a ideia que as organiza. Quem entende isto
          entende por que as telas são as que são.
          ================================================================== */}
      <section id="fundamento" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:py-20">

        <div className="max-w-2xl">
          <span className="tag tag-info">O fundamento</span>

          <h2 className="font-display mt-4 text-2xl text-[#303030] sm:text-3xl">
            Três ideias sustentam o sistema inteiro
          </h2>

          <p className="mt-3 text-base leading-relaxed text-[#616161]">
            Não é uma coleção de telas soltas. Tudo aqui sai destas três
            decisões — e é por elas que vale a pena começar a entender.
          </p>
        </div>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">

          <ol className="space-y-5">
            {fundamentos.map(({ titulo, texto, Icone }, i) => (
              <li key={titulo} className="card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF4FF]">
                    <Icone className="w-[1.05rem] text-[#00369B]" aria-hidden />
                  </span>

                  <h3 className="font-display text-lg text-[#303030]">
                    <span className="num mr-2 text-[#B5B5B5]">{i + 1}.</span>
                    {titulo}
                  </h3>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-[#616161]">{texto}</p>
              </li>
            ))}
          </ol>

          <div className="lg:sticky lg:top-8">
            <MockupEtiqueta />

            <p className="mt-4 text-sm leading-relaxed text-[#8A8A8A]">
              É esta etiqueta que muda o resto: com ela, a peça tem nome
              próprio no sistema — e passa a ser possível dizer onde ela está,
              por quanto saiu e quem a vendeu.
            </p>
          </div>

        </div>
      </section>

      {/* ==================================================================
          COMO FUNCIONA
          ================================================================== */}
      <section id="como-funciona" className="scroll-mt-20 border-y border-[#EBEBEB] bg-[#F1F1F1]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">

          <h2 className="font-display text-2xl text-[#303030] sm:text-3xl">
            Do cabide ao caixa, em quatro passos
          </h2>

          <p className="mt-3 max-w-2xl text-base text-[#616161]">
            O caminho é o mesmo que a peça já faz na sua loja hoje — a
            diferença é que agora cada etapa fica registrada.
          </p>

          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {passos.map((passo, i) => (
              <li key={passo.titulo} className="card card-hover p-6">
                <span className="num flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF4FF] text-sm font-extrabold text-[#00369B]">
                  {i + 1}
                </span>

                <h3 className="font-display mt-4 text-lg text-[#303030]">
                  {passo.titulo}
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-[#616161]">
                  {passo.texto}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ==================================================================
          O DIA DA LOJA — a agenda
          ================================================================== */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">

          <div>
            <span className="tag tag-info">O trabalho do dia</span>

            <h2 className="font-display mt-4 text-2xl text-[#303030] sm:text-3xl">
              O que tem de sair hoje, num calendário
            </h2>

            <p className="mt-4 text-base leading-relaxed text-[#616161]">
              A lista de pedidos responde “em que pé está cada um”. A agenda
              responde outra pergunta, que a lista não responde: <strong>o que
              eu tenho de mandar hoje</strong>. Pedido em preparo fica fora do
              calendário até você dizer o dia em que ele sai — e o que passou
              da data aparece separado, em vermelho, mesmo quando você está
              olhando outro mês.
            </p>

            <ul className="mt-6 space-y-2.5">
              {[
                "Quem vem buscar cai no dia da compra; quem pediu entrega, no dia que você marcar",
                "O que passou do dia de sair não some quando você vira a página",
                "Cada pedido leva ao lugar onde se grava o rastreio",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#303030]">
                  <FiCheck className="mt-0.5 w-4 shrink-0 text-[#0C5132]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <MockupAgenda />

        </div>
      </section>

      {/* ==================================================================
          RECURSOS
          ================================================================== */}
      <section id="recursos" className="scroll-mt-20 border-y border-[#EBEBEB] bg-[#F1F1F1]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">

          <h2 className="font-display text-2xl text-[#303030] sm:text-3xl">
            O que vem no painel
          </h2>

          <p className="mt-3 max-w-2xl text-base text-[#616161]">
            Tudo dividido por tela, do jeito que a loja funciona: catálogo,
            estoque, vendas, atendimento e conta. Nenhuma delas é vendida à
            parte.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {recursos.map(({ titulo, texto, Icone }) => (
              <article key={titulo} className="card card-hover p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EAF4FF]">
                  <Icone className="w-5 text-[#00369B]" aria-hidden />
                </span>

                <h3 className="font-display mt-4 text-lg text-[#303030]">
                  {titulo}
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-[#616161]">
                  {texto}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================================
          ATENDIMENTO E EQUIPE
          ================================================================== */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">

          <MockupAtendimento />

          <div>
            <span className="tag tag-info">Atendimento</span>

            <h2 className="font-display mt-4 text-2xl text-[#303030] sm:text-3xl">
              Cinco pessoas atendendo sem pisar no pé uma da outra
            </h2>

            <p className="mt-4 text-base leading-relaxed text-[#616161]">
              O cliente escreve pelo chat da sua vitrine ou pelo WhatsApp da
              loja, e a conversa entra numa fila que a equipe inteira vê. Quem
              pega, atende — e a conversa sai da tela dos outros, para dois
              atendentes não responderem coisas diferentes ao mesmo cliente.
              Terminou, encerra. Se o cliente voltar a escrever, ela volta para
              a fila.
            </p>

            <ul className="mt-6 space-y-2.5">
              {[
                "Cada funcionário com o próprio acesso e as próprias permissões",
                "Quem respondeu fica gravado na mensagem, e quem vendeu, na peça",
                "Só o dono vê o desempenho de cada um",
                "Passar um cliente para outra pessoa é decisão do dono",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#303030]">
                  <FiCheck className="mt-0.5 w-4 shrink-0 text-[#0C5132]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </section>

      {/* ==================================================================
          VITRINE
          ================================================================== */}
      <section id="vitrine" className="scroll-mt-20 bg-[#005BD3]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">

          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">

            <div>
              <span className="tag bg-white/15 text-white">Incluído na assinatura</span>

              <h2 className="font-display mt-4 text-2xl text-white sm:text-3xl">
                A sua loja também fica de pé na internet
              </h2>

              <p className="mt-4 text-base leading-relaxed text-white/85">
                A vitrine mostra o mesmo estoque do painel: a peça vendida no
                balcão deixa de aparecer para o cliente na mesma hora. Ele paga
                por Pix ou cartão, acompanha o pedido por uma tela própria,
                imprime o comprovante e avalia o que recebeu — e você monta a
                página inicial dela arrastando as seções, sem mexer em código.
              </p>

              <ul className="mt-6 space-y-2.5">
                {[
                  "Catálogo alimentado pelo próprio estoque",
                  "Editor da home: banners, prateleiras, textos e colunas",
                  "Pagamento na página do provedor — nenhum dado de cartão passa por aqui",
                  "Tela de acompanhamento, comprovante e avaliação do produto",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm font-semibold text-white">
                    <FiCheck className="mt-0.5 w-4 shrink-0" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <MockupVitrine />
              <MockupComprovante />
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
          <h2 className="font-display text-2xl text-[#303030] sm:text-3xl">
            Um preço, sem pegadinha
          </h2>

          <p className="mt-3 text-base text-[#616161]">
            Não há plano básico nem versão capada: quem assina recebe o sistema
            inteiro, do cadastro da primeira peça à loja no ar com pagamento.
            Sem fidelidade, e o cancelamento é feito por você mesmo.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <article className="card flex flex-col border-[#005BD3] p-7 shadow-[0_2px_12px_rgba(0,0,0,0.08)] sm:p-8">

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg text-[#303030]">Arara</p>
                <p className="mt-1 text-sm text-[#616161]">
                  A loja física e a loja na internet, no mesmo estoque.
                </p>
              </div>

              <span className="tag tag-info shrink-0">
                {temTeste ? `${testeDias} dias grátis` : "Tudo incluído"}
              </span>
            </div>

            <div className="mt-6 border-b border-[#EBEBEB] pb-6">
              <div className="flex items-baseline gap-1.5">
                <Preco valor={mensalidade} className="text-4xl" />
                <span className="text-sm font-bold text-[#616161]">/mês</span>
              </div>

              {temTeste ? (
                <p className="mt-2 text-sm text-[#616161]">
                  A cobrar só depois dos {testeDias} dias de teste
                  {pedeCartao ? "" : ", e o cartão só é pedido quando você decidir ficar"}.
                </p>
              ) : null}
            </div>

            <ul className="mt-6 mb-8 grid gap-2.5 sm:grid-cols-2">
              {inclui.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm font-semibold text-[#303030]">
                  <FiCheck className="mt-0.5 w-4 shrink-0 text-[#0C5132]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>

            <Link href="/cadastro" className="btn btn-primario mt-auto w-full py-3 text-base">
              {temTeste ? chamada : "Criar a minha conta"}
              <FiArrowRight className="w-[1.05rem]" aria-hidden />
            </Link>
          </article>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
          {[
            { titulo: "Sem fidelidade", texto: "Cancela no painel, quando quiser.", Icone: FiCheck },
            temTeste && !pedeCartao
              ? { titulo: "Sem cartão para testar", texto: `Os ${testeDias} dias começam com o cadastro, e nada é cobrado.`, Icone: FiCreditCard }
              : { titulo: "Cartão seguro", texto: "Nenhum dado de cartão passa por este sistema.", Icone: FiCreditCard },
            { titulo: "Suporte a quem usa", texto: "As dúvidas chegam pelo mesmo canal do sistema.", Icone: FiStar },
          ].map(({ titulo, texto, Icone }) => (
            <div key={titulo} className="flex items-start gap-2.5 rounded-lg bg-[#F7F7F7] p-4">
              <Icone className="mt-0.5 w-4 shrink-0 text-[#005BD3]" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[#303030]">{titulo}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#616161]">{texto}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-[#8A8A8A]">
          {temTeste ? (
            <>
              O teste começa no cadastro e dura {testeDias} dias
              {pedeCartao ? " — o cartão fica guardado e a primeira cobrança acontece no fim dele" : ", sem cobrança nenhuma. Para continuar depois, é só cadastrar o cartão no painel"}
              .{" "}
            </>
          ) : null}
          A assinatura é cobrada todo mês no cartão. O pagamento acontece numa
          página segura do processador de cobrança, e o cancelamento fica na
          tela de assinatura do seu painel.
        </p>
      </section>

      {/* ==================================================================
          RODAPÉ
          ================================================================== */}
      <footer className="border-t border-[#E1E1E1] bg-[#F1F1F1]">
        <div className="mx-auto max-w-6xl px-4 py-10">

          <div className="flex flex-wrap items-center justify-between gap-6">

            <div className="flex items-center gap-2.5">
              <Marca />
              <div className="leading-tight">
                <p className="font-display text-[1.05rem] text-[#303030]">Arara</p>
                <p className="text-xs text-[#8A8A8A]">Gestão de estoque e vendas</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/login" className="btn btn-neutro px-4 py-2 text-sm">
                Entrar
              </Link>
              <Link href="/cadastro" className="btn btn-primario px-4 py-2 text-sm">
                {temTeste ? "Testar grátis" : "Criar conta"}
              </Link>
            </div>

          </div>

          <p className="mt-8 border-t border-[#E1E1E1] pt-6 text-xs text-[#8A8A8A]">
            © {new Date().getFullYear()} Arara. Todos os direitos reservados.
          </p>
        </div>
      </footer>

    </div>
  )
}
