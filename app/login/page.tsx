import type { Metadata } from "next"
import Login from "../components/login/login"

export const metadata: Metadata = {
  title: "Entrar | Arara",
  description: "Acesse o painel administrativo da sua loja.",
}

export default function LoginPage() {
  return <Login />
}
