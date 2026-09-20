import {
    FiCheck,
    FiMapPin,
    FiMessageSquare,
    FiPackage,
    FiShoppingBag,
    FiTag,
    FiTruck,
    FiUsers,
} from "react-icons/fi"
import Preco from "@/app/components/preco/preco"

/**
 * As telas do sistema, desenhadas para a página de vendas.
 *
 * São mockups em HTML e CSS, e não fotografias, por três motivos que se
 * somam. O primeiro é honestidade: quem está decidindo assinar quer ver o
 * sistema, não uma loja bonita de banco de imagens — e o que convence numa
 * página de software é a tela dele. O segundo é a CSP do painel, que fecha
 * `img-src` em 'self': figura de servidor de terceiro simplesmente não
 * carrega, e afrouxar isso para enfeitar a página de vendas seria trocar uma
 * proteção real por uma imagem. O terceiro é que eles não quebram: não há
 * link para expirar, nem peso para baixar, e o texto dentro deles é lido por
 * leitor de tela como texto.
 *
 * Os números são de exemplo — e são plausíveis de propósito, não redondos:
 * "R$ 1.284,50" é o que uma loja fatura num dia; "R$ 10.000,00" é o que uma
 * página de vendas inventa.
 *
 * Os PRODUTOS dos exemplos são de ramos diferentes de propósito — ventilador,
 * panela, fone, e vestuário no meio. O sistema serve loja de qualquer ramo, e
 * uma página inteira de camisa e vestido faria quem vende eletrodoméstico
 * concluir, em três segundos, que não é para ele.
 */

const CINZA = "#EBEBEB"

/* ==========================================================================
   O painel: o fechamento do dia e a equipe
   ========================================================================== */

export function MockupPainel() {
    return (
        <div className="card overflow-hidden">

            <div className="flex items-center justify-between border-b border-[#EBEBEB] bg-[#F7F7F7] px-4 py-2.5">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#8A8A8A]">
                    Início · fechamento de hoje
                </p>
                <span className="num text-[0.7rem] text-[#8A8A8A]">quinta, 12/06</span>
            </div>

            <div className="grid grid-cols-2 gap-px bg-[#EBEBEB]">
                {[
                    { rotulo: "Saiu no balcão", valor: "R$ 842,00", detalhe: "7 unidades", Icone: FiShoppingBag },
                    { rotulo: "Saiu por pedido", valor: "R$ 1.284,50", detalhe: "9 unidades", Icone: FiPackage },
                    { rotulo: "Pagamentos confirmados", valor: "R$ 1.109,40", detalhe: "6 pedidos", Icone: FiCheck },
                    { rotulo: "Ticket médio", valor: "R$ 184,90", detalhe: "por pedido pago", Icone: FiTag },
                ].map(({ rotulo, valor, detalhe, Icone }) => (
                    <div key={rotulo} className="bg-white p-4">
                        <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.06em] text-[#8A8A8A]">
                            <Icone className="w-3" aria-hidden />
                            {rotulo}
                        </p>
                        <p className="num mt-1.5 text-lg font-bold text-[#303030]">{valor}</p>
                        <p className="text-[0.7rem] text-[#8A8A8A]">{detalhe}</p>
                    </div>
                ))}
            </div>

            <div className="border-t border-[#EBEBEB] px-4 py-3">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#8A8A8A]">
                    Sua equipe neste mês
                </p>

                <table className="mt-2.5 w-full text-left text-xs">
                    <thead>
                        <tr className="text-[0.65rem] uppercase tracking-[0.06em] text-[#8A8A8A]">
                            <th className="pb-1.5 font-semibold">Pessoa</th>
                            <th className="pb-1.5 text-right font-semibold">Vendeu</th>
                            <th className="pb-1.5 text-right font-semibold">Atendeu</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-[#F1F1F1]">
                        {[
                            ["Helena", "R$ 8.410,00", "34"],
                            ["Marcos", "R$ 6.129,90", "21"],
                            ["Dona Rita", "R$ 4.870,50", "12"],
                        ].map(([nome, vendeu, atendeu]) => (
                            <tr key={nome}>
                                <td className="py-1.5">
                                    <span className="flex items-center gap-1.5 font-medium text-[#303030]">
                                        <FiUsers className="w-3 text-[#B5B5B5]" aria-hidden />
                                        {nome}
                                    </span>
                                </td>
                                <td className="num py-1.5 text-right font-semibold text-[#303030]">{vendeu}</td>
                                <td className="num py-1.5 text-right text-[#616161]">{atendeu}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
    )
}

/* ==========================================================================
   A agenda de entregas
   ========================================================================== */

export function MockupAgenda() {

    const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

    // Onde cai cada pedido na semana desenhada. Duas terças cheias e uma
    // quinta vazia é o retrato que a tela existe para dar.
    const semana: { dia: number; pedidos: { nome: string; tipo: "entrega" | "retirada" }[] }[] = [
        { dia: 9, pedidos: [] },
        { dia: 10, pedidos: [{ nome: "Ana P.", tipo: "entrega" }] },
        { dia: 11, pedidos: [{ nome: "Carlos M.", tipo: "entrega" }, { nome: "Júlia", tipo: "retirada" }] },
        { dia: 12, pedidos: [{ nome: "Rafael", tipo: "entrega" }] },
        { dia: 13, pedidos: [] },
        { dia: 14, pedidos: [{ nome: "Bia", tipo: "retirada" }, { nome: "Ed. Silva", tipo: "entrega" }] },
        { dia: 15, pedidos: [] },
    ]

    return (
        <div className="card overflow-hidden">

            <div className="flex items-center justify-between border-b border-[#EBEBEB] bg-[#F7F7F7] px-4 py-2.5">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#8A8A8A]">
                    Agenda de entregas
                </p>
                <span className="text-[0.7rem] text-[#8A8A8A]">junho</span>
            </div>

            <div className="grid grid-cols-7 border-b border-[#EBEBEB] bg-[#F7F7F7]">
                {dias.map((dia) => (
                    <div key={dia} className="py-1.5 text-center text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                        {dia}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7">
                {semana.map(({ dia, pedidos }) => (
                    <div
                        key={dia}
                        className={`min-h-[4.5rem] border-b border-r border-[#F1F1F1] p-1 ${dia === 12 ? "bg-[#EAF4FF]" : ""}`}
                    >
                        <p className={`num text-[0.65rem] ${dia === 12 ? "font-bold text-[#005BD3]" : "text-[#B5B5B5]"}`}>
                            {dia}
                        </p>

                        <div className="mt-1 space-y-1">
                            {pedidos.map((pedido) => (
                                <p
                                    key={pedido.nome}
                                    className={`truncate rounded px-1 py-0.5 text-[0.58rem] font-semibold ${
                                        pedido.tipo === "entrega"
                                            ? "bg-[#FFE4C4] text-[#5E4200]"
                                            : "bg-[#EAF4FF] text-[#00369B]"
                                    }`}
                                >
                                    {pedido.nome}
                                </p>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[0.65rem] text-[#616161]">
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-[#FFE4C4]" aria-hidden />
                    tem de sair neste dia
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-[#EAF4FF]" aria-hidden />
                    o cliente vem buscar
                </span>
            </div>

        </div>
    )
}

/* ==========================================================================
   O atendimento: a fila e a conversa
   ========================================================================== */

export function MockupAtendimento() {
    return (
        <div className="card grid overflow-hidden sm:grid-cols-[11rem_1fr]">

            <div className="border-b border-[#EBEBEB] sm:border-b-0 sm:border-r">
                <p className="bg-[#FFF1E3] px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.06em] text-[#5E4200]">
                    Na fila · 2
                </p>

                {[
                    ["Camila", "tem no 42?"],
                    ["Joana", "chega até sexta?"],
                ].map(([nome, fala]) => (
                    <div key={nome} className="border-b border-[#F1F1F1] px-3 py-2">
                        <p className="truncate text-xs font-semibold text-[#303030]">{nome}</p>
                        <p className="truncate text-[0.65rem] text-[#8A8A8A]">{fala}</p>
                    </div>
                ))}

                <p className="bg-[#F7F7F7] px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.06em] text-[#616161]">
                    Em atendimento · 1
                </p>

                <div className="bg-[#EAF4FF] px-3 py-2">
                    <p className="truncate text-xs font-semibold text-[#303030]">Paulo R.</p>
                    <p className="truncate text-[0.65rem] text-[#616161]">Helena · atendendo</p>
                </div>
            </div>

            <div className="flex min-h-[11rem] flex-col">
                <div className="flex items-center justify-between gap-2 border-b border-[#EBEBEB] bg-[#F7F7F7] px-3 py-2">
                    <p className="text-xs font-semibold text-[#303030]">Paulo R.</p>
                    <span className="rounded bg-white px-2 py-0.5 text-[0.6rem] font-semibold text-[#616161]">
                        encerrar
                    </span>
                </div>

                <div className="flex-1 space-y-2 p-3">
                    <p className="max-w-[80%] rounded-lg bg-[#F1F1F1] px-2.5 py-1.5 text-[0.68rem] leading-relaxed text-[#303030]">
                        Boa tarde! O ventilador de teto ainda tem em 220V?
                    </p>

                    <p className="ml-auto max-w-[80%] rounded-lg bg-[#005BD3] px-2.5 py-1.5 text-[0.68rem] leading-relaxed text-white">
                        Tem sim, Paulo — última unidade. Separo para você?
                    </p>

                    <p className="text-right text-[0.58rem] text-[#8A8A8A]">Helena · 14:32</p>
                </div>

                <div className="flex items-center gap-2 border-t border-[#EBEBEB] p-2">
                    <span className="h-6 flex-1 rounded border border-[#E1E1E1]" aria-hidden />
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-[#005BD3]" aria-hidden>
                        <FiMessageSquare className="w-3 text-white" />
                    </span>
                </div>
            </div>

        </div>
    )
}

/* ==========================================================================
   A vitrine, na tela do cliente
   ========================================================================== */

export function MockupVitrine() {
    return (
        <div className="card overflow-hidden">

            <div className="flex items-center justify-between border-b border-[#EBEBEB] px-4 py-2.5">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[#303030]">
                    Maria Modas
                </p>
                <span className="h-4 w-16 rounded" style={{ background: CINZA }} aria-hidden />
            </div>

            <div className="flex h-16 items-center justify-center bg-[#303030] text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/70">
                banner da loja
            </div>

            <div className="flex gap-3 px-4 py-3">
                {["Eletro", "Casa", "Ferramentas", "Vestuário"].map((categoria) => (
                    <span key={categoria} className="flex flex-col items-center gap-1">
                        <span className="h-8 w-8 rounded-full" style={{ background: CINZA }} aria-hidden />
                        <span className="text-[0.55rem] text-[#616161]">{categoria}</span>
                    </span>
                ))}
            </div>

            <div className="px-4 pb-4">
                <p className="text-xs font-bold text-[#303030]">Ofertas do dia</p>

                <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                        { nome: "Ventilador de teto", preco: 229.9, antigo: 299.9 },
                        { nome: "Jogo de panelas", preco: 189.9, antigo: 249.9 },
                        { nome: "Fone bluetooth", preco: 129.9, antigo: 0 },
                    ].map((produto) => (
                        <div key={produto.nome} className="min-w-0">
                            <span className="block aspect-[3/4] rounded" style={{ background: CINZA }} aria-hidden />
                            <p className="mt-1 truncate text-[0.6rem] text-[#303030]">{produto.nome}</p>
                            <Preco
                                valor={produto.preco}
                                valorAntigo={produto.antigo || undefined}
                                className="text-[0.7rem]"
                            />
                        </div>
                    ))}
                </div>
            </div>

        </div>
    )
}

/* ==========================================================================
   A etiqueta da unidade — o objeto concreto que o sistema produz
   ========================================================================== */

/** Larguras das barras. Índice par é barra; ímpar, espaço. */
const BARRAS = [
    3, 2, 1, 2, 4, 1, 2, 3, 1, 1, 2, 2, 3, 1, 1, 4, 2, 1, 3, 2, 1, 1, 4, 2,
    2, 3, 1, 2, 1, 1, 3, 2, 4, 1, 2, 2, 1, 3, 2, 1, 1, 2, 3, 4, 1, 2, 2, 1,
]

export function MockupEtiqueta() {
    return (
        <div className="card p-5 sm:p-6">

            <div className="flex items-center justify-between gap-3 border-b border-[#EBEBEB] pb-4">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#8A8A8A]">
                    Etiqueta da unidade
                </p>
                <span className="tag tag-success">
                    <FiCheck className="w-3" aria-hidden />
                    Em estoque
                </span>
            </div>

            <div className="pt-4">
                <p className="font-display text-lg text-[#303030]">
                    Ventilador de teto 3 pás
                </p>

                <p className="mt-1 text-sm text-[#616161]">
                    Branco · Voltagem 220V · Controle remoto
                </p>

                <div className="mt-5 rounded-lg border border-[#EBEBEB] bg-white p-4">
                    <div className="flex h-16 items-stretch gap-0 overflow-hidden" aria-hidden>
                        {BARRAS.map((largura, i) => (
                            <span
                                key={i}
                                style={{ width: `${largura * 3}px` }}
                                className={i % 2 === 0 ? "bg-[#303030]" : "bg-transparent"}
                            />
                        ))}
                    </div>

                    <p className="mt-3 text-center font-mono text-sm tracking-[0.25em] text-[#303030]">
                        000618-1
                    </p>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                        <dt className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#8A8A8A]">
                            Localização
                        </dt>
                        <dd className="num mt-1 flex items-center gap-1.5 text-sm font-bold text-[#303030]">
                            <FiMapPin className="w-4 text-[#616161]" aria-hidden />
                            001.005.01.A
                        </dd>
                    </div>

                    <div>
                        <dt className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#8A8A8A]">
                            Preço
                        </dt>
                        <dd className="mt-1">
                            <Preco valor={189.9} valorAntigo={249.9} className="text-xl" />
                        </dd>
                    </div>
                </dl>
            </div>

        </div>
    )
}

/* ==========================================================================
   O comprovante que o cliente recebe
   ========================================================================== */

export function MockupComprovante() {
    return (
        <div className="card p-5 text-[#303030]">

            <div className="flex items-start justify-between gap-4 border-b-2 border-[#303030] pb-2">
                <div>
                    <p className="text-[0.8rem] font-bold uppercase tracking-[0.06em]">Maria Modas</p>
                    <p className="num text-[0.6rem] text-[#616161]">CNPJ 00.000.000/0001-00</p>
                </div>

                <div className="text-right">
                    <p className="text-[0.55rem] font-bold uppercase tracking-[0.1em] text-[#8A8A8A]">
                        Comprovante de pedido
                    </p>
                    <p className="num text-base font-bold leading-none tracking-[0.1em]">905014</p>
                </div>
            </div>

            <table className="mt-3 w-full text-left text-[0.62rem]">
                <thead>
                    <tr className="border-b border-[#B5B5B5] text-[0.55rem] uppercase tracking-[0.06em] text-[#8A8A8A]">
                        <th className="py-1 font-bold">Produto</th>
                        <th className="py-1 text-right font-bold">Qtd</th>
                        <th className="py-1 text-right font-bold">Total</th>
                    </tr>
                </thead>

                <tbody>
                    {[
                        ["Ventilador de teto — 220V", "1", "R$ 229,90"],
                        ["Fone bluetooth — Preto", "2", "R$ 259,80"],
                    ].map(([produto, qtd, total]) => (
                        <tr key={produto} className="border-b border-[#EBEBEB]">
                            <td className="py-1">{produto}</td>
                            <td className="num py-1 text-right">{qtd}</td>
                            <td className="num py-1 text-right">{total}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="mt-2 flex justify-between border-t-2 border-[#303030] pt-1.5 text-[0.75rem] font-bold">
                <span>Total</span>
                <span className="num">R$ 489,70</span>
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-[0.55rem] text-[#8A8A8A]">
                <FiTruck className="w-3" aria-hidden />
                Entrega · previsão de chegada em 18 de junho
            </p>

        </div>
    )
}

/* ==========================================================================
   A conversa da equipe — o que o plano Pro acrescenta
   ========================================================================== */

export function MockupEquipe() {
    return (
        <div className="card grid overflow-hidden sm:grid-cols-[1fr_10.5rem]">

            <div className="flex min-h-[13rem] flex-col border-b border-[#EBEBEB] sm:border-b-0 sm:border-r">

                <div className="flex items-center justify-between gap-2 border-b border-[#EBEBEB] bg-[#F7F7F7] px-3 py-2">
                    <p className="text-xs font-semibold text-[#303030]">Equipe · Loja Centro</p>
                    <span className="flex items-center gap-1 text-[0.6rem] font-semibold text-[#616161]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1BAF7A]" aria-hidden />
                        3 on-line
                    </span>
                </div>

                <div className="flex-1 space-y-2 p-3">
                    <div>
                        <p className="text-[0.58rem] font-semibold text-[#8A8A8A]">Marcos · 09:12</p>
                        <p className="mt-0.5 max-w-[85%] bg-[#F1F1F1] px-2.5 py-1.5 text-[0.68rem] leading-relaxed text-[#303030]">
                            Chegou a carga do fornecedor. Dou entrada agora?
                        </p>
                    </div>

                    <div className="text-right">
                        <p className="text-[0.58rem] font-semibold text-[#8A8A8A]">Você · 09:14</p>
                        <p className="mt-0.5 ml-auto max-w-[85%] bg-[#005BD3] px-2.5 py-1.5 text-[0.68rem] leading-relaxed text-white">
                            Dá sim. Depois põe na tarefa da Helena para etiquetar.
                        </p>
                    </div>

                    {/* As três bolinhas do "está digitando" — a mesma animação da
                        conversa de verdade (.bolinha-digitando, em globals.css),
                        e não um desenho parado imitando uma. */}
                    <p className="flex items-center gap-1 pt-0.5" aria-label="Helena está digitando">
                        <span className="text-[0.58rem] font-semibold text-[#8A8A8A]">Helena</span>
                        {[0, 1, 2].map((i) => (
                            <span
                                key={i}
                                className="bolinha-digitando h-1.5 w-1.5 rounded-full bg-[#B5B5B5]"
                                aria-hidden
                            />
                        ))}
                    </p>
                </div>

            </div>

            <div className="min-w-0">
                <p className="bg-[#F7F7F7] px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.06em] text-[#616161]">
                    Tarefas de hoje
                </p>

                {[
                    { texto: "Etiquetar a carga nova", quem: "Helena", feita: false },
                    { texto: "Repor a prateleira 004", quem: "Marcos", feita: false },
                    { texto: "Contagem do corredor 2", quem: "Dona Rita", feita: true },
                ].map(({ texto, quem, feita }) => (
                    <div key={texto} className="flex items-start gap-2 border-b border-[#F1F1F1] px-3 py-2">
                        <span
                            className={`mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center border ${
                                feita ? "border-[#0C5132] bg-[#0C5132]" : "border-[#B5B5B5]"
                            }`}
                            aria-hidden
                        >
                            {feita && <FiCheck className="w-2 text-white" />}
                        </span>

                        <span className="min-w-0">
                            <span
                                className={`block text-[0.65rem] leading-snug ${
                                    feita ? "text-[#8A8A8A] line-through" : "text-[#303030]"
                                }`}
                            >
                                {texto}
                            </span>
                            <span className="block text-[0.58rem] text-[#8A8A8A]">{quem}</span>
                        </span>
                    </div>
                ))}

                <div className="nota nota-amarela m-3 p-2">
                    <p className="text-[0.62rem] leading-snug text-[#303030]">
                        Sábado abre 9h. Quem puder chegar 8h30 ajuda na reposição.
                    </p>
                    <p className="mt-1 text-[0.55rem] text-[#616161]">recado do mural</p>
                </div>
            </div>

        </div>
    )
}

/* ==========================================================================
   A rede de lojas — o outro lado do Pro
   ========================================================================== */

export function MockupRede() {
    return (
        <div className="card overflow-hidden">

            <div className="flex items-center justify-between border-b border-[#EBEBEB] bg-[#F7F7F7] px-4 py-2.5">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#8A8A8A]">
                    Minhas lojas
                </p>
                <span className="num text-[0.7rem] text-[#8A8A8A]">4 de 20</span>
            </div>

            <div className="divide-y divide-[#F1F1F1]">
                {[
                    { nome: "Loja Centro", papel: "matriz", gerente: "você", estoque: "1.204 unidades" },
                    { nome: "Loja Norte", papel: "filial", gerente: "Helena", estoque: "812 unidades" },
                    { nome: "Loja Shopping", papel: "filial", gerente: "Marcos", estoque: "640 unidades" },
                    { nome: "Loja Litoral", papel: "filial", gerente: "Dona Rita", estoque: "377 unidades" },
                ].map(({ nome, papel, gerente, estoque }) => (
                    <div key={nome} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#EAF4FF]" aria-hidden>
                            <FiShoppingBag className="w-3.5 text-[#00369B]" />
                        </span>

                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                                <span className="truncate text-xs font-semibold text-[#303030]">{nome}</span>
                                <span className={`tag ${papel === "matriz" ? "tag-info" : "tag-neutral"} shrink-0`}>
                                    {papel}
                                </span>
                            </span>
                            <span className="block truncate text-[0.62rem] text-[#8A8A8A]">
                                gerente: {gerente}
                            </span>
                        </span>

                        <span className="num shrink-0 text-[0.65rem] text-[#616161]">{estoque}</span>
                    </div>
                ))}
            </div>

            <p className="border-t border-[#EBEBEB] bg-[#F7F7F7] px-4 py-2 text-[0.62rem] leading-snug text-[#616161]">
                Cada loja com o seu estoque, o seu caixa e a sua equipe. A cara do
                site é a da matriz, e o cliente troca de unidade na própria vitrine.
            </p>

        </div>
    )
}
