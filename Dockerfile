# Etapa 1: Construcción
FROM node:21-bullseye-slim as builder

WORKDIR /app

# Habilita corepack y configura pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

# Copia los archivos necesarios para instalar dependencias
COPY package*.json *-lock.yaml ./
RUN pnpm install

# Copia el resto de los archivos y construye el proyecto
COPY . .
RUN pnpm run build

# Etapa 2: Despliegue
FROM node:21-bullseye-slim as deploy

WORKDIR /app

# Configura la variable de entorno del puerto
ARG PORT
ENV PORT $PORT
EXPOSE $PORT

# Copia los archivos necesarios desde la fase de build
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/*.json /app/*-lock.yaml ./

# Habilita corepack y pnpm en la etapa de despliegue
RUN corepack enable && corepack prepare pnpm@latest --activate 
ENV PNPM_HOME=/usr/local/bin

# Instala solo las dependencias de producción
RUN pnpm install --production --ignore-scripts

# Comando para arrancar la aplicación
CMD ["npm", "start"]