import { repassar } from "../proxy"

// POST /api/whatsapp/bilhete — a senha de um minuto que a tela apresenta ao
// abrir o WebSocket.
//
// Existe porque o navegador não deixa mandar cabeçalho Authorization ao
// abrir um socket, e o token do lojista está num cookie desta origem, não na
// do backend. Então a prova de identidade acontece aqui, por HTTP normal, e
// o socket só recebe o bilhete.
export async function POST() {
    return repassar("POST", "/whatsapp/bilhete")
}
