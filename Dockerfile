# Etapa 1: Construcción
FROM node:21-bullseye-slim as builder

WORKDIR /app

# Copia los archivos necesarios para instalar dependencias
COPY package*.json ./
RUN npm install

# Copia el resto de los archivos y construye el proyecto
COPY . .
RUN npm run build

# Etapa 2: Despliegue
FROM node:21-bullseye-slim as deploy

WORKDIR /app

# Configura la variable de entorno del puerto
ARG PORT
ENV PORT $PORT
EXPOSE $PORT

# Copia los archivos necesarios desde la fase de build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/package*.json ./

# Instala solo las dependencias de producción
RUN npm install --production

# Comando para arrancar la aplicación
CMD ["npm", "start"]