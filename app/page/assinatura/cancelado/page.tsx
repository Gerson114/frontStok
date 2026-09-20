"use client"

import Link from "next/link"
import { FiXCircle } from "react-icons/fi"
import { PaginaCentrada } from "@/app/components/pagina/pagina"

// Para onde o Stripe devolve quem desistiu no meio do checkout. Nada foi
// cobrado, e o tom aqui deve deixar isso claro em vez de parecer um erro.
export default function AssinaturaCanceladoPage() {
    return (
        <PaginaCentrada>

            <div className="card p-7 text-center sm:p-8">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--fundo)] text-[var(--ink-2)]">
                    <FiXCircle className="w-6" aria-hidden />
                </div>

                <h1 className="font-display mt-5 text-2xl text-[var(--ink)]">
                    Pagamento não concluído
                </h1>

                <p className="mt-2 text-sm text-[var(--ink-2)]">
                    Você saiu antes de finalizar e nada foi cobrado. Pode tentar de
                    novo quando quiser.
                </p>

                <Link href="/page/assinatura" className="btn btn-primario mt-6 w-full">
                    Voltar para a assinatura
                </Link>

            </div>

        </PaginaCentrada>
    )
}
