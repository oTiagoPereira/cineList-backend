FROM node:18-alpine

WORKDIR /app

# Copia os arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instala as dependências
RUN npm install

# Copia o restante do código
COPY . .

# Gera o Prisma Client
RUN npx prisma generate

# Expõe a porta da aplicação
EXPOSE 5000

# Comando para rodar a aplicação
CMD ["npm", "start"]
