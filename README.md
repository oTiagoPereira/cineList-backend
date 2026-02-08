# CineList Backend

## Visão Geral

API RESTful Node.js/Express para sistema de recomendação e gerenciamento de filmes. Integra autenticação JWT via Authorization Bearer, Google OAuth 2.0, consumo da API TMDB (The Movie Database) e **recomendações personalizadas com IA (Google Gemini)**. Gerenciamento completo de lista pessoal de filmes com status de assistido/favorito.

## Principais Tecnologias

- **Runtime**: Node.js
- **Framework**: Express 5.x
- **ORM**: Prisma com SQLite
- **Autenticação**: JWT (Bearer Token) + Passport.js (Google OAuth 2.0)
- **Integrações**:
  - TMDB API v3/v4 (dados de filmes)
  - Google Gemini 2.5 Flash (recomendações com IA)
  - Resend API (envio de emails)
- **Documentação**: Swagger UI + OpenAPI 3.0 (/api/docs)
- **Validação**: Express-validator
- **Segurança**: bcryptjs, CORS configurável, JWT tokens

## Estrutura de Pastas

```
backend/
├── app.js                      # Bootstrap da aplicação / middlewares globais / CORS / Swagger
├── Dockerfile                  # Container Docker para deploy
├── package.json                # Dependências e scripts
├── .env.example                # Template de variáveis de ambiente
├── docs/
│   └── openapi.yaml            # Especificação OpenAPI 3.0 (Swagger)
├── prisma/
│   ├── schema.prisma           # Modelos do banco de dados
│   └── migrations/             # Histórico de migrações SQL
│       └── 20260201192604_init_sqlite/
│           └── migration.sql
└── src/
    ├── config/
    │   ├── mailer.js           # Configuração Resend (envio de emails)
    │   └── passport.js         # Estratégia Google OAuth 2.0
    ├── controllers/
    │   ├── authController.js           # Lógica de autenticação e recuperação de senha
    │   ├── moviesController.js         # Proxy TMDB (populares, busca, detalhes)
    │   ├── recommendationController.js # IA Gemini (recomendações personalizadas)
    │   └── userMoviesController.js     # CRUD lista de filmes do usuário
    ├── middlewares/
    │   ├── authCookieMiddleware.js # Extração e validação de JWT (cookie ou header)
    │   └── authMiddleware.js       # (opcional/legacy) validação JWT via header
    ├── routes/
    │   ├── authRoute.js            # Rotas /api/auth/*
    │   ├── moviesRoute.js          # Rotas /api/movies/*
    │   ├── recommendationRoute.js  # Rotas /api/recommendation/*
    │   └── userMoviesRoute.js      # Rotas /api/user/movies/*
    ├── services/
    │   └── moviesService.js        # Integração com TMDB API (axios requests)
    └── validations/
        └── authValidator.js        # Regras express-validator (register, login, etc)
```

### Padrão de Arquitetura

- **Routes**: Define endpoints e middlewares de autenticação
- **Controllers**: Lógica de negócio e orquestração
- **Services**: Integrações externas (TMDB, Gemini) e lógica reutilizável
- **Middlewares**: Validação, autenticação, logging
- **Config**: Configuração de bibliotecas (Passport, Mailer)
- **Validations**: Schemas de validação de entrada

## Fluxo de Autenticação

### Registro e Login Tradicional

1. **Registro** (`POST /api/auth/register`):
   - Valida campos obrigatórios (nome, email, senha)
   - Verifica se email já existe (409 Conflict se sim)
   - Hash da senha com bcryptjs (12 salt rounds)
   - Cria usuário no banco
   - ⚠️ **Não loga automaticamente** - usuário deve fazer login após registro

2. **Login** (`POST /api/auth/login`):
   - Valida email/senha
   - Compara senha com bcrypt
   - Gera JWT (payload: `id`, `email`, `name`) com expiração de 1 dia
   - Retorna token no body JSON (frontend armazena em localStorage ou sessionStorage)

   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "id": "uuid-aqui",
       "name": "João Silva",
       "email": "joao@example.com"
     }
   }
   ```

3. **Autenticação de Requisições**:
   - Middleware `authCookieMiddleware` (nome histórico, não usa cookies) extrai JWT do header:
     - `Authorization: Bearer <token>`
   - Valida assinatura JWT com `JWT_SECRET`
   - Anexa dados do usuário em `req.user`
   - ⚠️ **Apenas Authorization header** - não aceita cookies

4. **Verificar Sessão** (`GET /api/auth/me`):
   - Retorna dados do usuário autenticado
   - Frontend usa para manter estado de login

5. **Logout** (`POST /api/auth/logout`):
   - Backend apenas confirma (stateless)
   - Frontend deve limpar token do storage

### Google OAuth 2.0

1. **Iniciar Fluxo** (`GET /api/auth/google`):
   - Redireciona para tela de consentimento do Google
   - Scope: `profile` e `email`

2. **Callback** (`GET /api/auth/google/callback`):
   - Google retorna authorization code
   - Passport troca code por access token e obtém dados do usuário
   - Backend:
     - Se `googleId` já existe → faz login do usuário existente
     - Se não existe → cria novo usuário (senha aleatória, pois não será usada)
   - Gera JWT e redireciona para: `CLIENT_URL/auth/success?token=<jwt>`

3. **Frontend**:
   - Extrai token da URL
   - Armazena em cookie/localStorage
   - Redireciona para dashboard

### Alteração de Senha

- Requer autenticação (`POST /api/auth/change-password`)
- Valida senha atual
- Verifica que nova senha é diferente
- Atualiza hash no banco

## Variáveis de Ambiente (.env)

| Nome                 | Descrição                                         | Obrigatório |
| -------------------- | ------------------------------------------------- | ----------- |
| PORT                 | Porta do servidor (padrão: 5000)                  | Não         |
| NODE_ENV             | Ambiente de execução (development/production)     | Não         |
| CLIENT_URL           | Origem permitida CORS (ex: http://localhost:3030) | Sim         |
| JWT_SECRET           | Segredo para assinar tokens JWT                   | Sim         |
| DATABASE_URL         | URL do banco SQLite (ex: file:./prisma/dev.db)    | Sim         |
| GOOGLE_CLIENT_ID     | OAuth Google Client ID                            | Sim         |
| GOOGLE_CLIENT_SECRET | OAuth Google Client Secret                        | Sim         |
| GOOGLE_CALLBACK_URL  | URL de callback OAuth Google                      | Sim         |
| BASE_URL             | Base pública do backend (para callback OAuth)     | Sim         |
| TMDB_API_KEY         | Chave API TMDB v3                                 | Sim         |
| TMDB_API_AUTH        | Token Bearer TMDB v4 (read access token)          | Sim         |
| GEMINI_API_KEY       | Chave API Google Gemini para recomendações IA     | Sim         |
| RESEND_API_KEY       | Chave da API Resend para envio de emails          | Sim         |
| MAIL_FROM            | Remetente padrão (ex: CineList <onboarding@...>)  | Sim         |

📚 **Documentação completa e interativa em `/api/docs` (Swagger UI).**

### 🔐 Auth (`/api/auth`)

| Método | Endpoint           | Autenticação | Descrição                                        |
| ------ | ------------------ | ------------ | ------------------------------------------------ |
| POST   | `/register`        | ❌ Não       | Cria nova conta de usuário                       |
| POST   | `/login`           | ❌ Não       | Login com email/senha (retorna token JWT)        |
| GET    | `/google`          | ❌ Não       | Inicia fluxo OAuth 2.0 Google                    |
| GET    | `/google/callback` | ❌ Não       | Callback OAuth Google (gera token e redireciona) |
| GET    | `/me`              | ✅ Sim       | Retorna dados do usuário autenticado             |
| POST   | `/change-password` | ✅ Sim       | Altera senha do usuário logado                   |
| POST   | `/logout`          | ❌ Não       | Limpa sessão (frontend deve limpar token)        |
| POST   | `/forgot-password` | ❌ Não       | Envia email com link de recuperação de senha     |
| POST   | `/reset-password`  | ❌ Não       | Redefine senha usando token recebido por email   |

### 🎬 Movies (`/api/movies`) - Proxy TMDB

| Método | Endpoint               | Descrição                                    |
| ------ | ---------------------- | -------------------------------------------- |
| GET    | `/populares?page=1`    | Filmes populares (paginado)                  |
| GET    | `/top-rated?page=1`    | Filmes melhor avaliados (paginado)           |
| GET    | `/details/:id`         | Detalhes completos de um filme (por TMDB ID) |
| GET    | `/streaming/:id`       | Opções de streaming disponíveis (BR/US)      |
| GET    | `/similar/:id`         | Filmes similares ao ID informado             |
| GET    | `/genres`              | Lista todos os gêneros disponíveis           |
| GET    | `/by-genre/:id?page=1` | Filmes de um gênero específico (paginado)    |
| GET    | `/search/:query`       | Busca filmes por título/palavra-chave        |

### 📝 User Movies (`/api/user/movies`) - Autenticado

| Método   | Endpoint                  | Descrição                                             |
| -------- | ------------------------- | ----------------------------------------------------- |
| POST     | `/`                       | Salva filme na lista do usuário (Body: `{ "movieId": 123 }`) |
| GET      | `/`                       | Lista todos os filmes salvos (IDs e status)           |
| GET      | `/details`                | Lista todos os filmes salvos (com detalhes completos) |
| DELETE   | `/:id`                    | Remove um filme da lista (ID do TMDB)                 |
| PATCH    | `/:id`                    | Alterna status de assistido (falso/verdadeiro)        |
| GET      | `/:id/status`             | Verifica se filme está salvo e se foi assistido       |

### 🤖 Recommendation (`/api/recommendation`)

| Método   | Endpoint                  | Descrição                                             |
| -------- | ------------------------- | ----------------------------------------------------- |
| POST     | `/`                       | Gera recomendações personalizadas usando IA Gemini    |

**Exemplo de payload para recomendação:**

```json
{
  "mode": "single",
  "preferences": {
    "user1": {
      "genres": ["Ação", "Ficção Científica"],
      "actors": ["Keanu Reeves"],
      "directors": ["Christopher Nolan"],
      "other": "Filmes com reviravolta no final"
    }
  }
}
```

Para modo `couple`, adicione `user2` com mesmas propriedades:

```json
{
  "mode": "couple",
  "preferences": {
    "user1": {
      "genres": ["Terror"],
      "actors": [],
      "directors": [],
      "other": ""
    },
    "user2": {
      "genres": ["Comédia"],
      "actors": ["Ryan Reynolds"],
      "directors": [],
      "other": ""
    }
  }
}
```

A IA retorna até 12 filmes, enriquecidos automaticamente com:

- Detalhes completos da TMDB (sinopse, elenco, nota, duração)
- Plataformas de streaming disponíveis (BR/US)
- Pôster, data de lançamento, gêneros

## Modelo Prisma (Schema de Dados)

```prisma
model User {
  id       String   @id @default(uuid())
  name     String
  email    String   @unique
  password String
  googleId String?  @unique
  movies   UserMovie[]
  passwordResetTokens PasswordResetToken[]
}

model UserMovie {
  id          String   @id @default(uuid())
  userId      String
  movieTmdbId Int
  watched     Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, movieTmdbId])
  @@index([userId])
  @@index([movieTmdbId])
}

model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([expiresAt])
}
```

**Constraints e Índices:**

- `User.email` e `User.googleId` são únicos
- `UserMovie` tem constraint único em `[userId, movieTmdbId]` (usuário não pode salvar mesmo filme 2x)
- Índices otimizados para consultas por `userId` e `movieTmdbId`
- Cascade delete: remover usuário remove seus filmes e tokens automaticamente

## 🚀 Funcionalidades Principais

### 1. **Autenticação Completa**

- Registro e login tradicional com bcrypt (12 rounds)
- Login social via Google OAuth 2.0 (Passport.js)
- JWT via Authorization Bearer header (token retornado no body JSON)
- Recuperação de senha com envio de email via Resend
- Tokens de reset com expiração de 1h e proteção contra reutilização

### 2. **Integração TMDB**

- Proxy completo para API TMDB (v3/v4)
- Filmes populares, top-rated, por gênero, busca
- Detalhes completos + streaming providers (BR/US)
- Filmes similares para cada título
- Cache-friendly (pode adicionar Redis futuramente)

### 3. **Gerenciamento de Lista Pessoal**

- Salvar filmes favoritos (constraint único por usuário)
- Marcar como assistido/não assistido
- Listar filmes salvos (IDs ou detalhes completos)
- Verificar status de um filme específico
- Remover da lista

### 4. **Recomendações com IA (Google Gemini 2.5 Flash)**

- Modo individual: baseado em preferências pessoais
- Modo casal: equilibra gostos de duas pessoas
- Entrada flexível: gêneros, atores, diretores, descrição livre
- Retorna até 12 filmes populares e atuais
- Enriquecimento automático com dados TMDB + streaming
- Resposta estruturada em JSON para fácil integração frontend

### 5. **Envio de Emails**

- Integração com Resend API
- Template customizável para reset de senha
- Fallback para console em desenvolvimento (logs)
- Suporte a domínios customizados (após verificação no Resend)

## 📋 Próximas Melhorias

- [ ] Adicionar testes automatizados (Jest + Supertest) para auth e user movies
- [ ] Implementar refresh token (rotação automática de JWT)
- [ ] Cache em memória (Redis) para rotas TMDB populares/top-rated
- [ ] Limpeza automática de tokens de reset expirados (cron job)
- [ ] Rate limiting por IP (express-rate-limit) especialmente em forgot-password
- [🛠️ Como Rodar Localmente

### Pré-requisitos

- Node.js 18+ e npm
- Contas configuradas:
  - [TMDB API](https://www.themoviedb.org/settings/api) (gratuita)
  - [Google Cloud Console](https://console.cloud.google.com/) (OAuth credentials)
  - [Google AI Studio](https://makersuite.google.com/app/apikey) (Gemini API key)

### Setup

1. **Clone e instale dependências:**

   ```bash
   cd backend
   npm install
   NODE_ENV=development

   # Database (SQLite)
   DATABASE_URL="file:./prisma/dev.db"

   # Authentication
   JWT_SECRET="seu_segredo_super_secreto_aqui"

   # CORS
   CLIENT_URL="http://localhost:3030"
   BASE_URL="http://localhost:5000"

   # Google OAuth
   GOOGLE_CLIENT_ID="seu_client_id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="seu_client_secret"
   GOOGLE_CALLBACK_URL="http://localhost:5000/api/auth/google/callback"

   # TMDB API
   TMDB_API_KEY="sua_chave_tmdb_v3"
   TMDB_API_AUTH="seu_token_bearer_tmdb_v4"

   # Gemini AI
   GEMINI_API_KEY="sua_chave_gemini"

   MAIL_FROM="CineList <onboarding@resend.dev>
   TMDB_API_KEY=sua_chave_tmdb_v3
   TMDB_API_AUTH=seu_token_bearer_tmdb_v4

   GEMINI_API_KEY=sua_chave_gemini

   # Opcional (deixe vazio para logs no console)
   RESEND_API_KEY=
   MAIL_FROM="CineList <onboarding@resend.dev>"
   APP_NAME="CineList"
   ```

2. **Configure o banco de dados:**

   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

3. **Inicie o servidor:**

   ```bash
   npm run dev
   ```

4. **Acesse a documentação:**
   - Swagger UI: http://localhost:5000/api/docs
   - API base: http://localhost:5000

### Comandos úteis

````bash
npm start              # Produção (sem hot reload)
npm run dev            # Desenvolvimento (nodemon)
npx prisma studio      # Interface visual do banco de dados
np**Migrar SQLite → PostgreSQL/MySQL** para produção (alterar `DATABASE_URL` e provider no schema.prisma)
- Rodar migrations: `npx prisma migrate deploy`
- Configurar **HTTPS** (Nginx/Caddy como proxy reverso)
- Variáveis de ambiente em **secrets manager** (nunca commit .env)
- Adicionar **rate limiting** (express-rate-limit)
- Logs estruturados (Winston/Pino)
- Monitoramento (PM2, New Relic, Datadog)
- **API keys** válidas e com limites adequados (TMDB, Gemini, Resend)

### Migração para PostgreSQL:

1. **Alterar schema.prisma:**
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
````

2. **Atualizar DATABASE_URL:**

   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/cinelist?schema=public"
   ```

3. **Rodar migrations:**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init_postgresql
   ```

### Exemplo com Docker em Produção:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 5000
CMD ["npm", "start"]
```

```bash
docker build -t cinelist-backend .
docker run -p 5000:5000 --env-file .env.production cinelist-backend
```

## 📦 Deploy em Produção

### Recomendações:

- Migrar de SQLite para PostgreSQL (alterar `DATABASE_URL`)
- Rodar migrations: `npx prisma migrate deploy`
- Configurar HTTPS (Nginx/Caddy como proxy reverso)
- Configurar variáveis de ambiente seguras (secrets manager)
- Adicionar rate limiting (express-rate-limit)
- Configurar logs estruturados
- Monitoramento (PM2, New Relic, Datadog)
- CDN para assets estáticos (se houver)

### Exemplo de DATABASE_URL para PostgreSQL:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/cinelist?schema=public"
```

Lembre-se de rodar `npx prisma generate` após alterar o provider no `schema.prisma`.

## 🤖 Como Funciona a Recomendação com IA

### Arquitetura da Recomendação

1. **Entrada do Usuário** → Frontend coleta preferências:

   ```json
   {
     "mode": "single",
     "preferences": {
       "user1": {
         "genres": ["Ficção Científica", "Thriller"],
         "actors": ["Leonardo DiCaprio", "Tom Hardy"],
         "directors": ["Christopher Nolan"],
         "other": "Filmes complexos com reviravolta"
       }
     }
   }
   ```

2. **Prompt Engineering** → Backend constrói prompt otimizado:

   ```
   Aja como um especialista em cinema. Quero 12 recomendações de filmes populares
   (amplamente conhecidos), sem limitar por ano. Responda em pt-BR.

   Minhas preferências:
   Gêneros: Ficção Científica, Thriller.
   Atores/Atrizes: Leonardo DiCaprio, Tom Hardy.
   Diretores: Christopher Nolan.
   Outras preferências: Filmes complexos com reviravolta.

   Retorne APENAS JSON válido (application/json), exatamente neste formato:
   {
     "movies": [
       { "title": "Nome do Filme" },
       { "title": "Outro Filme" }
     ]
   }
   ```

3. **Google Gemini 2.5 Flash** → Gera lista de filmes:

   ```json
   {
     "movies": [
       { "title": "Inception" },
       { "title": "Shutter Island" },
       { "title": "Interstellar" }
       // ... até 12 filmes
     ]
   }
   ```

4. **Enriquecimento TMDB** → Para cada filme:
   - Busca por título na TMDB → prioriza por popularidade
   - Obtém detalhes completos (sinopse, elenco, nota, duração)
   - Busca plataformas de streaming (BR/US)
   - Retorna objeto unificado:

   ```json
   {
     "id": 27205,
     "title": "Inception",
     "overview": "Dom Cobb é um ladrão com a rara habilidade...",
     "genres": [
       { "id": 28, "name": "Ação" },
       { "id": 878, "name": "Ficção científica" }
     ],
     "poster_path": "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
     "release_date": "2010-07-16",
     "vote_average": 8.367,
     "runtime": 148,
     "streaming": {
       "flatrate": [{ "provider_name": "Netflix", "logo_path": "/path.jpg" }]
     }
   }
   ```

5. **Resposta Final** → 12 filmes enriquecidos prontos para o frontend exibir

### Modo Casal (`mode: "couple"`)

Equilibra preferências de duas pessoas:

```json
{
  "mode": "couple",
  "preferences": {
    "user1": {
      "genres": ["Terror", "Suspense"],
      "actors": [],
      "directors": [],
      "other": ""
    },
    "user2": {
      "genres": ["Comédia", "Romance"],
      "actors": ["Ryan Reynolds"],
      "directors": [],
      "other": ""
    }
  }
}
```

Gemini retorna filmes que misturam elementos de ambos (ex: comédia de terror, romance com suspense).

### Limitações e Custos

- **Gemini**: 15 requisições/minuto (free tier) | 1.500 req/dia
- **TMDB**: 40 req/10s | 500.000 req/dia (gratuito)
- Para produção, considere:
  - Cache de recomendações (Redis) por haToken ausente ou inválido | Re-login e verificar se header Authorization foi enviado |
    | 401 | "Token inválido ou expirado"| JWT expirado (>1 dia) ou inválido | Fazer login novamente para obter novo token |
    | 409 | "Email já está em uso" | Email já cadastrado | Usar endpoint `/api/auth/login` ao invés de register |
    | 400 | Validação falhou | Campos obrigatórios faltando | Conferir payload com documentação Swagger |
    | 500 | Erro TMDB | Token TMDB inválido | Revisar `TMDB_API_AUTH` e `TMDB_API_KEY` no .env |
    | 500 | Erro Gemini | API key inválida ou quota excedida| Verificar `GEMINI_API_KEY` e quota em AI Studio |
    | 500 | Erro ao enviar email | RESEND_API_KEY inválida | Verificar chave no dashboard do Resend |
    | 404 | Filme não encontrado | ID inválido ou filme não existe | Verificar ID do filme na TMDB |
    | 502 | Serviço de busca indisponível| TMDB API offline ou rate limit | Aguardar ou verificar status da TMDB |
    | CORS | Bloqueio de origem | Frontend em origem não permitida | Adicionar origem em `CLIENT_URL` ou `allowedOrigins` |

### Debug de Autenticação

**Token não reconhecido:**

```bash
# Decodificar JWT online: https://jwt.io
# Verificar:
# - Não expirou (campo 'exp')
# - Assinatura válida com JWT_SECRET correto
# - Header Authorization: Bearer <token> está sendo enviado
```

**Frontend não consegue acessar rotas protegidas:**

````javascript
// Exemplo correto de requisição autenticada
fetch('http://localhost:5000/api/user/movies', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}
### Debug de Autenticação

**Token não reconhecido:**
```bash
# Decodificar JWT online: https://jwt.io
# Verificar:
# - Não expirou (campo 'exp')
# - Assinatura válida com JWT_SECRET correto
# - Header Authorization: Bearer <token> está sendo enviado
````

**Frontend não consegue acessar rotas protegidas:**

```javascript
// Exemplo correto de requisição autenticada
const token = localStorage.getItem("token"); // ou sessionStorage

fetch("http://localhost:5000/api/user/movies", {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});
```

**Google OAuth não funciona:**

```bash
# Verificar:
# 1. GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET corretos
# 2. Callback URL registrada no Google Cloud Console:
#    http://localhost:5000/api/auth/google/callback
# 3. GOOGLE_CALLBACK_URL no .env corresponde exatamente
# 4. BASE_URL configurado corretamente
```

**Email de recuperação não é enviado:**

```bash
# Verificar:
# 1. RESEND_API_KEY válida (re_...)
# 2. MAIL_FROM configurado corretamente
# 3. Logs no console para ver erros de envio
# 4. Em desenvolvimento, o link aparece no console e no response
```

### Logs Úteis

Ative logs detalhados adicionando em `app.js`:

```javascript
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});
```

## 📊 Exemplos de Uso da API

### Autenticação Completa

**1. Registrar usuário:**

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "password": "senha123"
  }'
```

**2. Fazer login:**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@example.com",
    "password": "senha123"
  }'

# Resposta:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-aqui",
    "name": "João Silva",
    "email": "joao@example.com"
  }
}
```

**3. Acessar rota protegida:**

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Buscar e Salvar Filmes

**1. Buscar filmes populares:**

```bash
curl http://localhost:5000/api/movies/populares?page=1
```

**2. Buscar por título:**

```bash
curl http://localhost:5000/api/movies/search/inception
```

**3. Salvar na lista (autenticado):**

```bash
curl -X POST http://localhost:5000/api/user/movies \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "movieId": 27205
  }'
```

**4. Marcar como assistido:**

```bash
curl -X PATCH http://localhost:5000/api/user/movies/27205 \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Obter Recomendações com IA

```bash
curl -X POST http://localhost:5000/api/recommendation \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "single",
    "preferences": {
      "user1": {
        "genres": ["Ação", "Ficção Científica"],
        "actors": ["Keanu Reeves"],
        "directors": [],
        "other": "Filmes futuristas"
      }
    }
  }'

# Resposta: 12 filmes enriquecidos com detalhes TMDB + streaming
```

## 🔗 Integrações de APIs Externas

### TMDB (The Movie Database)

**Setup:**

1. Criar conta em https://www.themoviedb.org/
2. Ir em **Settings → API**
3. Copiar **API Key (v3)** → `TMDB_API_KEY`
4. Criar **Read Access Token (v4)** → `TMDB_API_AUTH`

**Endpoints usados:**

- `/movie/popular` - Filmes populares
- `/movie/{id}` - Detalhes de um filme
- `/movie/{id}/watch/providers` - Streaming providers
- `/movie/{id}/similar` - Filmes similares
- `/genre/movie/list` - Lista de gêneros
- `/search/movie` - Busca por título
- `/discover/movie` - Descobrir filmes por gênero

**Rate Limits:**

- 40 requisições a cada 10 segundos
- 500.000 requisições por dia (gratuito)

### Google Gemini AI

**Setup:**

1. Acessar https://makersuite.google.com/app/apikey
2. Criar novo projeto ou selecionar existente
3. Gerar API Key → `GEMINI_API_KEY`

**Modelo usado:**

- `gemini-2.5-flash` - Rápido, econômico, JSON mode

**Configuração especial:**

```javascript
{
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    responseMimeType: "application/json" // Força resposta JSON válida
  }
}
```

**Rate Limits (Free):**

- 15 requisições por minuto
- 1.500 requisições por dia
- 1 milhão de tokens por minuto

### Resend Email API

**Setup:**

1. Criar conta em https://resend.com
2. Criar API Key → `RESEND_API_KEY`
3. (Opcional) Verificar domínio próprio para emails profissionais

**Limitações Free:**

- 100 emails/dia com `onboarding@resend.dev`
- 3.000 emails/mês com domínio verificado

## 🤝 Contribuindo

Contribuições são bem-vindas! Para mudanças grandes, abra uma issue primeiro para discutir o que você gostaria de mudar.

**Como contribuir:**

1. Fork o projeto
2. Crie uma branch de feature (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

**Antes de enviar PR:**

- [ ] Código segue padrão do projeto
- [ ] Adicionou/atualizou documentação relevante
- [ ] Testou localmente
- [ ] Nenhum dado sensível (API keys, senhas) no código

## 📄 Licença

Este projeto é de código aberto e está disponível para fins educacionais.

⚠️ **ATENÇÃO**: O arquivo `.env` contém credenciais sensíveis. Nunca commite este arquivo ou compartilhe as chaves publicamente.

## 👨‍💻 Autor

Desenvolvido como projeto de estudo em desenvolvimento full-stack, integrando:

- Backend RESTful com Node.js + Express
- Banco de dados SQL com Prisma ORM (SQLite)
- Autenticação JWT e OAuth 2.0 (Google)
- Inteligência Artificial (Google Gemini 2.5 Flash)
- APIs externas (TMDB para dados de filmes)
- Envio de emails transacionais (Resend)
- Docker e deploy em VPS
- HTTPS e segurança web

---

**Stack Completo do Projeto:**

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Prisma
- **Banco**: SQLite (dev) / PostgreSQL (prod recomendado)
- **Infra**: Docker + Nginx + VPS
- **IA**: Google Gemini 2.5 Flash
- **Email**: Resend API

Para o frontend, consulte o README na pasta `/frontend`.

---

💡 **Quer discutir o projeto ou postar no LinkedIn?** Este projeto demonstra:

- ✅ Desenvolvimento full-stack do zero
- ✅ Integração com múltiplas APIs (TMDB, Gemini, Resend)
- ✅ Autenticação completa (JWT + OAuth 2.0)
- ✅ Uso de IA para personalização (recomendações inteligentes)
- ✅ Boas práticas de segurança e validação
- ✅ Containerização com Docker
- ✅ Documentação completa (Swagger/OpenAPI)
- ✅ Deploy em produção com HTTPS

**Aprendizados principais:**

- Arquitetura de APIs RESTful escaláveis
- Integração de IA generativa (Gemini) com aplicações web
- Ciclo completo de autenticação (registro, login, OAuth, recuperação de senha)
- Gerenciamento de estado com JWT
- Comunicação segura entre frontend e backend (CORS, headers)
- DevOps básico (Docker, migrations, ambiente prod vs dev)

---

📧 **Contato**: Abra uma issue ou entre em contato para discutir o projeto!



## Segurança

### Implementações de Segurança

- ✅ **JWT via Authorization Bearer** (token enviado no header de cada requisição)
- ✅ **Senha hash com bcryptjs** (12 salt rounds)
- ✅ **CORS restrito** à origem `CLIENT_URL` configurável
- ✅ **Validação de entrada** com express-validator em todas rotas críticas
- ✅ **Tokens de reset** com hash bcrypt, expiração 1h e proteção contra reutilização
- ✅ **OAuth 2.0** com Google (state parameter e PKCE implícitos no Passport)
- ✅ **Cascade delete** no banco (GDPR compliance facilitado)
- ✅ **Respostas genéricas** em forgot-password (previne enumeração de usuários)
- ✅ **Transações** no reset de senha (atomicidade garantida)

### Recomendações Adicionais para Produção

- [ ] Rate limiting (express-rate-limit): 5 req/min em /forgot-password, 100 req/15min geral
- [ ] Helmet.js para headers de segurança (CSP, HSTS, X-Frame-Options)
- [ ] Auditoria de dependências: `npm audit` automatizado em CI/CD
- [ ] Secrets em vault (AWS Secrets Manager, HashiCorp Vault)
- [ ] WAF (Web Application Firewall) para proteção adicional
- [ ] Rotação automática de JWT_SECRET
- [ ] 2FA (Two-Factor Authentication) via TOTP ou SMS
- [ ] httpOnly cookies para JWT (mais seguro que localStorage no futuro)

## Recuperação de Senha (Detalhes)

### Fluxo Completo

1. **Requisição de Reset**:
   - Usuário envia `POST /api/auth/forgot-password` com `{ "email": "usuario@email.com" }`.
   - Sistema sempre retorna 200 com mensagem genérica (segurança contra enumeração).
   - Se usuário existe:
     - Gera token criptográfico de 32 bytes (hex)
     - Armazena hash bcrypt do token + expiração (1h)
     - Envia email via Resend com link: `CLIENT_URL/resetar-senha?token=...&email=...`

2. **Validação do Token**:
   - Frontend exibe formulário de nova senha
   - Usuário envia `POST /api/auth/reset-password` com:
     ```json
     {
       "email": "usuario@email.com",
       "token": "token_recebido_por_email",
       "password": "nova_senha_segura"
     }
     ```

3. **Reset da Senha**:
   - Backend valida:
     - ✅ Usuário existe
     - ✅ Token corresponde ao hash armazenado (bcrypt.compare)
     - ✅ Token não expirou (<1h)
     - ✅ Token não foi usado anteriormente
   - Atualiza senha e marca token como `used: true`
   - Retorna sucesso (usuário deve fazer login novamente)

### Configuração de Email

**Desenvolvimento:**
- Link de reset é logado no console
- Em `NODE_ENV=development`, link também retorna no body da resposta
- Email é enviado via Resend se `RESEND_API_KEY` estiver configurada

**Produção:**

1. Criar conta em [resend.com](https://resend.com)
2. Obter API Key no dashboard
3. Adicionar no `.env`:
   ```env
   RESEND_API_KEY="re_sua_chave_aqui"
   MAIL_FROM="CineList <no-reply@seudominio.com>"
````

4. **Domínio próprio** (recomendado):
   - Verificar domínio no Resend: [resend.com/domains](https://resend.com/domains)
   - Adicionar registros DNS (SPF, DKIM, DMARC)
   - Usar email do domínio verificado em `MAIL_FROM`

**Nota**: O domínio `onboarding@resend.dev` funciona sem verificação mas tem limitações (100 emails/dia).

### Limitações Resend

- **Free Tier**:
  - 100 emails/dia com `onboarding@resend.dev`
  - 3.000 emails/mês com domínio verificado
  - Requer RESEND_API_KEY válida

## Como Rodar

1. `npm install`
2. Configurar `.env`
3. `npx prisma generate`
4. `npm run dev`
5. Acessar `http://localhost:5000/api/docs`
