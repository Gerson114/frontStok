import type { Metadata } from "next"
import Cadastro from "../components/cadastro/cadastro"

export const metadata: Metadata = {
  title: "Criar conta | Minha Loja",
  description: "Crie sua conta para gerenciar o estoque e a vitrine da sua loja.",
}

export default function CadastroPage() {
  return <Cadastro />
}
