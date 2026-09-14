"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { logout } from "@/middleware/auth"
import { Simbolo } from "@/app/components/marca/marca"
import { consultarMenu } from "@/middleware/assinatura"
import { consultarEquipeChat } from "@/middleware/equipe"
import { consultarNotificacoes } from "@/middleware/notificacoes"
import { consultarRede, trocarDeLoja } from "@/middleware/lojas"
import { escutarLoja } from "@/middleware/whatsapp"
import type { ItemMenu, LojaDaRede, Notificacoes } from "@/app/type/type"
import {
    FiArrowDown,
    FiBox,
    FiChevronDown,
    FiChevronsLeft,
    FiChevronsRight,
    FiClipboard,
    FiGrid,
    FiLayers,
    FiRepeat,
    FiHome,
    FiPlus,
    FiMapPin,
    FiAlertTriangle,
    FiImage,
    FiSearch,
    FiSettings,
    FiShoppingBag,
    FiShoppingCart,
    FiTruck,
    FiTag,
    FiCheck,
    FiX,
    FiBarChart2,
    FiCornerUpLeft,
    FiCreditCard,
    FiEye,
    FiFilePlus,
    FiGlobe,
    FiLock,
    FiLogOut,
    FiMenu,
    FiMessageCircle,
    FiPackage,
    FiPrinter,
    FiDollarSign,
    FiUsers,
    FiCalendar,
    FiVideo,
    FiBell,
    FiArrowLeft,
    FiSmartphone,
    FiMessageSquare,
} from "react-icons/fi"
import { MARCA } from "@/app/marca"
import type { IconType } from "react-icons"

// Ícone de cada tela, pela chave que o backend manda. Só isto fica aqui: o
// que existe no menu, em que seção e em que ordem é resposta do servidor
// (ver internal/services/assinatura/recursos.go), porque é lá que se sabe o
// plano da loja. Chave nova sem ícone cai no genérico e ainda aparece.
const ICONES: Record<string, IconType> = {
    inicio: FiHome,
    "painel-produtos": FiBarChart2,
    "painel-equipe": FiUsers,
    "painel-entregas": FiTruck,
    config: FiSettings,
    produtos: FiBox,
    produto: FiPlus,
    estoque: FiPackage,
    "estoque-inserir": FiTruck,
    "estoque-consultar": FiSearch,
    "estoque-enderecos": FiMapPin,
    "estoque-config": FiPrinter,
    "estoque-fila": FiClipboard,
    "estoque-reposicao": FiArrowDown,
    "estoque-inventario": FiBarChart2,
    "estoque-ondas": FiRepeat,
    "estoque-devolucoes": FiCornerUpLeft,
    avarias: FiAlertTriangle,
    banners: FiImage,
    conversas: FiMessageCircle,
    venda: FiShoppingBag,
    pedidos: FiShoppingCart,
    "pedidos-novo": FiFilePlus,
    etiquetas: FiTag,
    vendidos: FiCheck,
    loja: FiGlobe,
    vitrine: FiEye,
    assinatura: FiCreditCard,
    funcionarios: FiUsers,
    frete: FiTruck,
    entregas: FiCalendar,
    pagamento: FiDollarSign,
}

/* ==========================================================================
   As ÁREAS, no trilho escuro
   ==========================================================================

   O trilho tem uma entrada por seção do menu, e as seções são as que o
   servidor manda (ver recursos.go): Painel, Vendas, Produtos e estoque,
   Conta. Só o ícone e o rótulo curto moram aqui — o que existe em cada área
   continua sendo resposta do servidor, porque é lá que se sabe o plano da
   loja.

   O rótulo é curto porque o trilho tem 64px: "Produtos e estoque" não cabe,
   e cortado no meio não se lê. Seção nova sem entrada aqui aparece com o
   ícone genérico e o título inteiro — some do trilho é o que ela não pode
   fazer. */
const ICONE_DA_AREA: Record<string, IconType> = {
    painel: FiHome,
    vendas: FiShoppingCart,
    "produtos e estoque": FiPackage,
    conta: FiUsers,
}

const ROTULO_DA_AREA: Record<string, string> = {
    painel: "Início",
    vendas: "Vendas",
    "produtos e estoque": "Estoque",
    conta: "Conta",
}

/* ==========================================================================
   Os ATALHOS do trilho: a conversa da equipe e as lojas
   ==========================================================================

   Duas telas que não são "área da loja" e mesmo assim se usa o dia inteiro.
   No catálogo do servidor as duas moram em Conta — a conversa como filha de
   Funcionários, as lojas soltas —, e é lá que elas ficavam: três cliques
   (abrir Conta, abrir Funcionários, achar a conversa) para uma tela que se
   abre vinte vezes por dia.

   No trilho elas ganham a mesma altura das áreas, separadas por um fio: em
   cima os lugares de trabalho, embaixo com quem falar e onde trabalhar.

   E SAEM da lista do painel, no desktop, em vez de aparecer nos dois lugares
   — a mesma tela com duas portas é o que o painel não deve ter. No celular
   não há trilho, então lá elas continuam na lista, que é a única porta que
   existe.

   Sair da lista leva junto o que está pendurado nelas, e isso é deliberado:
   a Assinatura mora dentro de Configurações, some do painel enquanto
   Configurações está no trilho, e VOLTA no dia em que a assinatura vence —
   porque aí Configurações fica bloqueada, deixa de virar atalho, e a lista
   do painel a mostra de novo com a Assinatura aberta embaixo. É onde o
   lojista precisa dela, no único dia em que ela importa. */
const ATALHOS_DO_TRILHO: { chave: string; rotulo: string; Icone: IconType }[] = [
    { chave: "equipe-chat", rotulo: "Equipe", Icone: FiMessageSquare },
    { chave: "lojas", rotulo: "Lojas", Icone: FiLayers },
    { chave: "config", rotulo: "Config", Icone: FiSettings },
]

/**
 * A lista da área sem o que o trilho ESTÁ mostrando.
 *
 * `noTrilho` traz só os atalhos que de fato nasceram lá — e isso importa para
 * a tela que existe mas está trancada. As lojas da rede e a conversa da
 * equipe são do plano Pro: para quem não assinou, elas chegam do servidor
 * como bloqueadas, e é DELIBERADO que apareçam assim, com cadeado — é como o
 * lojista descobre que existem. O trilho não as carrega (ele só leva a tela
 * que abre), então elas precisam continuar na lista do painel.
 *
 * Escondê-las dos dois lugares, que foi o que esta função fazia primeiro,
 * vendia o Pro só para quem já tinha ido procurar a tela de assinatura.
 */
function semAtalhos(nos: No[], noTrilho: Set<string>): No[] {
    return nos
        .filter((no) => !noTrilho.has(no.item.chave))
        .map((no) => ({
            item: no.item,
            filhos: no.filhos.filter((filho) => !noTrilho.has(filho.chave)),
        }))
}

// Enquanto o menu não chega — e se ele não chegar —, o lojista fica ao menos
// com a tela de assinatura: é dela que sai o pagamento que destrava o resto.
const MENU_MINIMO: ItemMenu[] = [
    { chave: "assinatura", nome: "Assinatura", rota: "/page/assinatura", secao: "Conta", liberado: true },
]

/** Altura da barra superior. Em rem para casar com o `top-14` das telas. */
const ALTURA_TOPO = "3.5rem"

/** Uma tela do menu com o que abre debaixo dela. */
interface No {
    item: ItemMenu
    filhos: ItemMenu[]
}

/**
 * Texto pronto para comparação: minúsculo e sem acento.
 *
 * Quem procura a tela de endereços digita "enderecos" — o teclado do balcão
 * raramente tem alguém com paciência para o cedilha. Comparar sem acento faz
 * a busca achar o que a pessoa quis dizer, e não o que ela conseguiu digitar.
 */
/**
 * Uma linha do sino.
 *
 * Zero não desaparece: some o número, fica a linha em cinza. A lista precisa
 * ser sempre a mesma para o olho achar "WhatsApp" no mesmo lugar — uma lista
 * que muda de tamanho conforme o que chegou obriga a lê-la inteira toda vez.
 */
function Novidade({ href, Icone, rotulo, quantos, aoIr }: {
    href: string
    Icone: IconType
    rotulo: string
    quantos: number
    aoIr: () => void
}) {
    return (
        <Link
            href={href}
            role="menuitem"
            onClick={aoIr}
            className="flex items-center gap-2.5 border-b border-[#EBEBEB] px-3 py-2.5 text-[0.8125rem] transition-colors last:border-b-0 hover:bg-[#F7F7F7]"
        >
            <Icone className="w-4 shrink-0 text-[#8A8A8A]" aria-hidden />

            <span className={`flex-1 ${quantos > 0 ? "font-medium text-[#303030]" : "text-[#8A8A8A]"}`}>
                {rotulo}
            </span>

            {quantos > 0 && (
                <span className="num rounded-full bg-[#E51C00] px-1.5 py-0.5 text-[0.6875rem] font-bold text-white">
                    {quantos > 99 ? "99+" : quantos}
                </span>
            )}
        </Link>
    )
}

function comparavel(texto: string) {
    return texto
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
}

/**
 * Monta o menu como o servidor o descreveu: agrupado por seção, e dentro de
 * cada seção com as telas filhas penduradas na sua (`pai`).
 *
 * Filho cujo pai não veio na resposta — porque o plano da loja não inclui a
 * tela de cima — sobe para o primeiro nível em vez de sumir: melhor um item
 * solto do que uma tela paga que o lojista não encontra.
 */
function montarSecoes(itens: ItemMenu[]): { titulo: string; nos: No[] }[] {

    const nosPorChave = new Map<string, No>()

    for (const item of itens) {
        if (!item.pai) nosPorChave.set(item.chave, { item, filhos: [] })
    }

    const secoes: { titulo: string; nos: No[] }[] = []

    function secaoDe(titulo: string) {
        const achada = secoes.find((s) => s.titulo === titulo)

        if (achada) return achada

        const nova = { titulo, nos: [] as No[] }
        secoes.push(nova)
        return nova
    }

    for (const item of itens) {

        const pai = item.pai ? nosPorChave.get(item.pai) : undefined

        if (pai) {
            pai.filhos.push(item)
            continue
        }

        const no = nosPorChave.get(item.chave) ?? { item, filhos: [] }

        nosPorChave.set(item.chave, no)
        secaoDe(item.secao || "Painel").nos.push(no)
    }

    return secoes
}

export default function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const [aberto, setAberto] = useState(false)
    const [saindo, setSaindo] = useState(false)
    const [erroSaida, setErroSaida] = useState("")

    // O menu vem do backend já resolvido para o plano desta loja: quem está
    // no plano de estoque não recebe "Pedidos" nem "Banners", e por isso eles
    // não aparecem aqui. Lista fixa no front repetiria a regra de plano — e
    // ofereceria telas que a API recusaria abrir.
    const [menu, setMenu] = useState<ItemMenu[]>([])
    const [carregando, setCarregando] = useState(true)

    // Acordeões que o lojista abriu ou fechou na mão. O que ele não tocou
    // fica por conta da tela em que está: o grupo da página atual nasce
    // aberto, senão quem entra em Banners não vê onde está.
    const [acordeoes, setAcordeoes] = useState<Record<string, boolean>>({})

    // A área que o lojista abriu no trilho, e a tela em que ele estava ao
    // abri-la.
    //
    // A rota vai junto de propósito: é ela que faz a escolha valer só
    // enquanto ele não sai do lugar. Quem espia "Conta" e depois abre um
    // pedido pela busca do topo volta a ver o painel de Vendas, sem que
    // ninguém precise limpar nada. A alternativa seria um efeito zerando a
    // escolha a cada troca de tela — um render a mais para dizer o que já dá
    // para descobrir olhando.
    //
    // Nula é "a área da tela em que estou", que é como o painel nasce.
    const [area, setArea] = useState<{ titulo: string; rota: string } | null>(null)

    // Painel recolhido deixa só o trilho — e 224px a mais para a tabela.
    const [painelRecolhido, setPainelRecolhido] = useState(false)

    // Busca de tela e menu da conta, os dois controles da barra superior.
    const [busca, setBusca] = useState("")
    const [buscaFocada, setBuscaFocada] = useState(false)
    const [contaAberta, setContaAberta] = useState(false)
    const campoBusca = useRef<HTMLInputElement>(null)

    const noPainel = pathname.startsWith("/page/")

    // Dentro da conversa da equipe o menu do painel sai de cena e a própria
    // tela desenha o menu dela — grupos, pessoas, chamadas. O motivo é que
    // ali a navegação é OUTRA: quem está conversando escolhe com quem falar,
    // não em qual tela do estoque entrar, e dois menus empilhados na mesma
    // borda esquerda fariam a pessoa procurar a conversa dentro da lista de
    // pedidos.
    //
    // Só o menu sai. A barra escura de cima fica, com a marca e o caminho de
    // volta: sem ela, a conversa viraria um beco de onde só se sai pelo botão
    // de voltar do navegador.
    const noChat = pathname.startsWith("/page/equipe")

    // Quantas mensagens a equipe deixou para esta pessoa, para a bolinha do
    // ícone lá em cima. Vem da mesma rota da tela de conversa, e é o servidor
    // que decide o que ela pode ver: quem o dono ainda não confirmou recebe
    // zero, porque não tem conversa nenhuma.
    const [naoLidas, setNaoLidas] = useState(0)

    // O que chegou e ninguém viu: pedido novo, WhatsApp e chat do site.
    const [novidades, setNovidades] = useState<Notificacoes>({
        pedidos: 0, whatsapp: 0, site: 0, equipe: 0, total: 0,
    })

    const [sinoAberto, setSinoAberto] = useState(false)

    // As lojas do dono, para o seletor. Vazio para funcionário — ele não deve
    // nem saber que existem outras lojas além daquela em que trabalha.
    const [minhasLojas, setMinhasLojas] = useState<LojaDaRede[]>([])
    const [lojasAberto, setLojasAberto] = useState(false)
    const [trocando, setTrocando] = useState(0)

    useEffect(() => {
        if (!noPainel) return

        let cancelado = false

        async function buscar() {
            try {
                const itens = await consultarMenu()

                if (!cancelado) setMenu(itens.length > 0 ? itens : MENU_MINIMO)
            } catch {
                // Sem resposta do servidor, o mínimo: a tela de assinatura.
                if (!cancelado) setMenu(MENU_MINIMO)
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [noPainel])

    // A tela em que o lojista está é UMA, e só ela fica acesa.
    //
    // Casar por prefixo, item a item, acendia duas de uma vez: "Estoque"
    // (/page/estoque) casa com /page/estoque/inserir junto com "Entrada de
    // mercadoria", e casa até com /page/estoque/enderecos — que é outro
    // acordeão, ao lado. O lojista via o realce num item enquanto estava em
    // outro.
    //
    // Vence a rota mais longa que casa com o endereço atual: entre
    // /page/estoque e /page/estoque/enderecos, ganha a segunda. Tela que não
    // está no menu (a etiqueta de um produto, por exemplo) continua
    // acendendo a tela de que ela saiu, que é o prefixo mais longo que
    // sobrou.
    const rotaAtiva = useMemo(() => {

        let melhor = ""

        for (const item of menu) {

            const casa = pathname === item.rota || pathname.startsWith(item.rota + "/")

            if (casa && item.rota.length > melhor.length) melhor = item.rota
        }

        return melhor

    }, [menu, pathname])

    /* ==================================================================
       As áreas e qual delas está na tela
       ================================================================== */

    const secoes = useMemo(() => montarSecoes(menu), [menu])

    // A área da tela em que o lojista está. É o padrão do painel: quem abre
    // /page/estoque/enderecos por um link vê o painel de Estoque, sem ter
    // clicado no trilho.
    const areaDaRota = useMemo(() => {

        if (!rotaAtiva) return undefined

        return secoes.find((secao) =>
            secao.nos.some(
                (no) => no.item.rota === rotaAtiva || no.filhos.some((filho) => filho.rota === rotaAtiva),
            ),
        )?.titulo

    }, [secoes, rotaAtiva])

    /* Os atalhos que ESTA loja tem.
     *
     * Saem do mesmo menu que o servidor respondeu — e não de uma lista fixa
     * aqui — porque quem decide o que existe é ele: a conversa da equipe e as
     * várias lojas são do plano Pro, e um ícone fixo no trilho ofereceria a
     * quem não tem uma tela que a API recusaria abrir. Sem o item no menu, o
     * atalho simplesmente não nasce. */
    const atalhos = useMemo(() => {

        return ATALHOS_DO_TRILHO.flatMap((atalho) => {

            const item = menu.find((umItem) => umItem.chave === atalho.chave && umItem.liberado)

            return item ? [{ ...atalho, rota: item.rota }] : []
        })

    }, [menu])

    /* O que o painel mostra.
     *
     * Três respostas, nesta ordem:
     *
     *   1. A ÁREA QUE O LOJISTA ABRIU no trilho — e ela só vale enquanto ele
     *      não trocou de tela, por isso a escolha guarda a rota em que foi
     *      feita. É o que dispensa um efeito zerando a escolha a cada
     *      navegação.
     *
     *   2. O ATALHO em que ele está. Esta é a resposta que faltava: Lojas e
     *      Configurações moram na seção "Conta" do catálogo, então, estando
     *      numa delas, o painel mostrava a lista de Conta — e os três botões
     *      do trilho levavam à mesma lista, como se fossem a mesma coisa.
     *      Agora o painel é do atalho: Configurações mostra o que abre dentro
     *      dela (a Assinatura), e Lojas, que não abre nada, não mostra painel
     *      nenhum — a tela fica com a largura inteira, como na conversa da
     *      equipe.
     *
     *   3. A área da tela atual, que é o caso comum.
     */
    const areaVisivel = useMemo(() => {

        const escolhida = area && area.rota === rotaAtiva ? area.titulo : undefined

        if (!escolhida) {

            const atalhoAberto = atalhos.find((atalho) => atalho.rota === rotaAtiva)

            if (atalhoAberto) {

                const no = secoes
                    .flatMap((secao) => secao.nos)
                    .find((umNo) => umNo.item.chave === atalhoAberto.chave)

                // Atalho sem nada dentro não desenha painel: uma coluna de
                // 240px com um item só, que é justamente o que já está aceso
                // no trilho ao lado, é espaço tirado da tela de trabalho.
                if (!no || no.filhos.length === 0) return null

                return {
                    titulo: no.item.nome,
                    nos: no.filhos.map((filho) => ({ item: filho, filhos: [] })),
                }
            }
        }

        return secoes.find((secao) => secao.titulo === (escolhida ?? areaDaRota)) ?? secoes[0]

    }, [secoes, atalhos, area, areaDaRota, rotaAtiva])

    /* A largura que o menu ocupa, anunciada às telas.
     *
     * Elas leem --menu pela classe .com-menu (ver globals.css) em vez de cada
     * uma saber quanto mede o menu. Por isso o valor é escrito aqui, que é o
     * único lugar que sabe se o painel está aberto: sem isso, recolher o
     * painel deixaria 224px de cinza vazio em toda tela do painel.
     *
     * Na conversa da equipe o painel do menu não existe, mas a coluna da
     * conversa ocupa a mesma faixa — e é por isso que a largura cheia vale
     * ali também. */
    useEffect(() => {

        if (!noPainel) return

        const recolhido = painelRecolhido && !noChat

        document.documentElement.style.setProperty("--menu", recolhido ? "4rem" : "19rem")

        return () => {
            document.documentElement.style.removeProperty("--menu")
        }

    }, [painelRecolhido, noPainel, noChat])


    // A tela aberta é um dos atalhos? Então a área dela não acende.
    const numAtalho = atalhos.some((atalho) => atalho.rota === rotaAtiva)

    // O que o trilho está de fato carregando. Tela do Pro que esta loja não
    // assinou não entra aqui — ela não vira atalho, e por isso continua na
    // lista do painel, com o cadeado que a anuncia.
    const chavesNoTrilho = useMemo(
        () => new Set(atalhos.map((atalho) => atalho.chave)),
        [atalhos],
    )

    /* Quantas coisas esperam NESTA tela.
     *
     * O número é o mesmo do sino — ele não conta nada por conta própria, só
     * mostra ao lado do nome o que já estava contado lá em cima. Antes, para
     * descobrir que eram três no chat do site e não no WhatsApp, era preciso
     * abrir o sino e ler a lista; agora está escrito na porta de cada uma.
     *
     * Tela sem contagem devolve zero e não desenha nada: contador que mostra
     * "0" é ruído, e vinte deles numa lista de menu é uma lista ilegível. */
    function contagemDoItem(chave: string): number {

        switch (chave) {
            case "pedidos":
                return novidades.pedidos
            case "conversas":
                return novidades.whatsapp
            case "atendimento":
                return novidades.site
            case "equipe-chat":
                return naoLidas
            default:
                return 0
        }
    }

    /* Tem coisa esperando nesta área?
     *
     * Só o que o sino já conta, e nada de novo: pedido que chegou e WhatsApp
     * ou chat sem resposta são de Vendas. A bolinha existe para o lojista não
     * precisar abrir a área para descobrir que havia algo lá — é o preço de
     * ter fechado as outras áreas. */
    function contagemDaArea(secao: { nos: No[] }): number {

        let total = 0

        for (const no of secao.nos) {

            total += contagemDoItem(no.item.chave)

            for (const filho of no.filhos) {
                total += contagemDoItem(filho.chave)
            }
        }

        return total
    }

    // O que a busca do topo acha. Ela procura entre as telas que ESTE lojista
    // tem — é o mesmo menu, e por isso nunca oferece uma porta que a API
    // recusaria abrir. O nome da seção também entra na comparação: quem
    // digita "estoque" encontra as telas do grupo, não só a que se chama
    // assim.
    const achados = useMemo(() => {

        const alvo = comparavel(busca.trim())

        if (alvo.length === 0) return []

        return menu
            .filter((item) =>
                comparavel(item.nome).includes(alvo) ||
                comparavel(item.secao || "").includes(alvo),
            )
            .slice(0, 8)

    }, [busca, menu])

    // A bolinha das novidades.
    //
    // Recarrega ao trocar de tela e a cada aviso do canal ao vivo — o mesmo
    // socket que já traz mensagem de cliente e pedido novo, e que agora é um
    // por aba (ver escutarLoja). Sem isto, quem está conferindo uma remessa
    // não fica sabendo que entrou uma venda até abrir outra tela.
    useEffect(() => {

        if (!noPainel) return

        let cancelado = false

        async function contar() {
            const dados = await consultarNotificacoes()

            if (!cancelado) setNovidades(dados)
        }

        contar()

        // Uma rajada de avisos vira UMA chamada.
        //
        // Sem isto, dez mensagens chegando juntas num atendimento movimentado
        // viravam dez pedidos ao servidor para desenhar o mesmo número — e a
        // loja inteira sai por um IP só, então era assim que o painel batia no
        // limite de requisições justamente na hora de mais movimento.
        let agendado: ReturnType<typeof setTimeout> | null = null

        function contarDepois() {

            if (agendado) return

            agendado = setTimeout(() => {
                agendado = null
                contar()
            }, 900)
        }

        const fechar = escutarLoja((aviso) => {
            if (["pedido", "mensagem", "conversa", "atendimento", "equipe"].includes(aviso.tipo)) {
                contarDepois()
            }
        })

        /* A rede de segurança: uma recontagem por minuto, aconteça o que
         * acontecer.
         *
         * O socket é quem faz o número aparecer na hora, e ele se reconecta
         * sozinho — menos num caso: endereço de socket mal configurado, em que
         * ele desiste de vez de propósito (ver escutarLoja) para não bater no
         * servidor a cada trinta segundos para sempre. Nesse caso o contador
         * congelava até alguém trocar de tela, e ninguém tinha como desconfiar:
         * um número parado parece um número certo.
         *
         * Um minuto é devagar de propósito. Não é por aqui que a venda nova
         * aparece — isso continua sendo o socket, em menos de um segundo. Isto
         * aqui é só o conserto de quem ficou sem ele.
         */
        const varredura = setInterval(contar, 60000)

        return () => {
            cancelado = true

            if (agendado) clearTimeout(agendado)

            clearInterval(varredura)

            fechar()
        }
    }, [noPainel, pathname])

    // O seletor de lojas.
    //
    // Só carrega quando o menu traz "lojas" — que é a tela do dono. Para o
    // funcionário a lista nem é pedida: a rota recusaria de todo jeito, e uma
    // requisição que se sabe que vai levar 403 é ruído no log.
    //
    // Uma vez por sessão de painel, e não a cada tela: a lista de lojas de uma
    // conta muda uma vez por ano.
    useEffect(() => {

        if (!noPainel || !menu.some((item) => item.chave === "lojas" && item.liberado)) return

        let cancelado = false

        consultarRede()
            .then((rede) => {
                if (!cancelado) setMinhasLojas(rede.lojas.filter((uma) => uma.ativa))
            })
            .catch(() => {
                // Sem a lista o seletor some, e o painel continua na loja em
                // que já estava. É degradação aceitável; travar a barra
                // superior por causa dela não seria.
                if (!cancelado) setMinhasLojas([])
            })

        return () => {
            cancelado = true
        }
    }, [noPainel, menu])

    async function abrirOutraLoja(loja: LojaDaRede) {

        if (loja.aberta) {
            setLojasAberto(false)
            return
        }

        setTrocando(loja.id)

        try {
            await trocarDeLoja(loja.id)

            // Recarga DURA: metade do painel é montada no servidor, e uma
            // navegação do Next reaproveitaria o que já está em memória — as
            // telas continuariam mostrando a loja anterior.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign("/page/inicio")
        } catch {
            setTrocando(0)
            setLojasAberto(false)
        }
    }

    const lojaAberta = minhasLojas.find((uma) => uma.aberta)

    // Se esta loja tem a conversa da equipe, e se ESTA pessoa a recebeu.
    //
    // Sai do mesmo menu que o servidor já respondeu, e não de uma lista fixa
    // aqui: quem decide o que existe e o que este funcionário pode abrir é o
    // backend (ver internal/services/assinatura/recursos.go), e um ícone fixo
    // na barra ofereceria a quem não tem a permissão uma tela que a API
    // recusaria.
    const itemDoChat = menu.find((item) => item.chave === "equipe-chat" && item.liberado)
    const temChat = itemDoChat !== undefined

    // A bolinha do ícone de conversa. Recarrega ao mudar de tela e a cada
    // aviso do canal ao vivo da loja — é o mesmo socket que já traz pedido
    // novo e mensagem de cliente, e abrir um segundo só para isto dobraria as
    // conexões de cada aba aberta.
    //
    // Falha em silêncio: o ícone sem bolinha é aceitável, uma barra superior
    // que não desenha porque a contagem não veio não é.
    useEffect(() => {

        if (!noPainel || !temChat) return

        let cancelado = false

        async function contar() {
            try {
                const estado = await consultarEquipeChat()

                if (cancelado) return

                setNaoLidas(
                    (estado.salas ?? []).reduce((soma, sala) => soma + sala.nao_lidas, 0)
                )
            } catch {
                if (!cancelado) setNaoLidas(0)
            }
        }

        contar()

        const fechar = escutarLoja((aviso) => {
            if (aviso.tipo === "equipe") contar()
        })

        return () => {
            cancelado = true
            fechar()
        }
    }, [noPainel, temChat, pathname])

    // O painel administrativo só faz sentido dentro de /page/*.
    // As páginas públicas (landing "/", login e cadastro) não exibem o menu.
    if (!noPainel) {
        return null
    }

    async function handleSair() {
        setSaindo(true)
        setErroSaida("")

        try {
            await logout()
            router.push("/login")

        } catch (e) {
            // Não navega: o cookie desta aba já foi apagado, mas o servidor
            // não conseguiu invalidar o token, que continua valendo em
            // qualquer cópia que exista. Mostrar a tela de login aqui seria
            // dizer que saiu — justamente a única coisa que não aconteceu.
            setErroSaida(e instanceof Error ? e.message : "Não foi possível encerrar a sessão.")
            setSaindo(false)
        }
    }

    function itemAtivo(href: string) {
        return href !== "" && href === rotaAtiva
    }

    /**
     * Para onde este item leva de fato.
     *
     * Tela suspensa manda para onde se resolve o motivo — e o motivo decide
     * qual é esse lugar: pagamento e plano se resolvem na assinatura, mas o
     * layout se resolve trocando de loja, então o caminho é a tela das lojas.
     */
    function destinoDe(item: ItemMenu) {

        if (item.liberado) return item.rota

        return item.motivo === "so_matriz" ? "/page/lojas" : "/page/assinatura"
    }

    // Um item do menu, seja de primeiro nível ou dentro de um acordeão.
    //
    // O item aceso é uma pastilha BRANCA sobre o cinza da barra, e não um
    // bloco de cor: no cinza da moldura, o branco é a superfície de quem está
    // à frente. É assim que o painel do Shopify diz "você está aqui" sem
    // gastar a cor de marca — que fica reservada para o que é clicável dentro
    // da tela de trabalho.
    /**
     * Uma tela do menu.
     *
     * `somar` é o que está pendurado nos filhos dela e não está à vista —
     * acordeão fechado esconde o número do filho, e um pai sem essa soma
     * mostraria menos do que há. Com ele aberto vale zero: o número já está
     * escrito na linha de baixo, e repeti-lo no pai faria a mesma coisa ser
     * contada duas vezes pelo olho de quem lê.
     */
    function linkDoItem(item: ItemMenu, somar = 0) {

        const Icone = ICONES[item.chave] ?? FiHome
        const ativo = itemAtivo(item.rota)
        const esperando = contagemDoItem(item.chave) + somar

        // Tela que não abre agora: continua à vista, em cinza e com cadeado, e
        // leva para onde se resolve isso — que é a mesma tela nos dois casos,
        // ainda que por motivos diferentes.
        //
        // Ficar à vista é deliberado no caso do Pro: é assim que o lojista
        // descobre que a conversa da equipe e as várias lojas existem. Um menu
        // que esconde o que ele não assinou vende o Pro só para quem já foi
        // procurar a tela de assinatura.
        if (!item.liberado) {
            return (
                <Link
                    href="/page/assinatura"
                    onClick={() => setAberto(false)}
                    title={
                        item.motivo === "plano_pro"
                            ? `${item.nome} faz parte do plano Pro — veja o que ele inclui`
                            : item.motivo === "so_matriz"
                                ? `${item.nome} é do dono, na loja principal: a cara do site é da rede e cada loja a herda`
                                : "Assinatura pendente — regularize para liberar esta tela"
                    }
                    className="flex items-center gap-3 border-l-2 border-transparent py-2 pl-2.5 pr-3 text-[0.8125rem] font-medium text-[#B5B5B5] transition-colors hover:bg-[#F1F1F1]"
                >
                    <Icone className="w-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{item.nome}</span>
                    <FiLock className="w-3.5 shrink-0" aria-hidden />
                </Link>
            )
        }

        return (
            <Link
                href={item.rota}
                onClick={() => setAberto(false)}
                aria-current={ativo ? "page" : undefined}
                /* Como se marca "onde estou": fio azul na borda esquerda e
                   fundo azul fraco, com o canto reto do resto do sistema.
                   
                   Aqui havia uma pílula de canto totalmente arredondado. Ela
                   saiu por dois motivos que são o mesmo: o painel zerou a
                   escala de raio inteira (ver --radius-* em globals.css, onde
                   `rounded-full` fica reservado ao que é círculo por natureza
                   — a bolinha de não lidas, a foto da conta), e cápsula
                   colorida em item de menu é a assinatura visual de painel
                   gerado por template. O fio faz o mesmo trabalho sem inventar
                   forma nova: ele começa na margem da lista, marca a linha
                   inteira e sai do caminho — em vez de uma cápsula colorida
                   flutuando no meio do menu.
                   
                   O fio é transparente no item inativo, e não ausente: assim
                   o texto de todos os itens começa na mesma coluna, e a linha
                   não pula para o lado quando a tela muda. Cor de fundo fraca
                   e texto forte, e não o contrário — o item ativo não precisa
                   gritar, precisa ser o único colorido. */
                className={`flex items-center gap-3 border-l-2 py-2 pl-2.5 pr-3 text-[0.8125rem] transition-colors ${
                    ativo
                        ? "border-[#005BD3] bg-[#EAF4FF] font-semibold text-[#005BD3]"
                        : "border-transparent font-medium text-[#303030] hover:bg-[#F1F1F1]"
                }`}
            >
                <Icone
                    className={`w-4 shrink-0 ${ativo ? "text-[#005BD3]" : "text-[#616161]"}`}
                    aria-hidden
                />

                <span className="truncate">{item.nome}</span>

                {/* O número do que espera nesta tela. Encostado à direita, e
                    não colado no nome: assim os contadores de todas as linhas
                    ficam na mesma coluna e se leem de cima a baixo, em vez de
                    dançar conforme o tamanho de cada palavra. */}
                {esperando > 0 && (
                    <span
                        className="num ml-auto shrink-0 rounded-full bg-[#E51C00] px-1.5 text-[0.6875rem] font-bold leading-[1.05rem] text-white"
                        aria-label={`${esperando} esperando`}
                    >
                        {esperando > 99 ? "99+" : esperando}
                    </span>
                )}
            </Link>
        )
    }

    /* A lista de telas de UMA área, com os acordeões de quem tem filhos.
       Serve o painel do desktop e a gaveta do celular. */
    function listaDeNos(nos: No[]) {
        return nos.map((no) => {

            // Sem filhos é um link e pronto — o acordeão só existe onde há o
            // que abrir.
            if (no.filhos.length === 0) {
                return <div key={no.item.chave}>{linkDoItem(no.item)}</div>
            }

            const naArvore =
                itemAtivo(no.item.rota) ||
                no.filhos.some((filho) => itemAtivo(filho.rota))

            const grupoAberto = acordeoes[no.item.chave] ?? naArvore

            return (
                <div key={no.item.chave}>

                    <div className="flex items-center gap-0.5">

                        <div className="min-w-0 flex-1">
                            {linkDoItem(
                                no.item,
                                grupoAberto
                                    ? 0
                                    : no.filhos.reduce((soma, filho) => soma + contagemDoItem(filho.chave), 0),
                            )}
                        </div>

                        {/* A seta abre e fecha; o nome ao lado continua
                            levando para a tela. Juntar as duas coisas no
                            mesmo clique faria o lojista navegar sem querer
                            toda vez que quisesse só espiar o que tem
                            dentro. */}
                        <button
                            type="button"
                            onClick={() =>
                                setAcordeoes((atual) => ({
                                    ...atual,
                                    [no.item.chave]: !grupoAberto,
                                }))
                            }
                            aria-expanded={grupoAberto}
                            aria-label={`${grupoAberto ? "Fechar" : "Abrir"} ${no.item.nome}`}
                            className="shrink-0 p-1.5 text-[#616161] transition-colors hover:bg-[#F1F1F1] hover:text-[#303030]"
                        >
                            <FiChevronDown
                                className={`w-3.5 transition-transform ${grupoAberto ? "" : "-rotate-90"}`}
                                aria-hidden
                            />
                        </button>

                    </div>

                    {grupoAberto && (
                        <div className="ml-[1.35rem] space-y-0.5 border-l border-[#E1E1E1] pl-2">
                            {no.filhos.map((filho) => (
                                <div key={filho.chave}>{linkDoItem(filho)}</div>
                            ))}
                        </div>
                    )}

                </div>
            )
        })
    }

    /* ==================================================================
       O PAINEL — as telas da área aberta

       Uma área por vez, e não as quatro empilhadas. O que estava aqui
       era a lista inteira com sete seções: vinte linhas para rolar, e o
       olho perdendo onde "Vendas" acabava e "Estoque" começava. Agora a
       área escolhida é a única na tela, e a troca de área é o trilho ao
       lado.
       ================================================================== */
    const painelDaArea = (
        <>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#EBEBEB] px-3 py-2.5">
                <p className="truncate text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                    {areaVisivel?.titulo ?? "Painel"}
                </p>

                {/* Recolher some com o painel e deixa só o trilho. É o que
                    dá 224px à tabela nas telas de estoque, que são as que de
                    fato ficam sem largura.

                    A escolha vale enquanto a janela estiver aberta: o menu é
                    montado uma vez pela moldura e sobrevive à troca de tela,
                    então recolher uma vez basta para a sessão inteira.
                    Guardá-la no navegador exigiria ler o disco antes do
                    primeiro desenho, senão o painel abriria e fecharia na
                    cara de quem recarrega — máquina demais para uma
                    preferência que se refaz num clique. */}
                <button
                    type="button"
                    onClick={() => setPainelRecolhido(true)}
                    aria-label="Recolher o menu"
                    title="Recolher o menu"
                    className="hidden shrink-0 p-1 text-[#8A8A8A] transition-colors hover:bg-[#F1F1F1] hover:text-[#303030] md:block"
                >
                    <FiChevronsLeft className="w-4" aria-hidden />
                </button>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
                {carregando && (
                    <p className="px-2.5 py-1.5 text-[0.8125rem] text-[#8A8A8A]">
                        Carregando menu...
                    </p>
                )}

                {areaVisivel && listaDeNos(semAtalhos(areaVisivel.nos, chavesNoTrilho))}
            </nav>
        </>
    )

    /* No celular não há trilho: a gaveta mostra tudo de uma vez, com o
       título de cada área como separador. Tela pequena não comporta duas
       colunas de navegação, e esconder área atrás de ícone de 64px seria
       pior do que a lista. */
    const gavetaDoCelular = (
        <nav className="flex-1 overflow-y-auto px-3 py-4">
            {carregando && (
                <p className="px-2.5 py-1.5 text-[0.8125rem] text-[#8A8A8A]">
                    Carregando menu...
                </p>
            )}

            {secoes.map((secao) => (
                <div
                    key={secao.titulo}
                    className="mb-4 space-y-0.5 border-t border-[#EBEBEB] pt-4 first:border-t-0 first:pt-0 last:mb-0"
                >
                    <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                        {secao.titulo}
                    </p>

                    {listaDeNos(secao.nos)}
                </div>
            ))}
        </nav>
    )


    return (
        <>
            {/* ==============================================================
                BARRA SUPERIOR
                Escura e de largura inteira, como a do painel do Shopify. Ela
                tira a marca e a busca de dentro da área de trabalho: o cinza
                começa embaixo dela, e a tela do lojista fica só com o que é
                daquela tela.
                ============================================================== */}
            <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b border-[#E1E1E1] bg-white px-3 print:hidden">

                {/* Marca. No desktop ela ocupa a largura da barra lateral, de
                    modo que o começo da busca cai exatamente onde começa o
                    conteúdo da tela. */}
                <div className="flex items-center gap-2 md:w-[var(--menu)] md:shrink-0 md:pl-2">
                    <button
                        type="button"
                        onClick={() => setAberto((v) => !v)}
                        aria-label={aberto ? "Fechar menu" : "Abrir menu"}
                        aria-expanded={aberto}
                        className="-ml-1 p-2 text-[#616161] transition-colors hover:bg-[#F1F1F1] md:hidden"
                    >
                        {aberto ? <FiX className="w-5" aria-hidden /> : <FiMenu className="w-5" aria-hidden />}
                    </button>

                    <Link href="/page/produtos" className="flex items-center gap-2 text-[#303030]">
                        <Simbolo className="w-5 shrink-0" />
                        <span className="font-display text-[0.9375rem] tracking-normal">
                            {MARCA}
                        </span>
                    </Link>
                </div>

                {/* Busca de tela. Não é enfeite: procura entre as telas que
                    este lojista tem e leva para a que ele escolher. Um campo
                    de busca que não busca nada é a primeira coisa que faz um
                    painel parecer maquete. */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault()

                        const primeiro = achados[0]

                        if (!primeiro) return

                        router.push(destinoDe(primeiro))
                        setBusca("")
                        campoBusca.current?.blur()
                    }}
                    className="relative mx-auto hidden w-full max-w-md sm:block"
                >
                    <FiSearch
                        className="pointer-events-none absolute left-4 top-1/2 w-4 -translate-y-1/2 text-[#616161]"
                        aria-hidden
                    />

                    <input
                        ref={campoBusca}
                        type="search"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        onFocus={() => setBuscaFocada(true)}
                        // O clique num resultado precisa acontecer antes do
                        // fechamento, senão a lista some debaixo do dedo.
                        onBlur={() => setTimeout(() => setBuscaFocada(false), 120)}
                        placeholder="Buscar tela do painel"
                        aria-label="Buscar tela do painel"
                        className="w-full border border-transparent bg-[#F1F1F1] py-2 pl-11 pr-4 text-[0.8125rem] text-[#303030] placeholder:text-[#616161] focus:border-[#005BD3] focus:bg-white focus:outline-none"
                    />

                    {buscaFocada && busca.trim().length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 overflow-hidden border border-[#E1E1E1] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]">

                            {achados.length === 0 && (
                                <p className="px-3 py-3 text-[0.8125rem] text-[#616161]">
                                    Nenhuma tela com esse nome.
                                </p>
                            )}

                            {achados.map((item) => {
                                const Icone = ICONES[item.chave] ?? FiHome

                                return (
                                    <Link
                                        key={item.chave}
                                        href={destinoDe(item)}
                                        onClick={() => setBusca("")}
                                        className="flex items-center gap-3 px-3 py-2 text-[0.8125rem] text-[#303030] transition-colors hover:bg-[#F7F7F7]"
                                    >
                                        <Icone className="w-4 shrink-0 text-[#8A8A8A]" aria-hidden />

                                        <span className="flex-1 truncate font-medium">
                                            {item.nome}
                                        </span>

                                        {item.liberado ? (
                                            <span className="shrink-0 text-[0.6875rem] uppercase tracking-[0.06em] text-[#8A8A8A]">
                                                {item.secao}
                                            </span>
                                        ) : (
                                            <FiLock className="w-3.5 shrink-0 text-[#B5B5B5]" aria-hidden />
                                        )}
                                    </Link>
                                )
                            })}

                        </div>
                    )}
                </form>

                    {/* O seletor de lojas.
                        
                        Só aparece com MAIS DE UMA: quem tem uma loja só não
                        tem escolha a fazer, e um seletor de um item é ruído no
                        lugar mais disputado da tela. */}
                    {minhasLojas.length > 1 && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setLojasAberto((v) => !v)}
                                aria-expanded={lojasAberto}
                                aria-haspopup="menu"
                                className="flex max-w-[11rem] items-center gap-1.5 px-3 py-1.5 text-[0.8125rem] text-[#303030] transition-colors hover:bg-[#F1F1F1]"
                            >
                                <FiHome className="w-4 shrink-0" aria-hidden />

                                <span className="hidden truncate text-[0.8125rem] font-medium sm:inline">
                                    {lojaAberta?.nome ?? "Loja"}
                                </span>

                                <FiChevronDown className="w-3.5 shrink-0 text-[#B5B5B5]" aria-hidden />
                            </button>

                            {lojasAberto && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setLojasAberto(false)} />

                                    <div
                                        role="menu"
                                        className="anim-surgir absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden border border-[#E1E1E1] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                                    >
                                        <p className="border-b border-[#EBEBEB] px-3 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                                            Trocar de loja
                                        </p>

                                        {minhasLojas.map((uma) => (
                                            <button
                                                key={uma.id}
                                                type="button"
                                                role="menuitem"
                                                onClick={() => abrirOutraLoja(uma)}
                                                disabled={trocando !== 0}
                                                className={`flex w-full items-center gap-2.5 border-b border-[#EBEBEB] px-3 py-2.5 text-left text-[0.8125rem] transition-colors last:border-b-0 hover:bg-[#F7F7F7] ${
                                                    uma.aberta ? "font-semibold text-[#303030]" : "text-[#616161]"
                                                }`}
                                            >
                                                <FiHome className="w-4 shrink-0 text-[#8A8A8A]" aria-hidden />

                                                <span className="min-w-0 flex-1 truncate">{uma.nome}</span>

                                                {uma.aberta && <FiCheck className="w-4 shrink-0 text-[#005BD3]" aria-hidden />}
                                                {trocando === uma.id && (
                                                    <span className="text-xs text-[#8A8A8A]">abrindo…</span>
                                                )}
                                            </button>
                                        ))}

                                        <Link
                                            href="/page/lojas"
                                            role="menuitem"
                                            onClick={() => setLojasAberto(false)}
                                            className="flex items-center gap-2.5 border-t border-[#EBEBEB] bg-[#F7F7F7] px-3 py-2 text-[0.8125rem] font-medium text-[#005BD3] transition-colors hover:bg-[#EBEBEB]"
                                        >
                                            Gerenciar minhas lojas
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                {/* Conversa da equipe e chamada, à direita da busca.
                    Ficam na barra, e não só no menu, porque são o que se abre
                    NO MEIO de outra coisa: quem está conferindo uma remessa e
                    precisa perguntar algo ao colega não vai procurar a tela
                    numa lista — e a bolinha aqui é o único lugar onde uma
                    mensagem consegue chamar atenção de quem está noutra tela.

                    Só aparecem para quem tem a conversa liberada; quem decide
                    isso é o servidor, no menu. */}
                <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">

                    {/* Voltar ao painel. Só dentro da conversa, e na barra —
                        ali o menu lateral do painel saiu de cena, e sem uma
                        saída no cromo a conversa vira um beco de onde só se
                        sai pelo botão do navegador. */}
                    {noChat && (
                        <Link
                            href="/page/inicio"
                            aria-label="Voltar ao painel"
                            title="Voltar ao painel"
                            className="p-2 text-[#616161] transition-colors hover:bg-[#F1F1F1] hover:text-[#303030]"
                        >
                            <FiArrowLeft className="w-5" aria-hidden />
                        </Link>
                    )}

                    {/* O sino: pedido novo e mensagem de cliente. Separado do
                        ícone da conversa interna de propósito — um é o
                        negócio batendo à porta, o outro é o colega chamando, e
                        somá-los num número só faria "3" não dizer nada sobre o
                        que fazer em seguida. */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setSinoAberto((v) => !v)}
                            aria-expanded={sinoAberto}
                            aria-haspopup="menu"
                            aria-label={
                                novidades.total > 0
                                    ? `Novidades, ${novidades.total} esperando`
                                    : "Novidades"
                            }
                            className="relative p-2 text-[#616161] transition-colors hover:bg-[#F1F1F1] hover:text-[#303030]"
                        >
                            <FiBell className="w-5" aria-hidden />

                            {novidades.total > 0 && (
                                <span className="num absolute -right-0.5 -top-0.5 min-w-[1.05rem] rounded-full bg-[#E51C00] px-1 text-center text-[0.625rem] font-bold leading-[1.05rem] text-white">
                                    {novidades.total > 99 ? "99+" : novidades.total}
                                </span>
                            )}
                        </button>

                        {sinoAberto && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setSinoAberto(false)} />

                                <div
                                    role="menu"
                                    className="anim-surgir absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden border border-[#E1E1E1] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                                >
                                    <p className="border-b border-[#EBEBEB] px-3 py-2.5 text-[0.8125rem] font-semibold text-[#303030]">
                                        {novidades.total > 0 ? "Esperando você" : "Nada esperando"}
                                    </p>

                                    {novidades.total === 0 ? (
                                        <p className="px-3 py-3 text-[0.8125rem] text-[#8A8A8A]">
                                            Nenhum pedido novo e nenhuma mensagem de cliente por ler.
                                        </p>
                                    ) : (
                                        <>
                                            <Novidade
                                                href="/page/pedidos"
                                                Icone={FiShoppingCart}
                                                rotulo="Pedidos novos"
                                                quantos={novidades.pedidos}
                                                aoIr={() => setSinoAberto(false)}
                                            />

                                            <Novidade
                                                href="/page/conversas"
                                                Icone={FiSmartphone}
                                                rotulo="WhatsApp"
                                                quantos={novidades.whatsapp}
                                                aoIr={() => setSinoAberto(false)}
                                            />

                                            <Novidade
                                                href="/page/atendimento"
                                                Icone={FiMessageSquare}
                                                rotulo="Chat do site"
                                                quantos={novidades.site}
                                                aoIr={() => setSinoAberto(false)}
                                            />
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                {temChat && (
                    <>

                        {/* A porta da conversa saiu daqui e foi para o pé do
                            trilho, junto do resto da navegação. Ela ficava
                            nesta barra quando o menu lateral era uma lista só
                            de telas; agora que o trilho é o lugar de "para
                            onde eu vou", ter as duas seria a mesma tela com
                            dois botões — e o ícone da barra era o que menos
                            dizia onde a conversa ia abrir.

                            O da chamada fica: chamar não é ir para a tela, é
                            começar uma coisa. Ele abre na conversa porque
                            para chamar é preciso dizer QUEM, e quem é a lista
                            de lá — um botão de chamada que abrisse uma
                            chamada com ninguém seria um botão que não faz
                            nada. */}
                        <Link
                            href="/page/equipe?chamada=1"
                            aria-label="Chamada de vídeo com a equipe"
                            className="p-2 text-[#616161] transition-colors hover:bg-[#F1F1F1] hover:text-[#303030]"
                        >
                            <FiVideo className="w-5" aria-hidden />
                        </Link>
                    </>
                )}
                </div>

                {/* Conta. É daqui que se sai do sistema — e só daqui, para não
                    haver duas portas para a mesma coisa. */}
                <div className="relative md:ml-0">
                    <button
                        type="button"
                        onClick={() => setContaAberta((v) => !v)}
                        aria-expanded={contaAberta}
                        aria-haspopup="menu"
                        className="flex items-center gap-2 py-1 pl-1 pr-2 text-[#303030] transition-colors hover:bg-[#F1F1F1]"
                    >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#303030] text-[0.6875rem] font-semibold text-white">
                            AD
                        </span>
                        <span className="hidden text-[0.8125rem] font-medium lg:inline">
                            Administrador
                        </span>
                        <FiChevronDown className="hidden w-3.5 text-[#616161] lg:inline" aria-hidden />
                    </button>

                    {contaAberta && (
                        <>
                            {/* Clique fora fecha. */}
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setContaAberta(false)}
                            />

                            <div
                                role="menu"
                                className="absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden border border-[#E1E1E1] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                            >
                                <div className="border-b border-[#EBEBEB] px-3 py-2.5">
                                    <p className="text-[0.8125rem] font-semibold text-[#303030]">
                                        Administrador
                                    </p>
                                    <p className="text-xs text-[#8A8A8A]">
                                        Loja única
                                    </p>
                                </div>

                                <Link
                                    href="/page/assinatura"
                                    role="menuitem"
                                    onClick={() => setContaAberta(false)}
                                    className="flex items-center gap-2.5 px-3 py-2 text-[0.8125rem] font-medium text-[#303030] transition-colors hover:bg-[#F7F7F7]"
                                >
                                    <FiCreditCard className="w-4 shrink-0 text-[#8A8A8A]" aria-hidden />
                                    Assinatura
                                </Link>

                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={handleSair}
                                    disabled={saindo}
                                    className="flex w-full items-center gap-2.5 border-t border-[#EBEBEB] px-3 py-2 text-left text-[0.8125rem] font-medium text-[#8E1F0B] transition-colors hover:bg-[#FEE9E8] disabled:opacity-50"
                                >
                                    <FiLogOut className="w-4 shrink-0" aria-hidden />
                                    {saindo ? "Saindo..." : "Sair"}
                                </button>

                                {erroSaida && (
                                    <p role="alert" className="border-t border-[#EBEBEB] px-3 py-2 text-xs font-medium text-[#8E1F0B]">
                                        {erroSaida}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>

            </header>

            {/* ==============================================================
                NAVEGAÇÃO — desktop: TRILHO + PAINEL

                Duas peças, e não uma barra só. O trilho escuro de 64px
                guarda as ÁREAS da loja e nunca sai da tela; o painel claro
                ao lado mostra só as telas da área aberta.

                É a anatomia do Slack e do Teams, e ela entrou no lugar da
                barra branca de 256px com quatro seções empilhadas — que é,
                letra por letra, o mesmo menu de Linear, Stripe, Vercel e
                Shopify. Um painel de loja não precisa ser reconhecível como
                "mais um SaaS"; precisa ser reconhecível como o seu.

                O que a troca resolve, além da cara: a lista deixou de rolar.
                Eram vinte linhas e quatro títulos numa coluna só; agora a
                área escolhida é a única na tela, e trocar de área é um
                clique no trilho — que mostra, de relance, onde há coisa
                esperando (a bolinha).
                ============================================================== */}
            <aside
                    style={{ top: ALTURA_TOPO, height: `calc(100dvh - ${ALTURA_TOPO})` }}
                    className="fixed left-0 z-30 hidden w-[var(--trilho)] flex-col border-r border-[#333333] bg-[#1A1A1A] py-2 md:flex print:hidden"
                >
                    {secoes.map((secao) => {

                        const Icone = ICONE_DA_AREA[comparavel(secao.titulo)] ?? FiGrid
                        // Numa tela de atalho nenhuma área fica acesa: quem
                        // marca onde a pessoa está é o próprio atalho. Sem
                        // isto, "Conta" acendia junto — é lá que a conversa e
                        // as lojas moram no catálogo do servidor — e o trilho
                        // apontava dois lugares ao mesmo tempo.
                        const ativa = !numAtalho && secao.titulo === (areaVisivel?.titulo ?? "")
                        const esperando = contagemDaArea(secao)

                        // A primeira tela liberada da área. É para onde o
                        // clique leva — abrir o painel sem sair do lugar
                        // faria o caminho ter dois cliques onde tinha um.
                        const porta = secao.nos.find((no) => no.item.liberado)?.item

                        return (
                            <button
                                key={secao.titulo}
                                type="button"
                                onClick={() => {
                                    setArea({ titulo: secao.titulo, rota: porta?.rota ?? rotaAtiva })
                                    setPainelRecolhido(false)

                                    if (porta && porta.rota !== rotaAtiva) router.push(porta.rota)
                                }}
                                aria-current={ativa ? "true" : undefined}
                                title={secao.titulo}
                                aria-label={
                                    esperando > 0
                                        ? `${secao.titulo}, ${esperando} esperando`
                                        : secao.titulo
                                }
                                className={`relative flex w-full flex-col items-center gap-1 px-1 py-2.5 transition-colors ${
                                    ativa ? "bg-[#303030] text-white" : "text-[#B5B5B5] hover:bg-[#242424] hover:text-white"
                                }`}
                            >
                                {/* O fio branco na borda marca a área aberta.
                                    Mesma gramática do fio azul do painel: a
                                    marca começa na margem e não inventa forma
                                    nova no meio do menu. */}
                                {ativa && (
                                    <span className="absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 bg-white" aria-hidden />
                                )}

                                <span className="relative">
                                    <Icone className="w-5" aria-hidden />

                                    {/* Quanta coisa espera aqui dentro.
                                        
                                        Era uma bolinha vermelha sem número:
                                        dizia que havia algo, e obrigava a
                                        entrar na área para descobrir o quê e
                                        quanto. Agora é o número — a mesma
                                        conta do sino, somada por área —, que é
                                        o que faz o lojista decidir se abre
                                        agora ou depois do café.
                                        
                                        Fica no trilho, e não só no painel,
                                        porque o painel daquela área pode estar
                                        fechado — e é justamente aí que o aviso
                                        precisa aparecer. */}
                                    {esperando > 0 && (
                                        <span className="num absolute -right-2 -top-1 min-w-[1rem] rounded-full border border-[#1A1A1A] bg-[#E51C00] px-1 text-center text-[0.5625rem] font-bold leading-[0.95rem] text-white">
                                            {esperando > 99 ? "99+" : esperando}
                                        </span>
                                    )}
                                </span>

                                <span className="w-full truncate px-0.5 text-center text-[0.625rem] font-semibold leading-tight">
                                    {ROTULO_DA_AREA[comparavel(secao.titulo)] ?? secao.titulo}
                                </span>
                            </button>
                        )
                    })}

                    {/* ------------------------------------------------------
                        OS ATALHOS

                        Abaixo do fio, o que não é área da loja: a conversa da
                        equipe e as lojas da rede. Ficam logo depois das
                        áreas, e não grudados no rodapé da janela, por dois
                        motivos — são tão usados quanto qualquer área, e
                        canto de tela é onde o olho não procura (e onde a
                        barra de ferramentas do navegador costuma cobrir).
                        ------------------------------------------------------ */}
                    {atalhos.length > 0 && (
                        <div className="mt-1 w-full border-t border-[#333333] pt-1">
                            {atalhos.map(({ chave, rotulo, Icone, rota }) => {

                                const aqui = itemAtivo(rota)

                                return (
                                    <Link
                                        key={chave}
                                        href={rota}
                                        aria-current={aqui ? "page" : undefined}
                                        title={rotulo}
                                        aria-label={
                                            chave === "equipe-chat" && naoLidas > 0
                                                ? `Conversa da equipe, ${naoLidas} não lidas`
                                                : rotulo
                                        }
                                        className={`relative flex w-full flex-col items-center gap-1 px-1 py-2.5 transition-colors ${
                                            aqui ? "bg-[#303030] text-white" : "text-[#B5B5B5] hover:bg-[#242424] hover:text-white"
                                        }`}
                                    >
                                        {aqui && (
                                            <span className="absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 bg-white" aria-hidden />
                                        )}

                                        <span className="relative">
                                            <Icone className="w-5" aria-hidden />

                                            {/* Na conversa, o NÚMERO, e não a
                                                bolinha das áreas: mensagem de
                                                gente tem quantidade, e "três"
                                                é uma decisão diferente de
                                                "trinta" para quem está no meio
                                                da conferência. */}
                                            {chave === "equipe-chat" && naoLidas > 0 && (
                                                <span className="num absolute -right-2 -top-1 min-w-[1rem] rounded-full border border-[#1A1A1A] bg-[#E51C00] px-1 text-center text-[0.5625rem] font-bold leading-[0.95rem] text-white">
                                                    {naoLidas > 99 ? "99+" : naoLidas}
                                                </span>
                                            )}
                                        </span>

                                        <span className="w-full truncate px-0.5 text-center text-[0.625rem] font-semibold leading-tight">
                                            {rotulo}
                                        </span>
                                    </Link>
                                )
                            })}
                        </div>
                    )}

                    {/* Reabrir o painel recolhido. É controle da moldura, não
                        um lugar para onde ir — por isso fica no pé, sem
                        rótulo e longe dos atalhos. */}
                    {painelRecolhido && (
                        <button
                            type="button"
                            onClick={() => setPainelRecolhido(false)}
                            aria-label="Abrir o menu"
                            title="Abrir o menu"
                            className="mt-auto flex w-full justify-center border-t border-[#333333] py-3 text-[#B5B5B5] transition-colors hover:bg-[#242424] hover:text-white"
                        >
                            <FiChevronsRight className="w-4" aria-hidden />
                        </button>
                    )}
            </aside>

            {/* O painel. Sai de cena na conversa da equipe, que desenha a
                própria coluna no mesmo lugar (ver page/equipe) — o trilho,
                esse, fica: é a navegação global, e sem ele a conversa vira um
                beco. */}
            {!noChat && !painelRecolhido && areaVisivel && (
                <aside
                    style={{ top: ALTURA_TOPO, height: `calc(100dvh - ${ALTURA_TOPO})` }}
                    className="fixed left-[var(--trilho)] z-30 hidden w-[var(--painel-menu)] flex-col border-r border-[#E1E1E1] bg-white md:flex print:hidden"
                >
                    {painelDaArea}
                </aside>
            )}

            {/* ==============================================================
                NAVEGAÇÃO — celular
                ============================================================== */}
            {aberto && !noChat && (
                <div
                    style={{ top: ALTURA_TOPO }}
                    className="fixed inset-x-0 bottom-0 z-40 md:hidden print:hidden"
                >
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setAberto(false)}
                    />

                    <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-[#E1E1E1] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
                        {gavetaDoCelular}
                    </aside>
                </div>
            )}
        </>
    )
}
