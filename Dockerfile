FROM node:26-slim AS build
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# `prepare` compiles messages, which are not in the image yet; the build
# compiles them itself. `rebuild` still runs the builds `allowBuilds` permits.
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm rebuild
COPY . .
RUN pnpm build

FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/.output ./.output
USER node
# A Session gate may redirect `/`, so a redirect is as healthy as a page.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/`, { redirect: 'manual' }).then((r) => process.exit(r.status < 400 ? 0 : 1), () => process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
