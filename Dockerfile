# Painel administrativo (Next.js) em dois estágios: um constrói, o outro só
# carrega. O código-fonte, o compilador e o node_modules de desenvolvimento
# ficam para trás — o que vai para produção é o servidor mínimo e nada mais.

# ---------------------------------------------------------------------------
# 1. Dependências
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Só os manifestos primeiro: enquanto eles não mudarem, o Docker reaproveita
# esta camada e o build não baixa nada de novo.
COPY package.json package-lock.json ./

# "ci" e não "install": instala exatamente o que está no package-lock, sem
# resolver versões de novo. É o que faz o build de hoje ser igual ao de
# ontem — e o que impede uma dependência nova de entrar sem ninguém pedir.
RUN npm ci

# ---------------------------------------------------------------------------
# 2. Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ATENÇÃO — estas são CONGELADAS aqui dentro.
#
# Variáveis NEXT_PUBLIC_* são substituídas por texto fixo dentro do pacote que
# vai ao navegador, durante o build. Passá-las na hora de subir o container
# não muda nada: o valor que vale é o que estava presente NESTE momento.
#
# Por isso vêm como build-arg e não como environment. Construir sem elas
# publica um painel apontando para localhost — e o próprio painel recusa
# atender assim em produção (ver security/ambiente.ts).
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_VITRINE_URL

# O endereço público do BACKEND, como o mundo o alcança.
#
# Ele não serve para o painel falar com a API — isso é API_URL, lida no
# servidor. Serve para MOSTRAR ao lojista o endereço do webhook que ele vai
# colar no painel da Meta (ver components/whatsapp/conectar.tsx). Sem esta
# variável a tela mostra "https://seu-servidor/public/whatsapp/webhook", o
# lojista cola isso lá, e o WhatsApp da loja nunca recebe mensagem nenhuma —
# sem erro em lugar nenhum, porque do lado de cá não chega nada para falhar.
ARG NEXT_PUBLIC_API_PUBLICA

ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_VITRINE_URL=$NEXT_PUBLIC_VITRINE_URL
ENV NEXT_PUBLIC_API_PUBLICA=$NEXT_PUBLIC_API_PUBLICA
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------------------------------------------------------------------------
# 3. Execução
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário sem privilégio. A imagem do node traz o "node" pronto para isso.
USER node

# O standalone traz o server.js e só as dependências que ele usa de fato.
# public/ e .next/static não vêm junto por padrão (ver a doc de output) — daí
# serem copiados à parte, senão a tela sobe sem CSS nem imagem.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

EXPOSE 3000

# server.js e não "next start": o standalone não traz o CLI do Next.
CMD ["node", "server.js"]
