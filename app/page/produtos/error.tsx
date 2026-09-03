"use client"

import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi"
import Aviso from "@/app/components/aviso/aviso"

/**
 * A grade de produtos não conseguiu carregar.
 *
 * Substitui o ramo `if (erro)` que a tela carregava por dentro. A diferença
 * que importa não é de desenho, é de alcance: aquele só pegava o erro que a
 * própria tela sabia capturar, no `catch` da busca. Este pega qualquer falha
 * do trecho — a busca no servidor, um dado que veio de um jeito que a grade
 * não esperava, um componente que quebrou ao desenhar.
 *
 * O botão refaz a busca no servidor. Antes o "tentar novamente" era um
 * `window.location.reload()`, que recarregava o painel inteiro — menu,
 * fontes e todo o resto — para tornar a pedir duas listas.
 */
export default function ErroProdutos({
    error,
    retry,
}: {
    error: Error & { digest?: string }
    retry: () => void
}) {
    return (
        <Aviso
            icone={<FiAlertTriangle className="h-7 w-7" />}
            titulo="Erro ao carregar produtos"
            acoes={
                <button type="button" onClick={() => retry()} className="btn btn-primario">
                    <FiRefreshCw className="w-4" aria-hidden />
                    <span>Tentar novamente</span>
                </button>
            }
            rodape={
                error.digest ? (
                    <p className="text-xs text-[#8C969B]">
                        Código do erro: <span className="num font-bold">{error.digest}</span>
                    </p>
                ) : undefined
            }
        >
            <p>
                Não foi possível trazer a lista de produtos do servidor. O estoque
                está intacto — é a leitura que falhou, e nada foi alterado.
            </p>
        </Aviso>
    )
}
