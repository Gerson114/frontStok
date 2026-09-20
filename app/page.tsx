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
  MockupEquipe,
  MockupEtiqueta,
  MockupPainel,
  MockupRede,
  MockupVitrine,
} from "./components/apresentacao/mockups"
import {
  FiArrowRight,
  FiBarChart2,
  FiBox,
  FiCalendar,
  FiCheck,
  FiCreditCard,
  FiLock,
  FiMapPin,
  FiMessageSquare,
  FiPackage,
  FiPlus,
  FiPrinter,
  FiRefreshCw,
  FiShoppingCart,
  FiStar,
  FiTag,
  FiUsers,
} from "react-icons/fi"
import type { IconType } from "react-icons"
import { MARCA, MARCA_PRO } from "@/app/marca"

export const metadata: Metadata = {
  title: `${MARCA} | Estoque, vitrine e vendas para lojas de qualquer ramo`,
  description:
    "Controle cada item com código próprio, venda no balcão e pela sua vitrine na internet, organize entregas, atenda os clientes e saiba quanto cada pessoa da equipe vendeu — tudo no mesmo sistema. Dois planos: um para quem toca a loja sozinho e outro para quem tem equipe ou mais de uma unidade. Serve loja de eletro, casa, mercearia, vestuário e o que mais você vender.",
}

/**
 * A porta de entrada: a página que quem ainda não é cliente encontra.
 *
 * Ela responde, nesta ordem, porque é nesta ordem que quem está decidindo
 * pergunta: **o que este sistema faz**, **como ele funciona na minha loja**,
 * **quanto custa** e **o que acontece depois que eu clicar**.
 *
 * O que ela NÃO faz: número inventado, depoimento de cliente que não existe e
 * selo que não corresponde a nada. Numa página de vendas, isso é a coisa mais
 * fácil de escrever e a mais cara quando alguém descobre — e quem compra
 * sistema de gestão está justamente procurando em quem confiar.
 *
 * As telas são desenhadas em HTML (ver components/apresentacao/mockups), e
 * não fotografadas: quem decide assinar quer ver o sistema, e é a tela dele
 * que convence. Fora que a CSP do painel fecha `img-src` em 'self' — figura
 * de servidor de terceiro não carrega, e afrouxar isso para enfeitar esta
 * página seria trocar proteção real por imagem.
 *
 * O MOVIMENTO mora em globals.css, na seção "movimento da página de vendas",
 * e não em classes soltas aqui: a entrada do herói acontece uma vez, por
 * tempo, e todo o resto acompanha a rolagem (`animation-timeline: view()`).
 * Nada aqui esconde conteúdo — onde o navegador não sabe animar pela rolagem,
 * a página aparece inteira, que é o contrário do revelador em JavaScript que
 * deixa a tela em branco quando não roda.
 */

/* ==========================================================================
   O conteúdo
   ========================================================================== */

/** Os três pilares. É o "por que este sistema é diferente" em três frases. */
const fundamentos: { titulo: string; texto: string; Icone: IconType }[] = [
  {
    titulo: "A unidade, e não a quantidade",
    texto:
      "Em vez de “tenho 8 no estoque”, oito unidades com código próprio — sejam elas ventiladores, panelas ou camisas. Cada uma sabe onde está guardada, por quanto entrou, por quanto saiu e quem a vendeu. É daí que vem todo o resto: a etiqueta, a busca no corredor, a margem real e o histórico que não se perde.",
    Icone: FiBox,
  },
  {
    titulo: "Uma loja só, em dois lugares",
    texto:
      "O balcão e a internet bebem do mesmo estoque. A unidade vendida na loja some da vitrine no mesmo instante, e o pedido do site cai na mesma tela em que você separa o pedido do WhatsApp. Nada de conferir duas listas e descobrir a diferença na hora de entregar.",
    Icone: FiShoppingCart,
  },
  {
    titulo: "Tudo o que aconteceu fica escrito",
    texto:
      "Quem vendeu, quem atendeu, quando o pagamento entrou, que dia o pedido saiu, o que voltou e por quê. Não é burocracia: é o que permite responder ao cliente que liga e fechar o mês sabendo o que de fato aconteceu.",
    Icone: FiBarChart2,
  },
]

const passos: { titulo: string; texto: string }[] = [
  {
    titulo: "Cadastre a unidade",
    texto:
      "Nome, categoria, preço e as variações que a SUA loja usa: voltagem, tamanho, peso, sabor, cor. Nada é fixo — o sistema não decide por você o que descreve o seu produto. Cada unidade física que entrou vira um registro.",
  },
  {
    titulo: "Imprima a etiqueta",
    texto:
      "Cada unidade sai com código próprio e código de barras. Dois ventiladores iguais deixam de ser um número no estoque e passam a ser duas unidades distintas.",
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
      "Pronta para imprimir, com o código que o leitor do balcão reconhece. A venda vira um bipe, e a baixa acontece na unidade certa.",
    Icone: FiPrinter,
  },
  {
    titulo: "Entrada de mercadoria",
    texto:
      "O que chegou do fornecedor entra com custo e origem. É isso que faz a margem do fim do mês ser a de verdade, e não a estimada.",
    Icone: FiPackage,
  },
  {
    titulo: "Endereços e separação",
    texto:
      "Diga onde cada unidade está guardada, com capacidade e bloqueio, um endereço a um. As placas das prateleiras saem prontas para imprimir.",
    Icone: FiMapPin,
  },
  {
    titulo: "Reposição e contagem",
    texto:
      "Aviso de prateleira vazia antes de o cliente reclamar, contagem rotativa pelo giro de cada produto e uma fila de tarefas do estoque na ordem certa.",
    Icone: FiRefreshCw,
  },
  {
    titulo: "Venda no balcão",
    texto:
      "Bipe a etiqueta e pronto: a unidade sai do estoque, some da vitrine e entra no fechamento do dia com o nome de quem vendeu.",
    Icone: FiShoppingCart,
  },
  {
    titulo: "Agenda de entregas",
    texto:
      "Um calendário do que tem de sair em cada dia. Pedido em preparo fica de fora até você marcar o dia — e o que passou da data aparece em vermelho.",
    Icone: FiCalendar,
  },
  {
    titulo: "Frete que você define",
    texto:
      "Tabela por estado, com prazo e frete grátis acima de um valor. Quem vem buscar na loja não paga nada, e o pedido já nasce sabendo disso.",
    Icone: FiTag,
  },
  {
    titulo: "Promoções, devoluções e avarias",
    texto:
      "Preço promocional com começo e fim, o que voltou isolado até a tratativa e a unidade quebrada fora do estoque vendável — sem sumir do histórico.",
    Icone: FiRefreshCw,
  },
  {
    titulo: "Atendimento no painel",
    texto:
      "O chat da sua vitrine e o WhatsApp da loja na mesma tela, conversa por conversa, sem abrir o celular no meio do expediente.",
    Icone: FiMessageSquare,
  },
  {
    titulo: "Clientes com histórico",
    texto:
      "Quem compra na sua loja, quanto já gastou, o que comprou, para onde mandar e o que achou do que recebeu — numa tela só.",
    Icone: FiUsers,
  },
  {
    titulo: "O fechamento do dia",
    texto:
      "Quanto saiu no balcão, quanto saiu por pedido, quanto entrou de verdade e o que está parado. É a primeira tela ao entrar, e não um relatório a pedir.",
    Icone: FiBarChart2,
  },
]

/** O que o plano Pro acrescenta — as telas de equipe e de rede. */
const recursosPro: { titulo: string; texto: string; Icone: IconType }[] = [
  {
    titulo: "Funcionários, um acesso por pessoa",
    texto:
      "Cada um entra com o próprio login e abre só o que você marcou. Quem respondeu fica gravado na mensagem, e quem vendeu, na unidade.",
    Icone: FiUsers,
  },
  {
    titulo: "A conversa da equipe",
    texto:
      "O grupo de trabalho dentro do painel, com as tarefas do dia e o mural de recados — em vez de combinar a operação da loja num grupo de celular que ninguém acha depois.",
    Icone: FiMessageSquare,
  },
  {
    titulo: "Código da conversa",
    texto:
      "Um código de entrada que você dá a quem chega e tira de quem saiu. O acesso à conversa da equipe se concede e se revoga em um passo.",
    Icone: FiLock,
  },
  {
    titulo: "Várias lojas na mesma conta",
    texto:
      "Cada unidade com o seu estoque, o seu caixa e a sua equipe, e um gerente por filial que administra a loja dele sem alcançar a assinatura nem a rede.",
    Icone: FiMapPin,
  },
]

/** As perguntas que decidem o clique — e que, sem resposta, o impedem. */
const perguntas: { pergunta: string; resposta: string }[] = [
  {
    pergunta: "Preciso de cartão para começar o teste?",
    resposta:
      "Precisa, e nada é cobrado no dia. O cartão fica guardado para a primeira cobrança acontecer sozinha no fim do teste — sem ele, a assinatura seria encerrada naquele dia e você teria de voltar e assinar de novo. Cancelando antes do fim do teste, não há cobrança nenhuma.",
  },
  {
    pergunta: "Como faço para cancelar?",
    resposta:
      "Pela tela de assinatura do seu painel, você mesmo, sem ligar para ninguém e sem prazo de fidelidade. O acesso continua até o fim do período que você já pagou.",
  },
  {
    pergunta: "Serve para o que eu vendo?",
    resposta:
      "As variações são suas: voltagem, tamanho, peso, sabor, cor, o que for. O sistema não traz uma lista pronta de campos de vestuário nem de eletro — ele guarda o que descreve o seu produto. O controle unidade a unidade funciona igual num ventilador e numa camisa.",
  },
  {
    pergunta: "Tenho de comprar equipamento?",
    resposta:
      "O sistema roda no navegador do computador, do tablet ou do celular. Para bipar no balcão serve qualquer leitor de código de barras comum, e as etiquetas saem na impressora que você já tem.",
  },
  {
    pergunta: "Posso trocar de plano depois?",
    resposta:
      "A qualquer momento, pelo painel, nos dois sentidos. As telas do plano que você não assinou continuam à vista no menu, em cinza — você vê o que existe antes de decidir pagar por isso.",
  },
  {
    pergunta: "Os dados do meu cartão ficam com vocês?",
    resposta:
      "Não. O cartão é digitado numa página do processador de cobrança, fora daqui, e nenhum dígito dele passa por este sistema — nem na assinatura, nem no pagamento que o seu cliente faz na vitrine.",
  },
  {
    pergunta: "E se eu já tiver um site?",
    resposta:
      "A vitrine vem junto e é opcional: dá para usar só o painel, com os pedidos entrando por WhatsApp e telefone. Quem quiser a loja na internet escolhe o endereço dela e monta a página inicial arrastando as seções.",
  },
]

/* ==========================================================================
   A oferta

   Preço, teste e a lista do que se leva saem do SERVIDOR (`/public/oferta`),
   que lê o preço no provedor de cobrança. É o que impede esta página de
   prometer um número diferente do que a fatura vai dizer — e é por isso que a
   lista de recursos aqui é a mesma que a tela de assinatura mostra ao lojista
   que já é cliente (ver RecursosDoSistema, em
   internal/services/assinatura/recursos.go).

   Os valores de reserva abaixo são a rede de segurança para quando o servidor
   não responder: esta é a página de vendas, ela sai no ar de qualquer jeito,
   com o número escrito à mão, em vez de dar erro para quem estava decidindo
   assinar. Se um dia divergirem, quem manda é o servidor.
   ========================================================================== */

const MENSALIDADE_RESERVA = 99.9
const MENSALIDADE_PRO_RESERVA = 160
const TESTE_DIAS_RESERVA = 15
const LOJAS_NO_PRO_RESERVA = 20

interface PlanoPro {
  mensalidade: number
  recursos: string[]
  lojas: number
}

interface OfertaDaPagina {
  mensalidade: number
  recursos: string[]
  testeDias: number
  pedeCartao: boolean

  /** A primeira cobrança, no fim do teste: meio mês por meio preço. */
  entrada: { valor: number; dias: number } | null

  /** Nulo quando o servidor responde SEM o Pro — ver ofertaDaPagina. */
  pro: PlanoPro | null
}

/** Os recursos escritos à mão, para quando o servidor não responder. */
const RECURSOS_RESERVA: string[] = [
  "O resumo do dia e do mês: o que saiu, quanto entrou e o que está parado",
  "Sua loja na internet, com pedidos online",
  "Pedidos de WhatsApp e telefone na mesma separação",
  "Calendário das entregas, com o que chega em cada dia e o que atrasou",
  "Etiquetas dos pedidos prontas para imprimir",
  "Devoluções isoladas até a tratativa",
  "Histórico de cada cliente: o que comprou, quanto gastou e o que achou",
  "WhatsApp da loja dentro do painel, conversa por conversa",
  "Chat ao vivo com o cliente dentro da sua vitrine",
  "Histórico de vendas da loja",
  "Lista de produtos com preços e promoções",
  "Estoque controlado unidade por unidade",
  "Entrada de mercadoria com custo e fornecedor",
  "Aviso de prateleira vazia antes do cliente reclamar",
  "Inventário rotativo pelo giro de cada produto",
  "Fila de trabalho do estoque, na ordem certa",
  "Endereços com capacidade e bloqueio, um a um",
  "Placas de prateleira prontas para imprimir",
  "Identidade e endereço da sua loja",
  "Monte a página inicial da loja arrastando os blocos",
  "Banners e destaques da vitrine",
  "A conta que recebe o dinheiro das vendas do site",
  "Tabela de frete por estado, com prazo e frete grátis acima de um valor",
  "Unidades cadastradas sem limite",
]

const RECURSOS_PRO_RESERVA: string[] = [
  "Várias lojas na mesma conta, cada uma com o seu estoque, caixa e equipe",
  "Contas para a sua equipe, cada uma com as telas que pode abrir",
  "Conversa da equipe dentro do painel, com tarefas e mural de recados",
  "Código de entrada da conversa, para dar e tirar acesso da equipe",
]

/** Centavos do servidor viram reais, com o valor escrito à mão como reserva. */
function reais(centavos: unknown, padrao: number): number {
  return typeof centavos === "number" && centavos > 0 ? centavos / 100 : padrao
}

async function ofertaDaPagina(): Promise<OfertaDaPagina> {

  const reserva: OfertaDaPagina = {
    mensalidade: MENSALIDADE_RESERVA,
    recursos: RECURSOS_RESERVA,
    testeDias: TESTE_DIAS_RESERVA,
    pedeCartao: true,
    entrada: { valor: MENSALIDADE_RESERVA / 2, dias: TESTE_DIAS_RESERVA },
    pro: {
      mensalidade: MENSALIDADE_PRO_RESERVA,
      recursos: RECURSOS_PRO_RESERVA,
      lojas: LOJAS_NO_PRO_RESERVA,
    },
  }

  try {
    // Revalidação de cinco minutos: preço e teste mudam de mês em mês, no
    // máximo, e a página não precisa perguntar isso a cada visita.
    const resposta = await fetch(url(publico.oferta()), { next: { revalidate: 300 } })

    if (!resposta.ok) return reserva

    const dados = await resposta.json()
    const oferta = dados?.oferta ?? {}

    const recursos: string[] =
      Array.isArray(oferta?.recursos) && oferta.recursos.length > 0
        ? oferta.recursos
        : reserva.recursos

    const testeDias = typeof oferta?.teste_dias === "number" ? oferta.teste_dias : reserva.testeDias

    // O Pro só vai para a tela quando o servidor o devolve. Sem preço criado
    // no provedor de cobrança a chave não vem, e anunciá-lo assim mesmo
    // levaria o lojista a um checkout que falha — a mesma regra que a tela de
    // assinatura segue para quem já é cliente.
    const pro: PlanoPro | null = oferta?.pro
      ? {
        mensalidade: reais(oferta.pro?.preco?.centavos, MENSALIDADE_PRO_RESERVA),
        recursos:
          Array.isArray(oferta.pro?.recursos) && oferta.pro.recursos.length > 0
            ? oferta.pro.recursos
            : RECURSOS_PRO_RESERVA,
        lojas: typeof oferta.pro?.lojas === "number" ? oferta.pro.lojas : LOJAS_NO_PRO_RESERVA,
      }
      : null

    // A escada de entrada existe só quando há teste: quem já gastou a
    // cortesia entra pagando a mensalidade cheia, sem degrau no meio.
    const entrada =
      oferta?.entrada && testeDias > 0
        ? {
          valor: reais(oferta.entrada?.centavos, MENSALIDADE_RESERVA / 2),
          dias: typeof oferta.entrada?.dias === "number" ? oferta.entrada.dias : TESTE_DIAS_RESERVA,
        }
        : null

    return {
      mensalidade: reais(oferta?.preco?.centavos, reserva.mensalidade),
      recursos,
      testeDias,
      pedeCartao: oferta?.teste_pede_cartao === true,
      entrada,
      pro,
    }

  } catch {
    return reserva
  }
}

/* ==========================================================================
   A página
   ========================================================================== */

export default async function Home() {

  const { mensalidade, recursos: inclui, testeDias, pedeCartao, entrada, pro } = await ofertaDaPagina()

  // Sem teste configurado a página volta a falar como falava: assine e pague.
  // É o mesmo texto de antes, e não um "0 dias grátis" sem sentido.
  const temTeste = testeDias > 0

  const chamada = temTeste ? `Testar ${testeDias} dias grátis` : "Criar conta"

  /**
   * A escada de entrada, escrita como três degraus.
   *
   * Ela não é enfeite de página: é o que o servidor de fato monta na
   * assinatura (ver internal/services/assinatura/entrada.go). Dizer só
   * "quinze dias grátis e depois a mensalidade" esconderia o degrau do meio —
   * e degrau escondido, quando aparece na fatura, custa o cliente.
   */
  const degraus = entrada
    ? [
      {
        quando: "Hoje",
        valor: "R$ 0,00",
        texto: `Você cadastra o cartão e não é cobrado nada. O sistema abre inteiro, com os ${testeDias} dias para usar de verdade.`,
      },
      {
        quando: `Dia ${testeDias}`,
        valor: formatarMoeda(entrada.valor),
        texto: `Acaba o teste e sai a primeira cobrança: meio mês por meio preço, que compra os ${entrada.dias} dias seguintes.`,
      },
      {
        quando: `Dia ${testeDias + entrada.dias}`,
        valor: `${formatarMoeda(mensalidade)}/mês`,
        texto:
          "Começa a mensalidade cheia, e ela se repete todo mês enquanto você quiser. Cancela no painel, quando decidir.",
      },
    ]
    : []

  return (
    <div className="min-h-screen bg-white">

      <Topo />

      {/* ==================================================================
          HERO
          ================================================================== */}
      <section className="border-b border-[#EBEBEB] bg-[#F1F1F1]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">

          <div>
            <span className="tag tag-info lp-entrada">
              Para lojas de qualquer ramo, no balcão e na internet
            </span>

            <h1 className="font-display lp-entrada lp-atraso-1 mt-4 text-3xl leading-tight text-[#303030] sm:text-[2.6rem]">
              A sua loja inteira, da prateleira ao caixa.
            </h1>

            <p className="lp-entrada lp-atraso-2 mt-4 max-w-xl text-base leading-relaxed text-[#616161]">
              Cada item com código próprio, a vitrine na internet vivendo do
              mesmo estoque, os pedidos organizados por dia de entrega, o
              atendimento no painel e o fechamento do caixa no fim do dia — sem
              planilha paralela e sem dois sistemas para conciliar.
              <span className="mt-2 block text-sm text-[#8A8A8A]">
                Eletro, casa, ferramentas, mercearia, vestuário: o sistema não
                supõe o que você vende.
              </span>
            </p>

            <div className="lp-entrada lp-atraso-3 mt-7 flex flex-wrap items-center gap-3">
              <Link href="/cadastro" className="btn btn-primario px-6 py-3 text-base">
                {chamada}
                <FiArrowRight className="lp-seta w-[1.05rem]" aria-hidden />
              </Link>

              <Link href="/login" className="btn btn-secundario px-6 py-3 text-base">
                Já tenho conta
              </Link>
            </div>

            {/* O que vem depois do clique, dito antes do clique: quanto custa,
                quando começa a custar e que o cartão vai ser pedido agora. É a
                dúvida que faz a pessoa não clicar. */}
            <p className="lp-entrada lp-atraso-4 mt-5 text-sm text-[#8A8A8A]">
              {temTeste ? (
                <>
                  {testeDias} dias para usar o sistema inteiro.
                  {pedeCartao ? " O cartão é cadastrado na entrada e nada é cobrado hoje." : ""}{" "}
                  Depois, {entrada ? "meio mês por meio preço e então " : ""}
                  {formatarMoeda(mensalidade)} por mês.
                </>
              ) : (
                <>Uma assinatura de {formatarMoeda(mensalidade)} por mês.</>
              )}{" "}
              Sem fidelidade: o cancelamento é feito por você mesmo, no painel.
            </p>
          </div>

          <div className="lp-entrada-lado">
            <MockupPainel />
          </div>

        </div>
      </section>

      {/* Faixa de capacidades — sem números inventados, só o que o sistema faz. */}
      <div className="border-b border-[#EBEBEB] bg-white">
        <ul className="lp-cascata mx-auto grid max-w-6xl gap-x-8 gap-y-3 px-4 py-5 text-sm font-semibold text-[#616161] sm:grid-cols-2 lg:grid-cols-4">
          {[
            { texto: "Código de barras por unidade", Icone: FiPrinter },
            { texto: "Vitrine com pagamento online", Icone: FiCreditCard },
            { texto: "Agenda de entregas e frete", Icone: FiCalendar },
            { texto: "Atendimento, equipe e rede de lojas", Icone: FiUsers },
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

        <div className="lp-revelar max-w-2xl">
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

          <ol className="lp-cascata space-y-5">
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
              É esta etiqueta que muda o resto: com ela, a unidade tem nome
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

          <h2 className="font-display lp-revelar text-2xl text-[#303030] sm:text-3xl">
            Do cabide ao caixa, em quatro passos
          </h2>

          <p className="lp-revelar mt-3 max-w-2xl text-base text-[#616161]">
            O caminho é o mesmo que a unidade já faz na sua loja hoje — a
            diferença é que agora cada etapa fica registrada.
          </p>

          <ol className="lp-cascata mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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

          <div className="lp-revelar">
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

          <div className="lp-revelar">
            <MockupAgenda />
          </div>

        </div>
      </section>

      {/* ==================================================================
          RECURSOS
          ================================================================== */}
      <section id="recursos" className="scroll-mt-20 border-y border-[#EBEBEB] bg-[#F1F1F1]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">

          <h2 className="font-display lp-revelar text-2xl text-[#303030] sm:text-3xl">
            O que vem no painel
          </h2>

          <p className="lp-revelar mt-3 max-w-2xl text-base text-[#616161]">
            Tudo dividido por tela, do jeito que a loja funciona: catálogo,
            estoque, vendas, atendimento e conta. Tudo o que está aqui embaixo
            vem no plano de entrada — nada nesta lista é vendido à parte.
          </p>

          <div className="lp-cascata mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
          ATENDIMENTO
          ================================================================== */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">

          <div className="lp-revelar">
            <MockupAtendimento />
          </div>

          <div className="lp-revelar">
            <span className="tag tag-info">Atendimento</span>

            <h2 className="font-display mt-4 text-2xl text-[#303030] sm:text-3xl">
              O WhatsApp da loja e o chat do site na mesma tela
            </h2>

            <p className="mt-4 text-base leading-relaxed text-[#616161]">
              O cliente escreve pelo chat da sua vitrine ou pelo WhatsApp da
              loja, e a conversa entra numa fila dentro do painel. Quem pega,
              atende — e a conversa sai da tela dos outros, para dois
              atendentes não responderem coisas diferentes ao mesmo cliente.
              Terminou, encerra. Se o cliente voltar a escrever, ela volta para
              a fila.
            </p>

            <ul className="mt-6 space-y-2.5">
              {[
                "Cada conversa com um responsável, e o histórico junto do cliente",
                "Quem respondeu fica gravado na mensagem, e quem vendeu, na unidade",
                "O catálogo do seu estoque à mão, para mandar a unidade dentro da conversa",
                "Sem abrir o celular no meio do expediente",
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

            <div className="lp-revelar">
              <span className="tag bg-white/15 text-white">Já vem no plano de entrada</span>

              <h2 className="font-display mt-4 text-2xl text-white sm:text-3xl">
                A sua loja também fica de pé na internet
              </h2>

              <p className="mt-4 text-base leading-relaxed text-white/85">
                A vitrine mostra o mesmo estoque do painel: a unidade vendida no
                balcão deixa de aparecer para o cliente na mesma hora. Ele paga
                por Pix ou cartão, acompanha o pedido por uma tela própria,
                imprime o comprovante e avalia o que recebeu — e você escolhe o
                endereço dela e monta a página inicial arrastando as seções,
                sem mexer em código.
              </p>

              <ul className="mt-6 space-y-2.5">
                {[
                  "Catálogo alimentado pelo próprio estoque",
                  "Editor da home: banners, prateleiras, textos e colunas",
                  "Frete por estado, com prazo e frete grátis acima de um valor",
                  "Pagamento numa página segura — nenhum dado de cartão passa por aqui",
                  "Tela de acompanhamento, comprovante e avaliação do produto",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm font-semibold text-white">
                    <FiCheck className="mt-0.5 w-4 shrink-0" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="lp-cascata space-y-4">
              <MockupVitrine />
              <MockupComprovante />
            </div>

          </div>
        </div>
      </section>

      {/* ==================================================================
          EQUIPE E REDE — o que o Pro acrescenta

          Fica DEPOIS do que todo mundo leva, e não antes: quem chegou agora
          precisa entender o sistema antes de ser convidado a pagar mais por
          ele. E só aparece quando o servidor devolve o Pro — anunciar um
          plano que o checkout não sabe cobrar é mandar o lojista a um erro.
          ================================================================== */}
      {pro && (
        <section id="equipe" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:py-20">

          <div className="lp-revelar max-w-2xl">
            <span className="tag tag-info">
              <FiLock className="w-3" aria-hidden />
              Plano Pro
            </span>

            <h2 className="font-display mt-4 text-2xl text-[#303030] sm:text-3xl">
              Quando a loja deixa de ser de uma pessoa só
            </h2>

            <p className="mt-3 text-base leading-relaxed text-[#616161]">
              Quem toca a loja sozinho não tem equipe a cadastrar nem segunda
              unidade a abrir — e não deve pagar por telas que nunca vai abrir.
              É essa a linha entre os dois planos: o Pro é o que só existe
              quando há mais gente, ou mais de um endereço.
            </p>
          </div>

          <div className="mt-10 grid items-start gap-8 lg:grid-cols-2 lg:gap-12">

            <div className="lp-cascata space-y-4">
              <MockupEquipe />
              <MockupRede />
            </div>

            <div className="lp-cascata space-y-5">
              {recursosPro.map(({ titulo, texto, Icone }) => (
                <article key={titulo} className="card p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF4FF]">
                      <Icone className="w-[1.05rem] text-[#00369B]" aria-hidden />
                    </span>

                    <h3 className="font-display text-lg text-[#303030]">{titulo}</h3>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-[#616161]">{texto}</p>
                </article>
              ))}

              <p className="text-sm leading-relaxed text-[#8A8A8A]">
                Até {pro.lojas} lojas na mesma conta e no mesmo login. A filial
                não é um cadastro novo: ela nasce dentro da sua conta, herda a
                cara do site da matriz e leva o próprio estoque, preço, caixa e
                equipe. O cliente troca de unidade na própria vitrine.
              </p>
            </div>

          </div>
        </section>
      )}

      {/* ==================================================================
          A ESCADA DE COBRANÇA

          Os três degraus que o servidor monta de verdade na assinatura. Vêm
          ANTES dos preços porque é a pergunta que antecede o preço: não
          "quanto custa", mas "quando começa a custar".
          ================================================================== */}
      {degraus.length > 0 && (
        <section className="border-y border-[#EBEBEB] bg-[#F1F1F1]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">

            <div className="lp-revelar max-w-2xl">
              <span className="tag tag-info">Como começa a cobrança</span>

              <h2 className="font-display mt-4 text-2xl text-[#303030] sm:text-3xl">
                Do primeiro dia até a primeira mensalidade
              </h2>

              <p className="mt-3 text-base leading-relaxed text-[#616161]">
                Ninguém vai de “não conheço” a mensalidade cheia num passo só.
                São três, e cada um pede um pouco mais depois de ter entregado
                um pouco mais — está escrito aqui porque é exatamente isto que
                a sua fatura vai dizer.
              </p>
            </div>

            {/* A linha é o tempo passando, e ela se desenha conforme a seção
                sobe na tela (.lp-linha, em globals.css). Fica atrás dos três
                cartões e escondida do leitor de tela: é desenho, e o que ela
                diz já está escrito nos degraus. */}
            <div className="relative mt-10">
              <span
                className="lp-linha absolute left-0 right-0 top-6 hidden h-px bg-[#B5B5B5] md:block"
                aria-hidden
              />

              <ol className="lp-cascata relative grid gap-5 md:grid-cols-3">
                {degraus.map(({ quando, valor, texto }, i) => (
                  <li key={quando} className="card p-6">
                    <div className="flex items-center gap-3">
                      <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF4FF] text-sm font-extrabold text-[#00369B]">
                        {i + 1}
                      </span>

                      <span className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#8A8A8A]">
                        {quando}
                      </span>
                    </div>

                    <p className="num font-display mt-4 text-2xl text-[#303030]">{valor}</p>

                    <p className="mt-2 text-sm leading-relaxed text-[#616161]">{texto}</p>
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-6 max-w-3xl text-sm leading-relaxed text-[#8A8A8A]">
              O cartão é cadastrado no primeiro dia e não é cobrado nele — é ele
              que faz a cobrança do dia {testeDias} acontecer sozinha, sem você
              ter de voltar e assinar de novo. Cancelando antes disso, não há
              cobrança nenhuma.
            </p>
          </div>
        </section>
      )}

      {/* ==================================================================
          PLANOS
          ================================================================== */}
      <section id="planos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:py-20">

        <div className="lp-revelar mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl text-[#303030] sm:text-3xl">
            {pro ? "Dois planos, e a diferença é uma linha só" : "Um preço, sem pegadinha"}
          </h2>

          <p className="mt-3 text-base text-[#616161]">
            {pro ? (
              <>
                O de entrada é o sistema inteiro para quem toca uma loja:
                estoque, balcão, vitrine, pedidos e clientes. O Pro acrescenta
                o que só existe quando há equipe ou mais de um endereço. Sem
                fidelidade nos dois, e a troca é feita por você mesmo, no
                painel.
              </>
            ) : (
              <>
                Quem assina recebe o sistema inteiro, do cadastro da primeira
                unidade à loja no ar com pagamento. Sem fidelidade, e o
                cancelamento é feito por você mesmo.
              </>
            )}
          </p>
        </div>

        {/* Sem `items-start`: os dois cartões têm a MESMA altura. O Pro tem
            quatro linhas e o de entrada tem vinte e quatro, e deixar cada um
            com a sua altura fazia o Pro parecer um cartão que faltou
            terminar — que é o contrário do que ele é. O botão de cada um
            desce para o rodapé do cartão pelo `mt-auto`. */}
        <div className={`mx-auto mt-10 grid gap-5 ${pro ? "max-w-5xl lg:grid-cols-2" : "max-w-3xl"}`}>

          {/* ---------------- O plano de entrada ---------------- */}
          <article className="card lp-plano lp-revelar flex flex-col border-[#005BD3] p-7 sm:p-8">

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg text-[#303030]">{MARCA}</p>
                <p className="mt-1 text-sm text-[#616161]">
                  Para quem toca a loja — no balcão, na internet, ou nos dois.
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

              {entrada ? (
                <p className="mt-2 text-sm text-[#616161]">
                  Nada hoje. No dia {testeDias}, {formatarMoeda(entrada.valor)} pelo
                  meio mês seguinte; a mensalidade cheia começa no dia{" "}
                  {testeDias + entrada.dias}.
                </p>
              ) : temTeste ? (
                <p className="mt-2 text-sm text-[#616161]">
                  A cobrar só depois dos {testeDias} dias de teste.
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
              <FiArrowRight className="lp-seta w-[1.05rem]" aria-hidden />
            </Link>
          </article>

          {/* ---------------- O Pro ---------------- */}
          {pro && (
            <article className="card lp-plano lp-revelar flex flex-col p-7 sm:p-8">

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg text-[#303030]">{MARCA_PRO}</p>
                  <p className="mt-1 text-sm text-[#616161]">
                    Para quem tem equipe, ou mais de uma loja.
                  </p>
                </div>

                <span className="tag tag-neutral shrink-0">até {pro.lojas} lojas</span>
              </div>

              <div className="mt-6 border-b border-[#EBEBEB] pb-6">
                <div className="flex items-baseline gap-1.5">
                  <Preco valor={pro.mensalidade} className="text-4xl" />
                  <span className="text-sm font-bold text-[#616161]">/mês</span>
                </div>

                <p className="mt-2 text-sm text-[#616161]">
                  {temTeste ? `O mesmo teste de ${testeDias} dias. ` : ""}
                  O Pro se liga na tela de assinatura do painel, quando você
                  quiser — e se desliga do mesmo jeito.
                </p>
              </div>

              <p className="mt-6 text-sm font-semibold text-[#303030]">
                Tudo do plano de entrada, mais:
              </p>

              <ul className="mt-3 mb-8 grid gap-2.5">
                {pro.recursos.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm font-semibold text-[#303030]">
                    <FiPlus className="mt-0.5 w-4 shrink-0 text-[#005BD3]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>

              <p className="mt-auto border-t border-[#EBEBEB] pt-6 text-sm leading-relaxed text-[#616161]">
                Inclui tudo o que está ao lado: estoque unidade a unidade, etiquetas,
                balcão, vitrine com pagamento, pedidos, entregas, clientes e
                atendimento. O Pro não troca o sistema por outro — ele abre as
                telas que só fazem sentido com mais gente, ou mais de um
                endereço.
              </p>

              <Link href="/cadastro" className="btn btn-secundario mt-8 w-full py-3 text-base">
                {temTeste ? chamada : "Criar a minha conta"}
                <FiArrowRight className="lp-seta w-[1.05rem]" aria-hidden />
              </Link>
            </article>
          )}
        </div>

        <div className="lp-cascata mx-auto mt-8 grid max-w-5xl gap-3 sm:grid-cols-3">
          {[
            { titulo: "Sem fidelidade", texto: "Cancela no painel, quando quiser.", Icone: FiCheck },
            {
              titulo: "Cartão fora daqui",
              texto: "Nenhum dígito do seu cartão passa por este sistema.",
              Icone: FiCreditCard,
            },
            {
              titulo: "Suporte a quem usa",
              texto: "As dúvidas chegam pelo mesmo canal do sistema.",
              Icone: FiStar,
            },
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
          A assinatura é cobrada todo mês no cartão. O pagamento acontece numa
          página segura do processador de cobrança, e o cancelamento fica na
          tela de assinatura do seu painel.
          {pro
            ? " Trocar de plano não recomeça nada: a assinatura é a mesma, e a diferença é acertada na fatura seguinte."
            : ""}
        </p>
      </section>

      {/* ==================================================================
          PERGUNTAS

          `<details>` nativo: abre sem JavaScript, e o buscador lê a resposta
          mesmo com a pergunta fechada.
          ================================================================== */}
      <section id="perguntas" className="scroll-mt-20 border-y border-[#EBEBEB] bg-[#F1F1F1]">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">

          <h2 className="font-display lp-revelar text-2xl text-[#303030] sm:text-3xl">
            O que costumam perguntar antes de assinar
          </h2>

          <div className="lp-cascata mt-8 space-y-3">
            {perguntas.map(({ pergunta, resposta }) => (
              <details key={pergunta} className="lp-pergunta card p-0">
                <summary className="flex items-center justify-between gap-4 p-5">
                  <span className="font-display text-base text-[#303030]">{pergunta}</span>

                  <FiPlus className="lp-cruz w-[1.05rem] shrink-0 text-[#005BD3]" aria-hidden />
                </summary>

                <p className="border-t border-[#EBEBEB] p-5 text-sm leading-relaxed text-[#616161]">
                  {resposta}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================================
          O ÚLTIMO CONVITE
          ================================================================== */}
      <section className="bg-[#1A1A1A]">
        <div className="lp-revelar mx-auto max-w-3xl px-4 py-16 text-center sm:py-20">

          <h2 className="font-display text-2xl text-white sm:text-3xl">
            Comece pela primeira unidade
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-white/70">
            Cadastre um produto, imprima a etiqueta e bipe a primeira venda
            ainda hoje.{temTeste ? ` São ${testeDias} dias com o sistema inteiro aberto.` : ""}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/cadastro"
              className="btn btn-primario border-white bg-white px-6 py-3 text-base text-[#1A1A1A]"
            >
              {temTeste ? chamada : "Criar a minha conta"}
              <FiArrowRight className="lp-seta w-[1.05rem]" aria-hidden />
            </Link>

            <Link
              href="/login"
              className="btn btn-secundario border-white/30 bg-transparent px-6 py-3 text-base text-white"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
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
                <p className="font-display text-[1.05rem] text-[#303030]">{MARCA}</p>
                <p className="text-xs text-[#8A8A8A]">Gestão de estoque e vendas</p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#616161]">
              {[
                { nome: "O fundamento", hash: "#fundamento" },
                { nome: "Recursos", hash: "#recursos" },
                { nome: "Vitrine", hash: "#vitrine" },
                { nome: "Planos", hash: "#planos" },
                { nome: "Perguntas", hash: "#perguntas" },
              ].map(({ nome, hash }) => (
                <Link key={hash} href={hash} className="hover:text-[#005BD3]">
                  {nome}
                </Link>
              ))}
            </nav>

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
            © {new Date().getFullYear()} {MARCA}. Todos os direitos reservados.
          </p>
        </div>
      </footer>

    </div>
  )
}
