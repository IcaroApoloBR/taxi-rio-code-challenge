FROM node:22-alpine
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter", "@taxi/api", "start:dev"]
