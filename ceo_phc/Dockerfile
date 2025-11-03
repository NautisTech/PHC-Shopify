# ================================
# STAGE 1: Dependencies
# ================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copia package files
COPY package*.json ./

# Instala dependências de produção
RUN npm ci && \
    npm cache clean --force

# ================================
# STAGE 2: Builder
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copia package files
ENV NODE_ENV=development
COPY package*.json ./

# Instala todas as dependências (incluindo dev)
RUN npm ci

# Copia código fonte
COPY . .

ENV TEM_LOTES=0 \
    TEM_ARMAZENS=0 \
    TEM_GESTAO_STOCKS=0 \
    TEM_NUMEROS_SERIES=0 \
    TEM_CAMPOS_PERSONALIZADOS=1 \
    ARMAZEM_DEFAULT=0 \
    DEPOSITO_DEFAULT=0 \
    TIPO_DOC_VENDA=0 \
    TIPO_DOC_COMPRA=0 \
    TIPO_DOC_STOCK=0 \
    \
    # Servidor
    PORT=3000 \
    NODE_ENV=development \
    \
    # Base de Dados SQL Server
    DB_HOST=62.28.239.206 \
    DB_PORT=4000 \
    DB_USERNAME=sa \
    DB_PASSWORD="Microlop3s@2025!" \
    DB_DATABASE=phc \
    DB_ENCRYPT=false \
    DB_TRUST_CERT=true \
    DB_LOGGING=false \
    \
    # CORS e Autenticação
    API_BEARER_TOKEN="fekphfewipjhewfpihbo+efwjfivgpewfhi" \
    JWT_SECRET="" \
    JWT_EXPIRES_IN="24h"

# Build da aplicação
RUN npm run build

# ================================
# STAGE 3: Runner (Produção)
# ================================
FROM node:20-alpine AS runner

WORKDIR /app

# Instala dumb-init para proper signal handling
RUN apk add --no-cache dumb-init

# Cria user não-root
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# Copia dependências de produção do stage deps
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copia artefactos de produção do builder
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/package*.json ./

# Cria diretório uploads e garante permissões
RUN mkdir -p /app/uploads && \
    chown -R nodeuser:nodejs /app && \
    chmod -R 755 /app/uploads

# Define variáveis de ambiente
ENV PORT=3000

# Expõe porta (Caprover usa 3000 internamente)
EXPOSE 3000

# Muda para user não-root
USER nodeuser

# Usa dumb-init para proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Comando para iniciar a aplicação
CMD ["node", "dist/main.js"]