FROM node:22.6.0-bookworm-slim
WORKDIR /pharus

# install curl & Chrome dependencies
RUN apt-get update && apt-get install -y \
    curl libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libxcomposite1 libxdamage1 libxfixes3 libxrandr2  \
    libgbm1 libpango-1.0-0 libcairo2 libxkbcommon0 libasound2

# install Docker CLI
RUN install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
      https://download.docker.com/linux/debian \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && \
    apt-get install -y docker-ce-cli

# install Node.js dependencies
COPY package*.json .npmrc ./
RUN npm ci

# build source code
COPY tsconfig.json ./
COPY src src/
RUN npm run build

ENTRYPOINT ["node", "build/main", "--no-sandbox"]
