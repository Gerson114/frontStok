"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
    FiAlertCircle,
    FiArrowRight,
    FiCheckCircle,
    FiClock,
    FiCornerUpLeft,
    FiCreditCard,
    FiDollarSign,
    FiGlobe,
    FiMessageSquare,
    FiPackage,
    FiTruck,
    FiUsers,
} from "react-icons/fi"
import type { IconType } from "react-icons"
import { Pagina, Secao } from "@/app/components/pagina/pagina"
import { Selecao } from "@/app/components/campo/selecao"
import { ApiError } from "@/middleware/client"
import { consultarConfiguracao, salvarConfiguracao } from "@/middleware/configuracao"
import type { ConfiguracaoDaLoja, LimiteDeCampo } from "@/app/type/type"

/**
 * Configurações da loja.
 *
 * Duas coisas moram aqui, e a diferença entre elas é o que organiza a tela:
 *
 *   AS REGRAS — os números que decidem como o sistema se comporta nesta loja.
 *   Todos eles já existiam, escritos à mão no meio do código e iguais para
 *   todo mundo: trinta minutos de reserva do carrinho, sete dias para avisar
 *   avaria, trinta dias para considerar uma peça parada. Números bons como
 *   padrão e ruins como lei.
 *
 *   O CAMINHO PARA O RESTO — assinatura, conta que recebe, frete, site,
 *   equipe. Cada um tem tela própria, e aqui aparece só o atalho: repetir o
 *   formulário seria a mesma coisa em dois lugares, com duas versões para
 *   divergirem.
 *
 * O que esta tela recusa: configuração que ninguém lê. Cada campo abaixo é
 * consultado no lugar onde o número antes estava fixo — e é por isso que são
 * seis, e não sessenta.
 */

/** As telas de configuração que têm porta própria. */
const ATALHOS: { rota: string; titulo: string; descricao: string; Icone: IconType }[] = [
    {
        rota: "/page/assinatura",
        titulo: "Assinatura",
        descricao: "O plano desta conta, a cobrança e a nota. É onde se troca de plano e se atualiza o cartão.",
        Icone: FiCreditCard,
    },
    {
        rota: "/page/pagamento",
        titulo: "Receber pagamento",
        descricao: "A conta da loja no provedor: é para onde vai o dinheiro das vendas do site.",
        Icone: FiDollarSign,
    },
    {
        rota: "/page/frete",
        titulo: "Frete e entrega",
        descricao: "Quanto custa entregar, em que estados, e a partir de quanto sai de graça.",
        Icone: FiTruck,
    },
    {
        rota: "/page/loja",
        titulo: "Meu site",
        descricao: "A identidade da vitrine: nome, endereço, cores e o que aparece na página inicial.",
        Icone: FiGlobe,
    },
    {
        rota: "/page/funcionarios",
        titulo: "Funcionários",
        descricao: "Quem trabalha aqui e quais telas cada um pode abrir.",
        Icone: FiUsers,
    },
]

export default function Configuracoes() {

    const [config, setConfig] = useState<ConfiguracaoDaLoja | null>(null)
    const [limites, setLimites] = useState<Record<string, LimiteDeCampo>>({})
    const [fusos, setFusos] = useState<{ valor: string; nome: string }[]>([])

    const [carregando, setCarregando] = useState(true)
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    useEffect(() => {

        let valeu = true

        consultarConfiguracao()
            .then((resposta) => {
                if (!valeu) return

                setConfig(resposta.configuracao)
                setLimites(resposta.limites ?? {})
                setFusos(resposta.fusos ?? [])
            })
            .catch((e: unknown) => {
                if (valeu) setErro(e instanceof Error ? e.message : "Não foi possível carregar a configuração.")
            })
            .finally(() => {
                if (valeu) setCarregando(false)
            })

        return () => {
            valeu = false
        }
    }, [])

    function mudar<C extends keyof ConfiguracaoDaLoja>(campo: C, valor: ConfiguracaoDaLoja[C]) {
        setConfig((atual) => (atual ? { ...atual, [campo]: valor } : atual))
        setAviso("")
    }

    async function salvar(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault()

        if (!config) return

        setSalvando(true)
        setErro("")
        setAviso("")

        try {
            const { mensagem } = await salvarConfiguracao(config)
            setAviso(mensagem ?? "Configuração salva.")
        } catch (e) {
            // A recusa do servidor vem como frase pronta ("o prazo para pagar
            // precisa ficar entre..."), e é ela que a tela mostra: quem
            // conhece a regra é quem a aplica.
            setErro(e instanceof ApiError ? e.message : "Não foi possível salvar a configuração.")
        } finally {
            setSalvando(false)
        }
    }

    return (
        <Pagina
            titulo="Configurações"
            descricao="As regras que valem nesta loja, e o caminho para o resto do que se configura. Tudo aqui já tinha um padrão — o que muda é que agora dá para mudá-lo."
        >

            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div role="status" className="flex items-start gap-2.5 rounded-lg bg-[#EAFBF1] px-4 py-3 text-sm font-semibold text-[#0C5132]">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{aviso}</span>
                </div>
            )}

            {carregando || !config ? (
                <div className="card h-64 animate-pulse bg-[#F1F1F1]" />
            ) : (
                <form onSubmit={salvar} className="space-y-4">

                    <Secao
                        titulo="O dia desta loja"
                        descricao="Onde o dia começa e termina. É o que decide em qual barra do gráfico uma venda cai e o que entra no fechamento de hoje."
                    >
                        <div className="max-w-md space-y-1.5">
                            <label className="rotulo" htmlFor="fuso">Fuso horário</label>

                            <Selecao
                                id="fuso"
                                value={config.fuso}
                                onChange={(e) => mudar("fuso", e.target.value)}
                            >
                                {fusos.map((fuso) => (
                                    <option key={fuso.valor} value={fuso.valor}>
                                        {fuso.nome}
                                    </option>
                                ))}
                            </Selecao>

                            <p className="text-xs leading-relaxed text-[#616161]">
                                Com o fuso errado, a venda feita depois das 21h aparece no gráfico
                                como se fosse do dia seguinte — e o sábado da loja perde as duas
                                últimas horas para o domingo.
                            </p>
                        </div>
                    </Secao>

                    <Secao
                        titulo="Venda e carrinho"
                        descricao="Quanto tempo o sistema segura a mercadoria de quem ainda não pagou."
                    >
                        <Campo
                            id="minutos_para_pagar"
                            rotulo="Minutos para pagar antes de liberar as peças"
                            valor={config.minutos_para_pagar}
                            limite={limites.minutos_para_pagar}
                            sufixo="minutos"
                            aoMudar={(valor) => mudar("minutos_para_pagar", valor)}
                            Icone={FiClock}
                        >
                            Enquanto o pedido espera pagamento, as peças dele ficam reservadas e
                            somem da prateleira de quem está comprando agora. Curto demais derruba
                            a compra de quem foi buscar o cartão; longo demais esvazia a loja com
                            carrinho abandonado.
                        </Campo>
                    </Secao>

                    <Secao
                        titulo="Devolução e entrega"
                        descricao="As janelas que decidem o que o cliente pode pedir pela vitrine."
                    >
                        <div className="space-y-5">

                            <Campo
                                id="dias_para_avisar_avaria"
                                rotulo="Dias para avisar que chegou danificado"
                                valor={config.dias_para_avisar_avaria}
                                limite={limites.dias_para_avisar_avaria}
                                sufixo="dias"
                                aoMudar={(valor) => mudar("dias_para_avisar_avaria", valor)}
                                Icone={FiCornerUpLeft}
                            >
                                Avaria de transporte se vê ao abrir o pacote. Janela longa é convite
                                para a peça ser usada um mês e só então virar &ldquo;chegou
                                rasgada&rdquo;.
                            </Campo>

                            <Campo
                                id="dias_sem_prazo_prometido"
                                rotulo="Prazo padrão de entrega, quando nenhum foi combinado"
                                valor={config.dias_sem_prazo_prometido}
                                limite={limites.dias_sem_prazo_prometido}
                                sufixo="dias"
                                aoMudar={(valor) => mudar("dias_sem_prazo_prometido", valor)}
                                Icone={FiTruck}
                            >
                                É a partir daqui que um pedido conta como atrasado no painel — e que
                                o cliente pode reclamar que não chegou. Sem ele, prazo zero viraria
                                &ldquo;nunca atrasa&rdquo;.
                            </Campo>

                            <label className="flex cursor-pointer items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={config.avisar_devolucao_no_whatsapp}
                                    onChange={(e) => mudar("avisar_devolucao_no_whatsapp", e.target.checked)}
                                    className="mt-0.5 h-4 w-4 shrink-0"
                                />

                                <span>
                                    <span className="flex items-center gap-2 text-sm font-medium text-[#303030]">
                                        <FiMessageSquare className="w-4 text-[#616161]" aria-hidden />
                                        Avisar no WhatsApp da loja quando alguém pedir devolução
                                    </span>

                                    <span className="mt-0.5 block text-xs leading-relaxed text-[#616161]">
                                        O recado chega no número da loja assim que o cliente envia o
                                        pedido — serve para o sábado à tarde, com o painel fechado.
                                        Precisa do WhatsApp conectado; sem ele, nada é enviado.
                                    </span>
                                </span>
                            </label>

                        </div>
                    </Secao>

                    <Secao
                        titulo="Estoque"
                        descricao="O que o painel considera mercadoria parada."
                    >
                        <Campo
                            id="dias_para_considerar_parado"
                            rotulo="Dias sem sair para uma peça contar como parada"
                            valor={config.dias_para_considerar_parado}
                            limite={limites.dias_para_considerar_parado}
                            sufixo="dias"
                            aoMudar={(valor) => mudar("dias_para_considerar_parado", valor)}
                            Icone={FiPackage}
                        >
                            Alimenta a lista de &ldquo;parado na prateleira&rdquo; do painel da
                            mercadoria. Loja de moda gira em semanas; loja de eletrodoméstico, em
                            meses.
                        </Campo>
                    </Secao>

                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={salvando} className="btn btn-primario">
                            {salvando ? "Salvando..." : "Salvar configurações"}
                        </button>

                        <span className="text-xs text-[#8A8A8A]">
                            Vale para esta loja. Cada loja da rede tem a sua.
                        </span>
                    </div>

                </form>
            )}

            {/* O RESTO, QUE TEM TELA PRÓPRIA */}
            <Secao
                titulo="O resto da configuração"
                descricao="Cada uma destas tem tela própria, porque são trabalho e não ajuste. Daqui é só o caminho."
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {ATALHOS.map((atalho) => (
                        <Link
                            key={atalho.rota}
                            href={atalho.rota}
                            className="card flex items-start gap-3 p-4 transition-colors hover:border-[#B5B5B5]"
                        >
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF4FF] text-[#00369B]">
                                <atalho.Icone className="w-4" aria-hidden />
                            </span>

                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-[#303030]">{atalho.titulo}</span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-[#616161]">
                                    {atalho.descricao}
                                </span>
                            </span>

                            <FiArrowRight className="mt-1 w-4 shrink-0 text-[#8A8A8A]" aria-hidden />
                        </Link>
                    ))}
                </div>
            </Secao>

        </Pagina>
    )
}

/** Um número com o limite escrito ao lado e o porquê embaixo. */
function Campo({ id, rotulo, valor, limite, sufixo, aoMudar, Icone, children }: {
    id: string
    rotulo: string
    valor: number
    limite?: LimiteDeCampo
    sufixo: string
    aoMudar: (valor: number) => void
    Icone: IconType
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <label className="rotulo flex items-center gap-2" htmlFor={id}>
                <Icone className="w-3.5 text-[#616161]" aria-hidden />
                {rotulo}
            </label>

            <div className="flex items-center gap-2">
                <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    value={valor}
                    min={limite?.minimo}
                    max={limite?.maximo}
                    onChange={(e) => aoMudar(Number(e.target.value))}
                    className="field num w-28"
                />

                <span className="text-sm text-[#616161]">{sufixo}</span>

                {/* O limite fica à vista em vez de só recusar depois de salvar.
                    Quem decide continua sendo o servidor — isto é o aviso, não
                    a regra. */}
                {limite && (
                    <span className="num text-xs text-[#8A8A8A]">
                        entre {limite.minimo} e {limite.maximo}
                    </span>
                )}
            </div>

            <p className="max-w-2xl text-xs leading-relaxed text-[#616161]">{children}</p>
        </div>
    )
}
