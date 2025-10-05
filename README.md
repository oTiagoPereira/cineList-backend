# CineList Backend

## Visão Geral

API Node.js/Express que integra autenticação JWT via cookie httpOnly, Google OAuth, consumo da API TMDB e gerenciamento de lista pessoal (favoritos e status assistido). Banco de dados via Prisma (MongoDB provider).

## Principais Tecnologias

- Express
- Prisma (MongoDB)
- JWT + Cookies httpOnly
- Passport (Google OAuth)
- Axios (proxy TMDB)
- Swagger UI (/api/docs)

## Estrutura de Pastas

```
backend/
  app.js                # Bootstrap da aplicação / middlewares globais / CORS / Swagger
  prisma/schema.prisma  # Modelos Prisma
  src/
    config/             # DB, Passport
    controllers/        # Lógica endpoints
    middlewares/        # Auth header/cookie
    routes/             # Definição de rotas REST
    services/           # Integrações externas (TMDB)
    validations/        # Regras express-validator
  docs/openapi.yaml     # Especificação OpenAPI 3
```

## Fluxo de Autenticação

1. Registro (`POST /api/auth/register`) cria usuário (não loga automaticamente).
2. Login (`POST /api/auth/login`) gera JWT (1 dia) e grava em cookie httpOnly `auth_token` + cookies legíveis (`user_data`, `user_id`).
3. Middleware `authMiddleware` aceita JWT em cookie ou Authorization Bearer (fallback).
4. `GET /api/auth/me` decodifica token e retorna dados públicos.
5. Logout limpa cookies.
6. Google OAuth: `/api/auth/google` -> callback `/api/auth/google/callback` gera mesmo fluxo de cookies.
7. Recuperação de senha:

- `POST /api/auth/forgot-password` recebe email e gera token (hash guardado + expiração 1h). Resposta é genérica para não revelar existência de usuário. Em desenvolvimento o link de reset pode ser retornado.
- Front envia usuário para `/resetar-senha?token=...&email=...`.
- `POST /api/auth/reset-password` valida token (comparando hash), verifica expiração e redefine senha.
- Token marcado como usado para impedir reutilização.

## Variáveis de Ambiente (.env)

| Nome                 | Descrição                                         |
| -------------------- | ------------------------------------------------- |
| PORT                 | Porta do servidor                                 |
| CLIENT_URL           | Origem permitida CORS (ex: http://localhost:3030) |
| JWT_SECRET           | Segredo para assinar tokens                       |
| DATABASE_URL         | URL do MongoDB (para Prisma)                      |
| MONGODB_URI          | (Opcional) usado por conexão Mongoose legacy      |
| GOOGLE_CLIENT_ID     | OAuth Google                                      |
| GOOGLE_CLIENT_SECRET | OAuth Google                                      |
| BASE_URL             | Base pública do backend (para callback OAuth)     |
| TMDB_API_KEY         | Chave TMDB (algumas rotas)                        |
| TMDB_API_AUTH        | Token Bearer TMDB v4                              |
| RESEND_API_KEY       | Chave da API Resend para envio de emails          |
| MAIL_FROM            | Remetente padrão (ex: CineList <no-reply@...>)    |
| APP_NAME             | Nome da aplicação (para emails)                   |

## Endpoints Principais

Documentação completa em `/api/docs` (Swagger UI).

### Auth

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/change-password (cookie)
- GET /api/auth/me
- POST /api/auth/logout
- GET /api/auth/google (OAuth)
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

### Movies (proxy TMDB)

- GET /api/movies/populares
- GET /api/movies/details/:id
- GET /api/movies/streaming/:id
- GET /api/movies/similar/:id
- GET /api/movies/genres
- GET /api/movies/top-rated
- GET /api/movies/search/:query

### User Movies (autenticado)

- POST /api/user/movies # Salvar
- GET /api/user/movies # Listar (IDs)
- GET /api/user/movies/details # Listar detalhes completos
- PATCH /api/user/movies/:id # Alternar assistido
- DELETE /api/user/movies/:id # Remover
- GET /api/user/movies/:id/status # Status salvo/assistido

### Recommendation

- POST /api/recommendation

## Modelo Prisma (Resumo)

```
model User {
  id       String   @id @default(auto()) @map("_id") @db.ObjectId
  name     String
  email    String   @unique
  password String
  googleId String?  @unique
  movies   UserMovie[]
  passwordResetTokens PasswordResetToken[]
}

model UserMovie {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
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
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  tokenHash String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([expiresAt])
}
```

## Segurança

- JWT em cookie httpOnly + SameSite=strict (reduz XSS / CSRF)
- CORS restrito à origem `CLIENT_URL`
- Rate limiting (SUGESTÃO futura)

## Erros Comuns

| Situação           | Causa Provável      | Ação                                   |
| ------------------ | ------------------- | -------------------------------------- |
| 401 em rotas /user | Cookie ausente      | Re-login / conferir domínio e SameSite |
| 409 registro       | Email já cadastrado | Usar endpoint login                    |
| 500 TMDB           | Token inválido TMDB | Revisar `TMDB_API_AUTH`                |

## Próximas Melhorias

- Adicionar testes (Jest + Supertest) para auth e user movies
- Implementar refresh token (expansão futura)
- Cache em memória para rotas TMDB populares/top-rated
- Observabilidade (logs estruturados + request id)
- Limpeza job de tokens de reset expirados
- Rate limit por IP no forgot-password

## Recuperação de Senha (Detalhes)

Fluxo:

1. Usuário envia `POST /api/auth/forgot-password` com `{ email }`.
2. Sempre retorna 200 com mensagem genérica.
3. Se usuário existe: cria `PasswordResetToken` (hash + expiração 1h) e envia email com link `CLIENT_URL/resetar-senha?token=...&email=...`.
4. Front abre página de redefinição e envia `POST /api/auth/reset-password` com `{ email, token, password }`.
5. Token é marcado como `used` e não pode ser reutilizado.

Fallback desenvolvimento: se não houver `RESEND_API_KEY` configurada, o email é logado no console (DEV Fallback) e retornado no corpo quando `NODE_ENV=development`.

## Configuração Resend

Para ativar envio real de emails:

1. Criar conta em https://resend.com
2. Obter API Key no dashboard
3. Adicionar no `.env`:
   ```
   RESEND_API_KEY=re_sua_chave_aqui
   MAIL_FROM="CineList <onboarding@resend.dev>"
   ```
4. Para domínio próprio: verificar domínio no Resend em https://resend.com/domains
5. Reiniciar servidor

**Nota**: O domínio `onboarding@resend.dev` funciona sem verificação. Para usar seu próprio domínio (ex: `no-reply@seusite.com`), você deve verificá-lo primeiro no painel do Resend.

## Como Rodar

1. `npm install`
2. Configurar `.env`
3. `npx prisma generate`
4. `npm run dev`
5. Acessar `http://localhost:5000/api/docs`
