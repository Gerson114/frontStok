import Link from "next/link"
import { FiCompass, FiHome } from "react-icons/fi"
import Aviso from "@/app/components/aviso/aviso"

/**
 * Endereço que não existe no painel.
 *
 * Vale para o link velho que alguém guardou nos favoritos, para o produto
 * excluído cuja ficha ainda está aberta noutra aba, e para o erro de
 * digitação na barra do navegador. O menu lateral continua ao lado, então a
 * saída natural já está à vista — o botão é para quem chegou pelo celular,
 * onde o menu está fechado.
 */
export default function NaoEncontrado() {
    return (
        <Aviso
            icone={<FiCompass className="h-7 w-7" />}
            tom="neutro"
            titulo="Esta tela não existe"
            acoes={
                <Link href="/" className="btn btn-primario">
                    <FiHome className="w-4" aria-hidden />
                    <span>Ir para o início</span>
                </Link>
            }
        >
            <p>
                O endereço que você abriu não corresponde a nenhuma tela do painel.
                Ele pode ter mudado de lugar, ou o que estava aqui foi excluído.
            </p>
        </Aviso>
    )
}
