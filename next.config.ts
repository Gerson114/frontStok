import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.23"],
  poweredByHeader: false,

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
