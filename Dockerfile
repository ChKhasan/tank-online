# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

FROM base AS dependencies
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
ENV VITE_SERVER_URL=/backend
RUN npm run build

FROM base AS server-dependencies
RUN pnpm --filter @tank-online/server... install --prod --frozen-lockfile

FROM node:24-bookworm-slim AS server
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=2567
COPY --from=server-dependencies /app/node_modules ./node_modules
COPY --from=server-dependencies /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=server-dependencies /app/packages/shared ./packages/shared
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY apps/server/package.json ./apps/server/package.json
USER node
EXPOSE 2567
CMD ["node", "apps/server/dist/index.js"]

FROM nginx:stable-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
