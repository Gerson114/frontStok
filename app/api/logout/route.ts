import { cookies } from "next/headers"

export async function POST() {
    const cookieStore = await cookies()
    cookieStore.delete("token")

    return Response.json({ mensagem: "logout realizado com sucesso" })
}
