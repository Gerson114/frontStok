"use client"

import { useState } from "react"
import {
    desconectarCanal,
    salvarCanal,
    type CanalWhatsApp,
} from "@/middleware/whatsapp"
import { ApiError } from "@/middleware/client"
import { FiAlertCircle, FiCheckCircle, FiExternalLink, FiMessageCircle } from "react-icons/fi"

/**
 * Conectar o WhatsApp da loja.
 *
 * Cada lojista traz a própria conta: o próprio número, a própria conta de
 * WhatsApp Business e o próprio token. O sistema nunca fala pelo número de
 * quem não o conectou, e o número de uma loja não aparece na caixa de
 * entrada de outra.
 *
 * O token é uma credencial de portador — quem o tem fala pelo WhatsApp da
 * loja. Por isso ele vai para o servidor e não volta nunca, nem mascarado:
 * meio token na tela é meio token no histórico do navegador e no print que o
 * lojista manda para o suporte.
 */

interface Props {
    canal: CanalWhatsApp | null
    aoConectar: (canal: CanalWhatsApp) => void
    /** Só existe quando já há canal: é o "voltar" de quem veio só conferir. */
    aoCancelar?: () => void
}

export default function ConectarWhatsApp({ canal, aoConectar, aoCancelar }: Props) {

    const [phoneNumberId, setPhoneNumberId] = useState(canal?.phone_number_id ?? "")
    const [wabaId, setWabaId] = useState(canal?.waba_id ?? "")
    const [numero, setNumero] = useState(canal?.numero_exibicao ?? "")
    const [token, setToken] = useState("")

    const [salvando, setSalvando] = useState(false)
    const [desconectando, setDesconectando] = useState(false)
    const [erro, setErro] = useState("")

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        setErro("")

        if (!phoneNumberId.trim()) {
            setErro("Informe o ID do número (phone number ID).")
            return
        }

        if (!canal?.conectado && !token.trim()) {
            setErro("Informe o token de acesso da sua conta.")
            return
        }

        try {
            setSalvando(true)

            const salvo = await salvarCanal({
                phone_number_id: phoneNumberId.trim(),
                waba_id: wabaId.trim(),
                numero_exibicao: numero.trim(),
                token: token.trim(),
            })

            setToken("")
            aoConectar(salvo)

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível salvar a conexão")
        } finally {
            setSalvando(false)
        }
    }

    async function handleDesconectar() {

        setErro("")

        try {
            setDesconectando(true)
            await desconectarCanal()

            aoConectar({
                conectado: false,
                phone_number_id: "",
                waba_id: "",
                numero_exibicao: "",
                ativo: false,
            })

            setPhoneNumberId("")
            setWabaId("")
            setNumero("")

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível desconectar")
        } finally {
            setDesconectando(false)
        }
    }

    return (
        <>
            <h1 className="font-display text-2xl text-[var(--ink)]">
                {canal?.conectado ? "Conexão do WhatsApp" : "Conectar o WhatsApp da loja"}
            </h1>

            <p className="mt-1 text-sm text-[var(--ink-2)]">
                O cliente escreve para o número da sua loja e você responde por aqui,
                sem sair do sistema. Cada loja usa a própria conta — ninguém lê a
                conversa de ninguém.
            </p>

            {canal?.conectado && (
                <div className="mt-6 flex items-start gap-3 rounded-lg bg-[var(--verde-fundo)] px-4 py-3">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0 text-[var(--verde)]" aria-hidden />

                    <p className="text-sm font-semibold text-[var(--verde)]">
                        WhatsApp conectado
                        {canal.numero_exibicao ? ` no número ${canal.numero_exibicao}` : ""}.
                    </p>
                </div>
            )}

            {/* O passo a passo. Sem ele, esta tela é três campos sem sentido
                para quem nunca abriu o painel da Meta — que é a maioria. */}
            <section className="card mt-6 p-6">

                <h2 className="font-display text-lg text-[var(--ink)]">
                    Onde encontrar esses dados
                </h2>

                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--ink-2)]">
                    <li>
                        Crie (ou abra) uma conta no <strong>Meta for Developers</strong> e
                        adicione o produto <strong>WhatsApp</strong> ao seu aplicativo.
                    </li>
                    <li>
                        Em <strong>WhatsApp → Configuração da API</strong>, você vê o
                        número da loja, o <strong>ID do número de telefone</strong> e o
                        <strong> ID da conta do WhatsApp Business</strong>. São os dois
                        primeiros campos abaixo.
                    </li>
                    <li>
                        Na mesma tela, gere um <strong>token de acesso</strong>. Prefira
                        o token permanente de um usuário do sistema: o token de teste
                        vence em 24 horas e a conexão cai sozinha.
                    </li>
                    <li>
                        Cadastre o <strong>webhook</strong> apontando para o endereço
                        abaixo, assine o campo <strong>messages</strong> e use o token de
                        verificação que o suporte lhe passou.
                    </li>
                </ol>

                <div className="mt-4 rounded-lg bg-[var(--fundo)] px-4 py-3">
                    <p className="text-[0.7rem] font-bold text-[var(--ink-3)]">
                        Endereço do webhook
                    </p>
                    <code className="num mt-1 block break-all font-mono text-sm text-[var(--ink)]">
                        {`${process.env.NEXT_PUBLIC_API_PUBLICA ?? "https://seu-servidor"}/public/whatsapp/webhook`}
                    </code>
                </div>

                <a
                    href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-neutro mt-4"
                >
                    <FiExternalLink className="w-4" aria-hidden />
                    Guia oficial da Meta
                </a>

            </section>

            <form onSubmit={handleSubmit} className="card mt-6 p-6 sm:p-7">

                <div className="space-y-5">

                    <div>
                        <label htmlFor="phone" className="rotulo">
                            ID do número de telefone
                        </label>

                        <input
                            id="phone"
                            className="field font-mono"
                            placeholder="Ex: 109876543210987"
                            value={phoneNumberId}
                            onChange={(e) => setPhoneNumberId(e.target.value)}
                        />

                        <p className="mt-1.5 text-xs text-[var(--ink-3)]">
                            Não é o telefone: é o identificador que a Meta dá a ele. É por
                            ele que sabemos que a mensagem que chegou é da sua loja.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="waba" className="rotulo">
                            ID da conta do WhatsApp Business
                        </label>

                        <input
                            id="waba"
                            className="field font-mono"
                            placeholder="Ex: 987654321098765"
                            value={wabaId}
                            onChange={(e) => setWabaId(e.target.value)}
                        />
                    </div>

                    <div>
                        <label htmlFor="numero" className="rotulo">
                            Número, como o cliente o vê
                        </label>

                        <input
                            id="numero"
                            className="field"
                            placeholder="+55 11 90000-0000"
                            value={numero}
                            onChange={(e) => setNumero(e.target.value)}
                        />
                    </div>

                    <div>
                        <label htmlFor="token" className="rotulo">
                            Token de acesso
                        </label>

                        <input
                            id="token"
                            type="password"
                            autoComplete="off"
                            className="field font-mono"
                            placeholder={canal?.conectado ? "Deixe vazio para manter o token atual" : "Cole o token aqui"}
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                        />

                        <p className="mt-1.5 text-xs text-[var(--ink-3)]">
                            Guardado cifrado e nunca mostrado de volta. Se precisar trocar,
                            cole o novo aqui; para só corrigir o número, deixe vazio.
                        </p>
                    </div>

                </div>

                {erro && (
                    <div
                        role="alert"
                        className="mt-5 flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]"
                    >
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">

                    <button type="submit" disabled={salvando} className="btn btn-primario">
                        <FiMessageCircle className="w-4" aria-hidden />
                        {salvando ? "Salvando..." : canal?.conectado ? "Salvar" : "Conectar"}
                    </button>

                    {aoCancelar && (
                        <button type="button" onClick={aoCancelar} className="btn btn-neutro">
                            Voltar às conversas
                        </button>
                    )}

                    {canal?.conectado && (
                        <button
                            type="button"
                            onClick={handleDesconectar}
                            disabled={desconectando}
                            className="ml-auto rounded-lg px-3 py-2 text-sm font-bold text-[var(--vermelho)] transition-colors hover:bg-[var(--vermelho-fundo)] disabled:opacity-50"
                        >
                            {desconectando ? "Desconectando..." : "Desconectar"}
                        </button>
                    )}

                </div>

                {canal?.conectado && (
                    <p className="mt-3 text-xs text-[var(--ink-3)]">
                        Desconectar apaga só as credenciais. O histórico das conversas
                        continua aqui.
                    </p>
                )}

            </form>
        </>
    )
}
