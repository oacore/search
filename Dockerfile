# Stage 1: Build stage
FROM node:16 AS builder

# Accept tokens as build args
ARG NPM_TOKEN
ARG API_KEY
ARG USE_MOCK_DATA=false   # ✅ NEW ARG

ENV USE_MOCK_DATA=$USE_MOCK_DATA

WORKDIR /app

RUN printf "//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n" > .npmrc \
  && printf "@oacore:registry=https://npm.pkg.github.com/\n"   >> .npmrc \
  && printf "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}\n" >> .npmrc

COPY . .

RUN npm ci --legacy-peer-deps

# ✅ This will now respect USE_MOCK_DATA
RUN npm run build

# Stage 2: Runtime stage
FROM node:16-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 8080
ENTRYPOINT ["dumb-init", "--"]
CMD ["node_modules/next/dist/bin/next", "start", "-p", "8080"]
