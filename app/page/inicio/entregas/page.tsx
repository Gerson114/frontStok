"use client"

import { useEffect, useState } from "react"
import {
    FiAlertCircle,
    FiCheckCircle,
    FiClock,
    FiDollarSign,
    FiHome,
    FiMapPin,
    FiPackage,
    FiTruck,
} from "react-icons/fi"
import { Pagina, Secao } from "@/app/components/pagina/pagina"
import { BarraDeEstados, BarrasEmpilhadas, type Coluna } from "@/app/components/grafico/grafico"
import {
    Cartao,
    Ranking,
    REGUAS,
    SeletorDeRegua,
    inteiro,
    moeda,
    rotuloDoEixo,
} from "@/app/components/painel/moldura"
import { consultarPainelDasEntregas } from "@/middleware/painel"
import type { GranularidadeDeVendas, PainelDasEntregas } from "@/app/type/type"

/**
 * O painel da expedição: quantos vieram buscar e quantos foram despachados.
 *
 * A pergunta desta tela é de operação, e não de dinheiro: quanto do movimento
 * sai pela porta na mão do cliente e quanto exige alguém embalar, pagar frete
 * e acompanhar rastreio. As duas custam coisas diferentes — uma loja que não
 * sabe a proporção entre elas dimensiona errado a tarde.
 *
 * O gráfico é empilhado, e aqui isso é correto: retirada mais entrega somam o
 * total de pedidos daquela janela, e é o total que se compara entre os dias.
 * (Onde as partes NÃO somam um total — peças que entram contra peças que saem,
 * na tela de mercadoria — o desenho é outro, com duas linhas.)
 */

const SERIES = [
    { rotulo: "Veio buscar", cor: "var(--serie-1)" },
    { rotulo: "Teve de enviar", cor: "var(--serie-2)" },
]

export default function PainelDeEntregas() {

    const [regua, setRegua] = useState<GranularidadeDeVendas>("dia")
    const [dados, setDados] = useState<PainelDasEntregas | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    useEffect(() => {

        let valeu = true

        consultarPainelDasEntregas(regua)
            .then((resposta) => {
                if (valeu) setDados(resposta)
            })
            .catch((e: unknown) => {
                if (valeu) setErro(e instanceof Error ? e.message : "Não foi possível carregar o painel.")
            })
            .finally(() => {
                if (valeu) setCarregando(false)
            })

        return () => {
            valeu = false
        }
    }, [regua])

    const escolhida = REGUAS.find((item) => item.chave === regua)
    const resumo = dados?.resumo

    const colunas: Coluna[] = (dados?.serie ?? []).map((ponto) => ({
        rotulo: ponto.rotulo,
        partes: [ponto.retiradas, ponto.entregas],
        detalhe: [
            { rotulo: "Veio buscar", valor: String(ponto.retiradas), cor: "var(--serie-1)" },
            { rotulo: "Teve de enviar", valor: String(ponto.entregas), cor: "var(--serie-2)" },
        ],
    }))

    const entregues = (resumo?.no_prazo ?? 0) + (resumo?.atrasados ?? 0)

    const pontualidade = entregues > 0
        ? Math.round(((resumo?.no_prazo ?? 0) / entregues) * 100)
        : null

    const horas = resumo?.horas_ate_despachar ?? 0

    return (
        <Pagina
            titulo="Expedição"
            descricao="Como a mercadoria sai da loja: quanto o cliente vem buscar, quanto precisa ser despachado, e o que está parado esperando alguém."
            volta={{ nome: "Início", rota: "/page/inicio" }}
            acoes={<SeletorDeRegua regua={regua} aoTrocar={setRegua} />}
        >

            {erro && (
                <p className="flex items-center gap-2 rounded-lg bg-[#FEE9E8] px-3 py-2 text-sm text-[#8E1F0B]">
                    <FiAlertCircle className="w-4 shrink-0" aria-hidden />
                    {erro}
                </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Cartao
                    Icone={FiHome}
                    rotulo="Vieram buscar"
                    valor={inteiro(resumo?.retiradas ?? 0)}
                    detalhe="retirada no balcão"
                />
                <Cartao
                    Icone={FiTruck}
                    rotulo="Tiveram de ser enviados"
                    valor={inteiro(resumo?.entregas ?? 0)}
                    detalhe={`${moeda(resumo?.frete_cobrado ?? 0)} de frete cobrado`}
                />
                <Cartao
                    Icone={FiCheckCircle}
                    rotulo="Chegaram no prazo"
                    valor={pontualidade === null ? "—" : `${pontualidade}%`}
                    detalhe={
                        entregues > 0
                            ? `${resumo?.no_prazo} no prazo · ${resumo?.atrasados} atrasados`
                            : "nenhuma entrega concluída no período"
                    }
                    tom={pontualidade === null ? undefined : pontualidade >= 90 ? "bom" : pontualidade < 70 ? "ruim" : undefined}
                />
                <Cartao
                    Icone={FiClock}
                    rotulo="Da venda ao despacho"
                    valor={horas > 0 ? `${horas < 24 ? Math.round(horas) + "h" : Math.round(horas / 24) + "d"}` : "—"}
                    detalhe="tempo médio que depende só da loja"
                />
            </div>

            <Secao
                titulo="Como a mercadoria saiu"
                descricao={`${escolhida?.descricao ?? ""} As duas formas somam o total de pedidos de cada janela.`}
            >
                {carregando && !dados ? (
                    <div className="h-[220px] animate-pulse rounded-lg bg-[#F1F1F1]" />
                ) : (
                    <div className={carregando ? "opacity-60 transition-opacity" : "transition-opacity"}>
                        <BarrasEmpilhadas
                            colunas={colunas}
                            series={SERIES}
                            formatar={inteiro}
                            rotuloDoEixo={(rotulo) => rotuloDoEixo(rotulo, regua)}
                        />
                    </div>
                )}
            </Secao>

            {/* A FILA DE AGORA — fora da régua de tempo */}
            <Secao
                titulo="Parado agora"
                descricao="Independe da régua acima: é o que está esperando alguém neste momento. Um pedido de duas semanas atrás que ninguém despachou aparece aqui."
            >
                <BarraDeEstados
                    partes={[
                        { rotulo: "A embalar", valor: resumo?.a_embalar ?? 0, cor: "var(--situacao-livre)" },
                        { rotulo: "A caminho", valor: resumo?.a_caminho ?? 0, cor: "var(--situacao-atribuido)" },
                        { rotulo: "Esperando o cliente buscar", valor: resumo?.a_retirar ?? 0, cor: "var(--situacao-atendendo)" },
                    ]}
                />
            </Secao>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">

                <Secao
                    titulo="Por transportadora"
                    descricao="Quem levou a mercadoria, e quanto de frete foi cobrado por cada uma."
                >
                    <Ranking
                        vazio="Nenhum envio no período."
                        linhas={(dados?.transportadoras ?? []).map((linha) => ({
                            chave: linha.nome,
                            nome: linha.nome,
                            valor: `${linha.pedidos} · ${moeda(linha.frete)}`,
                            barra: linha.pedidos,
                        }))}
                    />
                </Secao>

                <Secao
                    titulo="Para onde foi"
                    descricao="As cidades que mais receberam pedidos da loja."
                >
                    <Ranking
                        vazio="Nenhum envio no período."
                        linhas={(dados?.destinos ?? []).map((linha) => ({
                            chave: `${linha.uf}-${linha.cidade}`,
                            nome: linha.cidade,
                            detalhe: linha.uf,
                            valor: `${linha.pedidos} · ${moeda(linha.frete)}`,
                            barra: linha.pedidos,
                        }))}
                    />
                </Secao>

            </div>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-[#8A8A8A]">
                <FiPackage className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                O prazo é contado do despacho (ou do pagamento, enquanto a loja não despachou) mais
                os dias combinados no fechamento — a mesma conta que o comprador vê na tela dele.
                Pedido cancelado fica fora de todas as contas desta tela: ele não gerou trabalho de
                expedição nenhum.
            </p>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-[#8A8A8A]">
                <FiMapPin className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                <FiDollarSign className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                O frete cobrado é o que entrou junto da venda, e não lucro: parte dele — ou todo
                ele — vai para quem transporta.
            </p>

        </Pagina>
    )
}
