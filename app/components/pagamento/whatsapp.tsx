"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FiAlertCircle, FiCheckCircle, FiMessageSquare } from "react-icons/fi"
import { Secao } from "@/app/components/pagina/pagina"
import { ApiError } from "@/middleware/client"
import { consultarConfiguracao, salvarConfiguracao } from "@/middleware/configuracao"
import { consultarLoja } from "@/middleware/loja"
import type { ConfiguracaoDaLoja } from "@/app/type/type"

/**
 * Combinar o pagamento por WhatsApp.
 *
 * É como boa parte do comércio pequeno brasileiro vende: o cliente fecha o
 * pedido no site, chama no WhatsApp, a loja manda a chave Pix e confirma
 * quando o dinheiro cai. Existe aqui, na tela de receber pagamento, porque é
 * uma FORMA DE RECEBER — e é onde o lojista vem quando pensa em como o
 * dinheiro entra.
 *
 * Duas coisas que a tela precisa deixar claras, porque o desenho delas é o que
 * torna isto seguro:
 *
 *   O pedido NÃO nasce pago. Ele nasce "combinando": aparece na lista do
 *   painel, com selo âmbar, e só vira venda quando alguém confirma o
 *   recebimento. Nenhum provedor vai avisar, porque nenhum provedor esteve no
 *   meio — quem diz que o Pix caiu é a loja.
 *
 *   As peças ficam reservadas enquanto a conversa acontece, e por isso a
 *   espera tem teto: sem ele, o pedido que a pessoa abandonou no meio do
 *   caminho seguraria mercadoria para sempre.
 */
export default function PagamentoPorWhatsApp() {

    const [config, setConfig] = useState<ConfiguracaoDaLoja | null>(null)

    // Sem número cadastrado não há para onde mandar o cliente, e a opção não
    // pode ser ligada: o servidor recusaria a forma no checkout, e o lojista
    // descobriria isso pela primeira venda perdida.
    const [temNumero, setTemNumero] = useState(true)
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    useEffect(() => {

        let valeu = true

        consultarConfiguracao()
            .then((resposta) => {
                if (valeu) setConfig(resposta.configuracao)
            })
            .catch(() => {
                // Silêncio: o resto da tela de pagamento continua servindo.
            })

        consultarLoja()
            .then((loja) => {
                if (valeu) setTemNumero((loja.whatsapp ?? "").trim() !== "")
            })
            .catch(() => {
                // Na dúvida, deixa ligar: quem recusa de verdade é o servidor.
            })

        return () => {
            valeu = false
        }
    }, [])

    async function gravar(mudanca: Partial<ConfiguracaoDaLoja>) {

        if (!config) return

        const novo = { ...config, ...mudanca }

        setConfig(novo)
        setSalvando(true)
        setErro("")
        setAviso("")

        try {
            await salvarConfiguracao(novo)
            setAviso(novo.pagar_pelo_whatsapp ? "Combinar por WhatsApp está ligado." : "Combinar por WhatsApp está desligado.")
        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível salvar.")
            setConfig(config)
        } finally {
            setSalvando(false)
        }
    }

    if (!config) return null

    return (
        <Secao
            titulo="Combinar pelo WhatsApp"
            descricao="Para quem vende com Pix na conversa. O cliente fecha o pedido no site e vai direto falar com você — o pedido aparece aqui do mesmo jeito, esperando o seu OK."
        >

            {!temNumero && (
                <p className="mb-4 flex items-start gap-2.5 rounded-lg border-l-2 border-[var(--amarelo-forte)] bg-[var(--amarelo-fundo)] px-4 py-3 text-sm text-[var(--amarelo)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>
                        Esta loja não tem WhatsApp cadastrado, então não há para onde mandar o
                        cliente — a opção não vai aparecer no site.{" "}
                        <Link href="/page/loja" className="font-semibold text-[var(--azul)] hover:underline">
                            Cadastre o número em Meu site
                        </Link>.
                    </span>
                </p>
            )}

            {erro && (
                <p role="alert" className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--vermelho-fundo)] px-3 py-2 text-sm text-[var(--vermelho)]">
                    <FiAlertCircle className="w-4 shrink-0" aria-hidden />
                    {erro}
                </p>
            )}

            {aviso && (
                <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--verde-suave)] px-3 py-2 text-sm text-[var(--verde)]">
                    <FiCheckCircle className="w-4 shrink-0" aria-hidden />
                    {aviso}
                </p>
            )}

            <label className="flex cursor-pointer items-start gap-3">
                <input
                    type="checkbox"
                    checked={config.pagar_pelo_whatsapp}
                    disabled={salvando || !temNumero}
                    onChange={(e) => gravar({ pagar_pelo_whatsapp: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0"
                />

                <span>
                    <span className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
                        <FiMessageSquare className="w-4 text-[var(--ink-2)]" aria-hidden />
                        Oferecer &ldquo;combinar o pagamento no WhatsApp&rdquo; no site
                    </span>

                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-2)]">
                        Ao escolher essa forma, o cliente é levado à sua conversa com o número do
                        pedido e o total já escritos. O pedido entra na sua lista marcado como
                        <strong className="font-semibold"> combinando</strong>, e as unidades ficam
                        reservadas — ele não conta como venda até você confirmar que recebeu.
                    </span>
                </span>
            </label>

            {config.pagar_pelo_whatsapp && (
                <div className="mt-5 border-t border-[var(--linha-suave)] pt-5">

                    <label className="rotulo" htmlFor="horas_para_combinar">
                        Horas segurando as unidades enquanto vocês combinam
                    </label>

                    <div className="mt-1.5 flex items-center gap-2">
                        <input
                            id="horas_para_combinar"
                            type="number"
                            min={1}
                            max={168}
                            value={config.horas_para_combinar}
                            disabled={salvando}
                            onChange={(e) => setConfig({ ...config, horas_para_combinar: Number(e.target.value) })}
                            onBlur={() => gravar({ horas_para_combinar: config.horas_para_combinar })}
                            className="field num w-24"
                        />

                        <span className="text-sm text-[var(--ink-2)]">horas</span>
                        <span className="num text-xs text-[var(--ink-3)]">entre 1 e 168</span>
                    </div>

                    <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[var(--ink-2)]">
                        Passado esse tempo sem você confirmar o recebimento, o pedido é desfeito e
                        as unidades voltam para a prateleira. É bem mais que os minutos do carrinho
                        porque aqui há uma conversa acontecendo — mas não é sem fim: pedido
                        abandonado no meio da conversa não pode segurar mercadoria para sempre.
                    </p>

                </div>
            )}

        </Secao>
    )
}
