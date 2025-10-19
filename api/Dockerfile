# ---------- builder ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Instala dependências com cache otimizado
COPY package*.json ./
RUN npm ci

# Copia código e compila
COPY . .
RUN npm run build && npm prune --production


# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

# ---------- VARIÁVEIS DE AMBIENTE ----------
# Funcionalidades PHC
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
    DB_HOST=localhost \
    DB_PORT=1433 \
    DB_USERNAME=sa \
    DB_PASSWORD="N3stJS@2025!" \
    DB_DATABASE=LH \
    DB_ENCRYPT=false \
    DB_TRUST_CERT=true \
    DB_LOGGING=false \
    \
    # CORS e Autenticação
    CORS_ORIGIN="http://localhost:3000,http://localhost:3001" \
    API_BEARER_TOKEN="fekphfewipjhewfpihbo+efwjfivgpewfhi" \
    JWT_SECRET="" \
    JWT_EXPIRES_IN="24h"

# ---------- Segurança / Execução ----------
# Cria user não-root
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# Copia artefactos de produção do builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Expõe a porta
EXPOSE 3000

# Healthcheck simples
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/health || exit 1

USER nodeuser

# Corrigido para apontar ao main.js real
CMD ["node", "dist/src/main.js"]
