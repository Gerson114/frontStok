import { repassarEndereco } from "@/app/api/enderecos/route"

// POST /api/enderecos/estrutura — monta a malha de endereços de uma vez.
//
// Quem valida os números, recusa a estrutura grande demais e pula o que já
// existe é o backend; aqui só se repassa o que o formulário montou.
export async function POST(request: Request) {
    const corpo = await request.json().catch(() => ({}))
    return repassarEndereco("POST", "/estrutura", corpo ?? {})
}
