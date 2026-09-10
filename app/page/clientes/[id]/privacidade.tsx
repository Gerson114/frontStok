"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { FiAlertTriangle, FiDownload, FiUserX } from "react-icons/fi"
import { Secao } from "@/app/components/pagina/pagina"
import { anonimizarCliente } from "@/middleware/clientes"

/**
 * O que a loja faz quando um cliente exerce os direitos da LGPD.
 *
 * São os dois pedidos que chegam na prática: "me manda o que vocês têm sobre
 * mim" (art. 18, II) e "apaga meus dados" (art. 18, VI). A lei dá 15 dias para
 * responder ao primeiro, e o segundo não pode ser respondido com um DELETE na
 * tabela — a loja também é obrigada a guardar o histórico de vendas.
 *
 * Por isso anonimizar em vez de excluir: a pessoa sai, a venda fica. E por
 * isso a confirmação em dois passos com a lista do que some — quem clica aqui
 * está agindo em nome de outra pessoa, e não tem como desfazer.
 */
export default function PrivacidadeDoCliente({ id, nome }: { id: number; nome: string }) {

    const router = useRouter()
    const [ocupado, setOcupado] = useState<"" | "baixar" | "anonimizar">("")
    const [confirmando, setConfirmando] = useState(false)
    const [erro, setErro] = useState("")

    async function baixar() {

        setErro("")
        setOcupado("baixar")

        try {
            const resposta = await fetch(`/api/clientes/${id}/dados`)

            if (!resposta.ok) {
                const dados = await resposta.json().catch(() => null)
                setErro(dados?.erro ?? "Não foi possível reunir os dados deste cliente.")
                return
            }

            const arquivo = await resposta.blob()
            const endereco = URL.createObjectURL(arquivo)
            const link = document.createElement("a")

            link.href = endereco
            link.download = `cliente-${id}-dados.json`
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(endereco)

        } catch {
            setErro("Não foi possível reunir os dados deste cliente.")
        } finally {
            setOcupado("")
        }
    }

    async function anonimizar() {

        setErro("")
        setOcupado("anonimizar")

        try {
            await anonimizarCliente(id)

            // A ficha que estava aberta não existe mais como pessoa; ficar
            // nela mostrando "Cliente removido" só confunde.
            router.push("/page/clientes")

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível anonimizar este cliente.")
            setOcupado("")
        }
    }

    return (
        <Secao
            titulo="Privacidade (LGPD)"
            descricao="Se esta pessoa pedir uma cópia dos dados dela ou a exclusão do cadastro, é aqui que a loja responde. A lei dá 15 dias para atender."
        >

            <div className="flex flex-wrap gap-2.5">
                <button
                    type="button"
                    onClick={baixar}
                    disabled={ocupado !== ""}
                    className="btn btn-neutro"
                >
                    <FiDownload className="w-4" aria-hidden />
                    {ocupado === "baixar" ? "Reunindo..." : "Baixar os dados"}
                </button>

                {!confirmando && (
                    <button
                        type="button"
                        onClick={() => { setErro(""); setConfirmando(true) }}
                        disabled={ocupado !== ""}
                        className="btn btn-neutro text-[#8E1F0B]"
                    >
                        <FiUserX className="w-4" aria-hidden />
                        Anonimizar cadastro
                    </button>
                )}
            </div>

            {confirmando && (
                <div className="mt-4 border border-[#E0B3B2] bg-[#FEE9E8] p-4">

                    <p className="flex items-center gap-2 text-sm font-bold text-[#8E1F0B]">
                        <FiAlertTriangle className="w-4 shrink-0" aria-hidden />
                        Anonimizar {nome || "este cliente"}?
                    </p>

                    <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-[#303030]">
                        <li>
                            <strong>Some:</strong> nome, e-mail, telefone e as conversas do
                            chat. A conta dela para de funcionar na hora.
                        </li>
                        <li>
                            <strong>Fica:</strong> os pedidos, os valores e os itens, sem
                            dono — é o histórico de vendas que a loja é obrigada a guardar.
                            Suas somas e seu faturamento não mudam.
                        </li>
                        <li>
                            <strong>Não tem volta.</strong> Se você vai precisar dos dados
                            para alguma coisa, baixe a cópia antes.
                        </li>
                    </ul>

                    <div className="mt-4 flex flex-wrap gap-2.5">
                        <button
                            type="button"
                            onClick={anonimizar}
                            disabled={ocupado !== ""}
                            className="btn bg-[#8E1F0B] text-white"
                        >
                            {ocupado === "anonimizar" ? "Anonimizando..." : "Sim, anonimizar"}
                        </button>

                        <button
                            type="button"
                            onClick={() => setConfirmando(false)}
                            disabled={ocupado !== ""}
                            className="btn btn-neutro"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {erro && (
                <p role="alert" className="mt-3 text-sm font-semibold text-[#8E1F0B]">
                    {erro}
                </p>
            )}

        </Secao>
    )
}
