import type { NextConfig } from "next";

/**
 * O endereço do canal ao vivo, que o navegador abre direto — é o único
 * destino fora deste servidor que a página precisa alcançar.
 *
 * Sai do mesmo lugar que o código do painel usa, para a política não bloquear
 * justamente a conexão que a aplicação depende. Vazio não vira "libere tudo":
 * vira nada na lista, e aí o canal simplesmente não é permitido.
 */
const canalAoVivo = (process.env.NEXT_PUBLIC_WS_URL ?? "").trim();

/**
 * O que o navegador pode fazer nesta página.
 *
 * A regra de leitura: tudo o que não está aqui é proibido. `default-src
 * 'self'` fecha a porta, e cada linha abaixo é uma exceção com motivo.
 *
 * `'unsafe-inline'` em script e style é dívida conhecida, e não descuido: o
 * Next injeta o próprio script de inicialização e os estilos direto na
 * página, e tirá-lo exige plumbing de nonce em toda requisição. Com ele, a
 * política ainda barra script vindo de OUTRO domínio, que é o vetor de uma
 * dependência comprometida.
 *
 * As três últimas linhas são as que mais rendem por caractere escrito:
 * `frame-ancestors` mata clickjacking, `form-action 'self'` impede que um
 * formulário injetado poste os dados do lojista em outro servidor, e
 * `base-uri 'self'` impede que uma tag <base> injetada reescreva para onde
 * todos os caminhos relativos apontam.
 */
function politicaDeConteudo(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",

    // Foto de produto e banner podem estar hospedados fora: o lojista cola a
    // URL da imagem. Imagem não executa código, e por isso é a permissão
    // larga mais barata da lista.
    "img-src 'self' data: blob: https:",

    // Para onde a página pode ABRIR conexão: este servidor e o canal ao vivo.
    ["connect-src 'self'", canalAoVivo].filter(Boolean).join(" "),

    // Áudio e vídeo da conversa: o do WhatsApp vem por este servidor, e o da
    // chamada da equipe é montado no navegador como blob.
    "media-src 'self' blob: data:",

    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Os cabeçalhos que toda página do painel leva.
 *
 * HSTS fica de fora de propósito: quem o emite é quem termina o TLS (o proxy
 * da hospedagem, ou o backend nas respostas dele). Mandá-lo daqui em
 * desenvolvimento, onde tudo é http, prenderia `localhost` em https no
 * navegador do desenvolvedor — e isso é chato de desfazer.
 */
function cabecalhosDeSeguranca() {
  return [
    { key: "Content-Security-Policy", value: politicaDeConteudo() },

    // O navegador não adivinha o tipo do arquivo: um .txt que "parece" HTML
    // não passa a ser executado como HTML.
    { key: "X-Content-Type-Options", value: "nosniff" },

    // Redundante com frame-ancestors para navegador atual, e é a versão que
    // os antigos entendem.
    { key: "X-Frame-Options", value: "DENY" },

    // O endereço da tela do painel não vaza para sites de terceiros: ele
    // costuma carregar id de pedido e de cliente no caminho.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

    // Câmera e microfone ficam liberados para a PRÓPRIA página, e não para
    // todo mundo: o painel tem chamada de vídeo com a equipe (ver
    // /page/equipe?chamada=1), e negá-los aqui quebraria justamente ela. O
    // `self` é o que impede um iframe de terceiro de herdar a permissão.
    //
    // Localização o painel não usa — quem usa é a vitrine, para achar a loja
    // mais perto do cliente.
    { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  ];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.23"],
  poweredByHeader: false,

  // Empacota em .next/standalone só o que o servidor precisa em produção,
  // com um server.js próprio. É o que permite a imagem final não levar o
  // node_modules inteiro nem o código-fonte — menos coisa para baixar a cada
  // deploy e menos coisa que possa ser explorada lá dentro, do mesmo jeito
  // que o Dockerfile do backend já fazia com o binário Go.
  output: "standalone",

  // Os cabeçalhos de segurança do PAINEL.
  //
  // O backend já manda os dele, mas eles valem para as respostas da API — e
  // quem o navegador carrega, executa e renderiza é este servidor aqui. Sem
  // estes, a página do painel ia sem política nenhuma.
  //
  // A política é montada em `cabecalhosDeSeguranca` para não repetir a lista
  // em dois lugares e elas divergirem com o tempo.
  async headers() {
    return [
      {
        source: "/:caminho*",
        headers: cabecalhosDeSeguranca(),
      },
    ];
  },

  async redirects() {
    return [
      // A lista de produtos morava em /page/home, nome que não dizia o que a
      // tela é. Mudou para /page/produtos, e este desvio segura o que ficou
      // apontando para o endereço antigo: link salvo pelo lojista, aba
      // aberta desde ontem, atalho na tela do celular.
      //
      // Temporário (307) de propósito: um 301 fica gravado no navegador e
      // seria difícil de desfazer se o endereço mudar de novo.
      {
        source: "/page/home",
        destination: "/page/produtos",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
