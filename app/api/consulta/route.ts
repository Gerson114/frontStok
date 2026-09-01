import { cookies } from "next/headers"
import { url } from "@/app/api/backend"
import { produtos } from "@/app/api/rotas"


export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json(
                { erro: "Não autenticado" },
                { status: 401 }
            )
        }

        const response = await fetch(
            url(produtos.consultar()),
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
                cache: "no-store",
            }
        )

        const texto = await response.text()

        if (!response.ok) {
            return Response.json(
                { erro: "Não foi possível consultar os produtos" },
                { status: response.status }
            )
        }

        try {
            const data = JSON.parse(texto)

            return Response.json(data, {
                status: 200,
                headers: {
                    "Cache-Control": "no-store",
                },
            })
        } catch {
            return Response.json(
                { erro: "Resposta inválida do servidor" },
                { status: 502 }
            )
        }

    } catch {
        return Response.json(
            { erro: "Erro interno do servidor" },
            { status: 500 }
        )
    }
}