import { repassarAoBackend } from "@/app/api/backend"

// GET /api/conferencias — as contagens já fechadas, da mais recente para a
// mais antiga. É a auditoria do que foi conferido; fechar uma contagem nova
// continua sendo POST /api/conferencia.
export async function GET() {
    return repassarAoBackend("GET", "/private/conferencias")
}
