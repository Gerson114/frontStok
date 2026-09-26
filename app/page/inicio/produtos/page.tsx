"use client"

import { useEffect, useState } from "react"
import {
    FiAlertCircle,
    FiAlertTriangle,
    FiArrowDown,
    FiArrowUp,
    FiClock,
    FiCornerUpLeft,
    FiDollarSign,
    FiPackage,
    FiTruck,
} from "react-icons/fi"
import { Pagina, Secao } from "@/app/components/pagina/pagina"
import { Linhas } from "@/app/components/grafico/grafico"
import {
    Cartao,
    Ranking,
    REGUAS,
    SeletorDeRegua,
    Total,
    inteiro,
    moeda,
    moedaCurta,
    rotuloDoEixo,
} from "@/app/components/painel/moldura"
import { consultarPainelDaMercadoria } from "@/middleware/painel"
import type { GranularidadeDeVendas, PainelDaMercadoria } from "@/app/type/type"

/**
 * O painel da mercadoria: o que chegou e o que saiu.
 *
 * A tela de Início responde "como foi o dia" em dinheiro. Esta responde a
 * outra pergunta do dono, que é sobre as PEÇAS: entrou mais do que saiu? o
 * que está girando? quanto dinheiro está dormindo na arara?
 *
 * Dois gráficos e não um só, e a razão é a regra que atravessa os gráficos
 * deste painel: um eixo por desenho. Peça e real são medidas de escalas
 * diferentes, e desenhá-las juntas faria as duas curvas se cruzarem onde o
 * autor do gráfico escolheu — não onde os números se encontram.
 */

const SERIES_PECAS = [
    { rotulo: "Entraram", cor: "var(--serie-1)" },
    { rotulo: "Saíram", cor: "var(--serie-2)" },
]

const SERIES_DINHEIRO = [
    { rotulo: "Custo do que entrou", cor: "var(--serie-1)" },
    { rotulo: "Receita do que saiu", cor: "var(--serie-2)" },
]

export default function PainelDeProdutos() {

    const [regua, setRegua] = useState<GranularidadeDeVendas>("dia")
    const [dados, setDados] = useState<PainelDaMercadoria | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    useEffect(() => {

        let valeu = true

        consultarPainelDaMercadoria(regua)
            .then((resposta) => {
                // A resposta da régua anterior pode chegar depois da atual se
                // o lojista clicar duas vezes seguidas. Sem esta guarda, o
                // painel do mês apareceria rotulado como o do ano.
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
    const serie = dados?.serie ?? []
    const resumo = dados?.resumo

    const rotulos = serie.map((ponto) => ponto.rotulo)

    const saldo = (resumo?.pecas_entraram ?? 0) - (resumo?.pecas_sairam ?? 0)

    return (
        <Pagina
            titulo="Mercadoria"
            descricao="O que chegou e o que saiu da loja, unidade por unidade. A entrada é o que a loja comprou; a saída é o que foi vendido e não voltou."
            volta={{ nome: "Início", rota: "/page/inicio" }}
            acoes={<SeletorDeRegua regua={regua} aoTrocar={setRegua} />}
        >

            {erro && (
                <p className="flex items-center gap-2 rounded-lg bg-[var(--vermelho-fundo)] px-3 py-2 text-sm text-[var(--vermelho)]">
                    <FiAlertCircle className="w-4 shrink-0" aria-hidden />
                    {erro}
                </p>
            )}

            {/* O QUE ACONTECEU NA JANELA ESCOLHIDA */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Cartao
                    Icone={FiArrowDown}
                    rotulo="Unidades que entraram"
                    valor={inteiro(resumo?.pecas_entraram ?? 0)}
                    detalhe={`${moeda(resumo?.custo_entrada ?? 0)} de custo`}
                />
                <Cartao
                    Icone={FiArrowUp}
                    rotulo="Unidades que saíram"
                    valor={inteiro(resumo?.pecas_sairam ?? 0)}
                    detalhe={`${moeda(resumo?.receita_saida ?? 0)} de receita`}
                />
                <Cartao
                    Icone={FiPackage}
                    rotulo="Saldo do período"
                    valor={`${saldo > 0 ? "+" : ""}${inteiro(saldo)}`}
                    detalhe={saldo >= 0 ? "entrou mais do que saiu" : "saiu mais do que entrou"}
                />
                <Cartao
                    Icone={FiDollarSign}
                    rotulo="Parado na prateleira"
                    valor={moeda(resumo?.custo_parado ?? 0)}
                    detalhe={`${inteiro(resumo?.em_estoque ?? 0)} unidades à venda`}
                />
            </div>

            {/* PEÇAS AO LONGO DO TEMPO */}
            <Secao
                titulo="Unidades que entraram e saíram"
                descricao={`${escolhida?.descricao ?? ""} Duas contagens da mesma medida, no mesmo eixo — é a distância entre as linhas que diz se a loja está enchendo ou esvaziando.`}
            >
                {carregando && !dados ? (
                    <div className="h-[200px] animate-pulse rounded-lg bg-[var(--fundo)]" />
                ) : (
                    <div className={carregando ? "opacity-60 transition-opacity" : "transition-opacity"}>
                        <Linhas
                            rotulos={rotulos}
                            series={SERIES_PECAS}
                            valores={[
                                serie.map((ponto) => ponto.pecas_entraram),
                                serie.map((ponto) => ponto.pecas_sairam),
                            ]}
                            formatar={inteiro}
                            rotuloDoEixo={(rotulo) => rotuloDoEixo(rotulo, regua)}
                        />
                    </div>
                )}
            </Secao>

            {/* DINHEIRO AO LONGO DO TEMPO */}
            <Secao
                titulo="Custo e receita"
                descricao="O que a loja pagou pelas unidades que chegaram e o que recebeu pelas que saíram. As duas quase nunca acontecem no mesmo dia: a unidade chega em março e sai em maio."
            >
                {carregando && !dados ? (
                    <div className="h-[200px] animate-pulse rounded-lg bg-[var(--fundo)]" />
                ) : (
                    <div className={carregando ? "opacity-60 transition-opacity" : "transition-opacity"}>
                        <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
                            <Total rotulo="Custo de entrada" valor={moeda(resumo?.custo_entrada ?? 0)} />
                            <Total rotulo="Receita de saída" valor={moeda(resumo?.receita_saida ?? 0)} />
                        </div>

                        <Linhas
                            rotulos={rotulos}
                            series={SERIES_DINHEIRO}
                            valores={[
                                serie.map((ponto) => ponto.custo),
                                serie.map((ponto) => ponto.receita),
                            ]}
                            formatar={moedaCurta}
                            rotuloDoEixo={(rotulo) => rotuloDoEixo(rotulo, regua)}
                        />
                    </div>
                )}
            </Secao>

            {/* O QUE ESTÁ NA LOJA AGORA */}
            <Secao
                titulo="Na loja agora"
                descricao="Independe da régua acima: é o que está na prateleira neste momento."
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Cartao
                        Icone={FiPackage}
                        rotulo="À venda"
                        valor={inteiro(resumo?.em_estoque ?? 0)}
                        detalhe="unidades vendáveis"
                    />
                    <Cartao
                        Icone={FiClock}
                        rotulo="Reservadas"
                        valor={inteiro(resumo?.reservadas ?? 0)}
                        detalhe="prometidas a um pedido"
                    />
                    <Cartao
                        Icone={FiAlertTriangle}
                        rotulo="Avariadas"
                        valor={inteiro(resumo?.avariadas ?? 0)}
                        detalhe="fora do vendável"
                        tom={(resumo?.avariadas ?? 0) > 0 ? "ruim" : undefined}
                    />
                    <Cartao
                        Icone={FiCornerUpLeft}
                        rotulo="Devolvidas"
                        valor={inteiro(resumo?.devolvidas ?? 0)}
                        detalhe="voltaram do cliente"
                    />
                </div>
            </Secao>

            {/* AS LISTAS */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">

                <Secao titulo="O que mais saiu" descricao="As unidades que a loja vendeu no período.">
                    <Ranking
                        vazio="Nada saiu no período."
                        linhas={(dados?.mais_sairam ?? []).map((linha) => ({
                            chave: linha.produto_id,
                            nome: linha.nome || `Produto #${linha.produto_id}`,
                            detalhe: linha.codigo,
                            valor: `${linha.pecas} · ${moeda(linha.valor)}`,
                            barra: linha.pecas,
                        }))}
                    />
                </Secao>

                <Secao titulo="O que mais entrou" descricao="As unidades que a loja comprou no período.">
                    <Ranking
                        vazio="Nada entrou no período."
                        linhas={(dados?.mais_entraram ?? []).map((linha) => ({
                            chave: linha.produto_id,
                            nome: linha.nome || `Produto #${linha.produto_id}`,
                            detalhe: linha.codigo,
                            valor: `${linha.pecas} · ${moeda(linha.valor)}`,
                            barra: linha.pecas,
                        }))}
                    />
                </Secao>

                <Secao
                    titulo="De quem a loja comprou"
                    descricao="A entrada de mercadoria somada por fornecedor."
                >
                    <Ranking
                        vazio="Nenhuma entrada com fornecedor no período."
                        linhas={(dados?.fornecedores ?? []).map((linha) => ({
                            chave: linha.nome,
                            nome: linha.nome,
                            valor: `${linha.pecas} · ${moeda(linha.custo)}`,
                            barra: linha.pecas,
                        }))}
                    />
                </Secao>

                <Secao
                    titulo="Parado há mais de 30 dias"
                    descricao="Unidade vendável que chegou faz tempo e não saiu. É dinheiro da loja dormindo na prateleira."
                >
                    <Ranking
                        vazio="Nada parado há mais de 30 dias."
                        linhas={(dados?.paradas ?? []).map((linha) => ({
                            chave: linha.produto_id,
                            nome: linha.nome || `Produto #${linha.produto_id}`,
                            detalhe: linha.codigo,
                            valor: `${linha.pecas} unidade(s) · ${linha.dias_paradas} dias`,
                            barra: linha.dias_paradas,
                        }))}
                    />
                </Secao>

            </div>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--ink-3)]">
                <FiTruck className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                Unidade devolvida sai da conta da saída: ela foi vendida e voltou, e contá-la aqui
                diria que a mercadoria deixou a loja quando ela está de volta na prateleira.
            </p>

        </Pagina>
    )
}
