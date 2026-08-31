import { apiFetch } from "./client"
import type { Banner } from "@/app/type/type"
import type { NovoBanner } from "@/security/validate"

interface RespostaListaBanners {
    banners: Banner[]
}

interface RespostaBanner {
    mensagem: string
    banner: Banner
}

export async function listarBanners(): Promise<Banner[]> {
    const dados = await apiFetch<RespostaListaBanners>("/api/banners")
    return Array.isArray(dados.banners) ? dados.banners : []
}

export async function criarBanner(banner: NovoBanner): Promise<Banner> {
    const dados = await apiFetch<RespostaBanner>("/api/banners", {
        method: "POST",
        body: banner,
    })
    return dados.banner
}

export async function editarBanner(id: number, banner: NovoBanner): Promise<Banner> {
    const dados = await apiFetch<RespostaBanner>(`/api/banners/${id}`, {
        method: "PUT",
        body: banner,
    })
    return dados.banner
}

export async function excluirBanner(id: number): Promise<void> {
    await apiFetch<{ mensagem: string }>(`/api/banners/${id}`, {
        method: "DELETE",
    })
}
