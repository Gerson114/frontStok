// Autenticação: login vai direto para o backend (ele quem define o cookie
// httpOnly "token"); logout passa pela rota interna /api/logout, já que só
// o servidor Next consegue apagar um cookie httpOnly.

import { sanitizeEmail } from "@/security/sanitize"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export async function login(email: string, password: string): Promise<void> {
    const response = await fetch(`${API_BASE}/public/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
            email: sanitizeEmail(email),
            Password: password,
        }),
    })

    if (!response.ok) {
        throw new Error("Email ou senha inválidos")
    }
}

export async function logout(): Promise<void> {
    await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
    })
}
