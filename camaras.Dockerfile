FROM ubuntu:22.04
RUN apt-get update && apt-get install -y \
    curl \
    git \
    wget \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs

WORKDIR /app
COPY . .

WORKDIR /app/mediamtx
RUN rm -f mediamtx.exe \
    && mv mediamtx.yml mediamtxorig.yml \
    && wget https://github.com/bluenviron/mediamtx/releases/download/v1.14.0/mediamtx_v1.14.0_linux_amd64.tar.gz && tar -xzf mediamtx_v1.14.0_linux_amd64.tar.gz \
    && rm mediamtx_v1.14.0_linux_amd64.tar.gz \
    && chmod +x mediamtx \
    && rm mediamtx.yml \
    && mv mediamtxorig.yml mediamtx.yml

# Instalar dependencias de Node
RUN npm ci

WORKDIR /app
# Construir la app Next.js
#RUN npm run generate-config && npx next build
RUN npm run build

# Puerto por defecto de Next.js
EXPOSE 3001 554 8888 8554 8889

CMD ["npm", "run", "start"]