import { repassarAoBackend } from "@/app/api/backend"
import { adicionais } from "@/app/api/rotas"

/** O catálogo inteiro da loja: grupos, opções e a que produtos cada um está ligado. */
export async function GET() {
    return repassarAoBackend("GET", adicionais.catalogo())
}
