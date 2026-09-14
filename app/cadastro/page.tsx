import type { Metadata } from "next"
import Cadastro from "../components/cadastro/cadastro"
import { tituloDaAba } from "@/app/marca"

export const metadata: Metadata = {
  title: tituloDaAba("Criar conta"),
  description: "Crie sua conta para gerenciar o estoque e a vitrine da sua loja.",
}

export default function CadastroPage() {
  return <Cadastro />
}
