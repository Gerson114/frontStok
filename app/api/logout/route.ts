import { cookies } from "next/headers"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { conta } from "@/app/api/rotas"


// POST /api/logout — encerra a sessão do lojista.
//
// Apagar o cookie daqui é a parte fácil, e sozinha ela não encerra nada: o
// token é um JWT, vale porque a assinatura confere, e o servidor não guarda os
// que emitiu. Quem tivesse uma cópia dele continuava entrando pelas horas
// seguintes, mesmo com o lojista vendo a tela de login.
//
// Por isso a saída passa pelo backend, que incrementa a versão do token da
// loja e derruba toda cópia que exista (ver internal/services/login/logout.go).
// O cookie some depois, dos dois jeitos — mas o resultado da revogação é
// reportado como veio, porque "saiu" e "achou que saiu" não são a mesma coisa.
export async function POST() {

    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    let revogado = false

    if (token) {
        try {
            const response = await fetch(url(conta.logout()), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(await cabecalhoDaLojaAberta()),
                    Accept: "application/json",
                },
                cache: "no-store",
            })

            // 401 conta como sucesso: o token já não vale (expirou, ou outra
            // aba saiu antes), que é exatamente o estado que se queria.
            revogado = response.ok || response.status === 401

        } catch {
            revogado = false
        }
    } else {
        // Sem token não há o que revogar — sair já é o estado atual.
        revogado = true
    }

    // O cookie sai mesmo quando a revogação falhou: deixá-lo seria manter
    // esta aba usando um token que o lojista pediu para matar.
    cookieStore.delete("token")

    if (!revogado) {
        return Response.json(
            { erro: "Não foi possível encerrar a sessão no servidor. Tente de novo." },
            { status: 502, headers: { "Cache-Control": "no-store" } }
        )
    }

    return Response.json(
        { mensagem: "logout realizado com sucesso" },
        { headers: { "Cache-Control": "no-store" } }
    )
}
