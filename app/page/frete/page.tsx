"use client"

import { useEffect, useState } from "react"
import { FiAlertCircle, FiCheckCircle, FiPlus, FiTrash2, FiTruck } from "react-icons/fi"
import { Pagina, Secao } from "@/app/components/pagina/pagina"
import type { ConfigFrete, RegraFrete } from "@/app/type/type"
import { consultarFrete, salvarFrete, UFS, UF_CURINGA } from "@/middleware/frete"

/**
 * Onde o lojista diz quanto cobra para entregar.
 *
 * A vitrine vendia sem nunca falar de entrega: o cliente pagava e ninguém
 * sabia para onde mandar nem quanto custava mandar. Esta tela é a metade do
 * lojista dessa conversa.
 *
 * A tabela é por ESTADO, e não por faixa de CEP, porque é a granularidade que
 * ele consegue manter sozinho: 27 linhas no máximo, e ele sabe de cor quais
 * são caras. Faixa de CEP é precisão que só serve para quem tem contrato com
 * transportadora — e quem tem vai querer a integração, não digitar faixas.
 *
 * A linha curinga ("todo o resto do país") existe para o cliente de um estado
 * não listado conseguir fechar o pedido. Sem ela, ligar a entrega criaria
 * clientes que chegam ao fim do checkout e levam um erro.
 */

/** O rótulo de uma UF na tela, com o curinga escrito por extenso. */
function nomeDaUF(uf: string): string {
    return uf === UF_CURINGA ? "Todo o resto do país" : uf
}

export default function Frete() {

    const [config, setConfig] = useState<ConfigFrete>({
        ativo: false,
        retirada_na_loja: true,
        frete_gratis_acima: 0,
    })

    const [regras, setRegras] = useState<RegraFrete[]>([])
    const [carregando, setCarregando] = useState(true)
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    useEffect(() => {

        let cancelado = false

        async function buscar() {
            try {
                const dados = await consultarFrete()

                if (!cancelado) {
                    setConfig(dados.config)
                    setRegras(dados.regras)
                }
            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof Error ? e.message : "Não foi possível carregar o frete.")
                }
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [])

    /** Os estados que ainda não têm linha — o que o botão de acrescentar oferece. */
    const disponiveis = [UF_CURINGA, ...UFS].filter(
        (uf) => !regras.some((regra) => regra.uf === uf),
    )

    function acrescentar() {
        const proxima = disponiveis[0]

        if (!proxima) return

        setRegras([...regras, { uf: proxima, valor: 0, prazo_dias: 0 }])
    }

    function alterar(indice: number, campos: Partial<RegraFrete>) {
        setRegras(regras.map((regra, i) => (i === indice ? { ...regra, ...campos } : regra)))
    }

    function remover(indice: number) {
        setRegras(regras.filter((_, i) => i !== indice))
    }

    async function handleSalvar(evento: React.FormEvent) {
        evento.preventDefault()
        setSalvando(true)
        setErro("")
        setAviso("")

        try {
            await salvarFrete(config, regras)
            setAviso("Frete salvo. A vitrine já cobra por esta tabela.")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível salvar o frete.")
        } finally {
            setSalvando(false)
        }
    }

    if (carregando) {
        return (
            <Pagina titulo="Frete e entrega">
                <div className="card p-8 text-center text-sm text-[var(--ink-2)]">Carregando...</div>
            </Pagina>
        )
    }

    const temCuringa = regras.some((regra) => regra.uf === UF_CURINGA)

    return (
        <Pagina
            titulo="Frete e entrega"
            descricao="Quanto a sua loja cobra para entregar, e em quanto tempo. É esta tabela que a vitrine consulta quando o cliente digita o CEP."
            acoes={
                <button
                    type="submit"
                    form="formulario-frete"
                    disabled={salvando}
                    className="btn btn-primario"
                >
                    {salvando ? "Salvando..." : "Salvar"}
                </button>
            }
        >

            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div role="status" className="flex items-start gap-2.5 rounded-lg bg-[var(--verde-fundo)] px-4 py-3 text-sm font-semibold text-[var(--verde)]">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{aviso}</span>
                </div>
            )}

            <form id="formulario-frete" onSubmit={handleSalvar} className="space-y-6">

                <Secao
                    titulo="Como a sua loja entrega"
                    descricao="Enquanto a entrega estiver desligada, a vitrine não pede endereço e todo pedido nasce como retirada."
                >
                    <div className="space-y-4">

                        <label className="flex cursor-pointer items-start gap-3">
                            <input
                                type="checkbox"
                                checked={config.ativo}
                                onChange={(e) => setConfig({ ...config, ativo: e.target.checked })}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--azul)]"
                            />
                            <span>
                                <span className="block text-sm font-medium text-[var(--ink)]">
                                    Entrego no endereço do cliente
                                </span>
                                <span className="block text-sm text-[var(--ink-2)]">
                                    A vitrine passa a pedir o CEP e a cobrar o frete da tabela abaixo.
                                </span>
                            </span>
                        </label>

                        <label className="flex cursor-pointer items-start gap-3">
                            <input
                                type="checkbox"
                                checked={config.retirada_na_loja}
                                onChange={(e) => setConfig({ ...config, retirada_na_loja: e.target.checked })}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--azul)]"
                            />
                            <span>
                                <span className="block text-sm font-medium text-[var(--ink)]">
                                    O cliente pode retirar no balcão
                                </span>
                                <span className="block text-sm text-[var(--ink-2)]">
                                    Sem frete e sem endereço: ele compra pelo site e busca na loja.
                                </span>
                            </span>
                        </label>

                        <div className="border-t border-[var(--linha-suave)] pt-4">
                            <label className="rotulo" htmlFor="gratis">
                                Frete grátis a partir de
                            </label>

                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[var(--ink-2)]">R$</span>
                                <input
                                    id="gratis"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={config.frete_gratis_acima || ""}
                                    onChange={(e) =>
                                        setConfig({ ...config, frete_gratis_acima: Number(e.target.value) || 0 })
                                    }
                                    placeholder="0,00"
                                    className="field max-w-[12rem]"
                                />
                            </div>

                            <p className="mt-1.5 text-sm text-[var(--ink-2)]">
                                Em branco ou zero desliga a isenção. Não quer dizer &ldquo;tudo grátis&rdquo;.
                            </p>
                        </div>

                    </div>
                </Secao>

                <Secao
                    titulo="Tabela de frete"
                    descricao="Um valor e um prazo por estado. Comece pela linha que vale para todo o resto do país — é ela que atende quem mora onde você não listou."
                    acoes={
                        <button
                            type="button"
                            onClick={acrescentar}
                            disabled={disponiveis.length === 0}
                            className="btn btn-neutro"
                        >
                            <FiPlus className="w-4" aria-hidden />
                            <span>Acrescentar estado</span>
                        </button>
                    }
                    plano
                >
                    {regras.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-10 text-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--superficie-2)] text-[var(--ink-3)]">
                                <FiTruck className="w-5" aria-hidden />
                            </span>

                            <p className="font-display mt-4 text-base text-[var(--ink)]">
                                Nenhuma linha na tabela
                            </p>

                            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[var(--ink-2)]">
                                Acrescente ao menos a linha que vale para todo o resto do país. Sem
                                ela, quem morar num estado que você não listou não consegue fechar
                                o pedido.
                            </p>

                            <button type="button" onClick={acrescentar} className="btn btn-primario mt-5">
                                <FiPlus className="w-4" aria-hidden />
                                <span>Acrescentar estado</span>
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="tabela">
                                <thead>
                                    <tr>
                                        <th>Estado</th>
                                        <th>Valor</th>
                                        <th>Prazo</th>
                                        <th aria-label="Ações" />
                                    </tr>
                                </thead>

                                <tbody>
                                    {regras.map((regra, indice) => (
                                        <tr key={`${regra.uf}-${indice}`}>

                                            <td>
                                                <select
                                                    value={regra.uf}
                                                    onChange={(e) => alterar(indice, { uf: e.target.value })}
                                                    aria-label="Estado"
                                                    className="field max-w-[14rem] cursor-pointer"
                                                >
                                                    <option value={regra.uf}>{nomeDaUF(regra.uf)}</option>

                                                    {disponiveis.map((uf) => (
                                                        <option key={uf} value={uf}>{nomeDaUF(uf)}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            <td>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    value={regra.valor || ""}
                                                    onChange={(e) => alterar(indice, { valor: Number(e.target.value) || 0 })}
                                                    placeholder="0,00"
                                                    aria-label="Valor do frete"
                                                    className="field num max-w-[8rem]"
                                                />
                                            </td>

                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={regra.prazo_dias || ""}
                                                        onChange={(e) => alterar(indice, { prazo_dias: Number(e.target.value) || 0 })}
                                                        placeholder="0"
                                                        aria-label="Prazo em dias"
                                                        className="field num max-w-[5.5rem]"
                                                    />
                                                    <span className="text-sm text-[var(--ink-2)]">dias</span>
                                                </div>
                                            </td>

                                            <td className="text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => remover(indice)}
                                                    title="Remover esta linha"
                                                    aria-label={`Remover ${nomeDaUF(regra.uf)}`}
                                                    className="rounded-lg p-2 text-[var(--ink-3)] transition-colors hover:bg-[var(--vermelho-fundo)] hover:text-[var(--vermelho)]"
                                                >
                                                    <FiTrash2 className="w-4" aria-hidden />
                                                </button>
                                            </td>

                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Secao>

                {config.ativo && !temCuringa && regras.length > 0 && (
                    <p className="flex items-start gap-2.5 rounded-lg border-l-2 border-[var(--amarelo-forte)] bg-[var(--amarelo-fundo)] px-4 py-3 text-sm text-[var(--amarelo)]">
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>
                            Falta a linha de <strong>todo o resto do país</strong>. Do jeito que
                            está, quem morar num estado fora da sua lista chega ao fim do
                            checkout e não consegue fechar o pedido.
                        </span>
                    </p>
                )}

            </form>

        </Pagina>
    )
}
