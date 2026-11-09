FROM node:22-alpine
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN rm -rf node_modules apps/api/node_modules apps/web/node_modules apps/worker/node_modules \
  && pnpm install --frozen-lockfile
EXPOSE 5173
CMD ["pnpm", "--filter", "@taxi/web", "dev", "--host", "0.0.0.0"]
