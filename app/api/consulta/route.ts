import { cookies } from "next/headers"

const API_BASE = process.env.API_URL ?? "http://localhost:8080"

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
            `${API_BASE}/private/consulta`,
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