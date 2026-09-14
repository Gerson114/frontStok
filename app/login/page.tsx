import type { Metadata } from "next"
import Login from "../components/login/login"
import { tituloDaAba } from "@/app/marca"

export const metadata: Metadata = {
  title: tituloDaAba("Entrar"),
  description: "Acesse o painel administrativo da sua loja.",
}

export default function LoginPage() {
  return <Login />
}
