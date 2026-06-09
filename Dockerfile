FROM node:18-alpine
ARG BUILD_TARGET=azure
ARG SENTRY_DSN
ARG NODE_ENV=production
ARG NPM_TOKEN
ARG GA_TRACKING_CODE
ARG API_KEY
ARG ICONS_PUBLIC_PATH
ENV SENTRY_DSN=$SENTRY_DSN \
    GA_TRACKING_CODE=$GA_TRACKING_CODE \
    API_KEY=$API_KEY \
    ICONS_PUBLIC_PATH=$ICONS_PUBLIC_PATH \
    BUILD_TARGET=$BUILD_TARGET
WORKDIR /app
COPY . .
RUN printf "@oacore:registry=https://npm.pkg.github.com/\n//npm.pkg.github.com/:_authToken=%s\n" "$NPM_TOKEN" > .npmrc
RUN npm ci --include=dev --legacy-peer-deps || npm install --include=dev --legacy-peer-deps
RUN rm -f .npmrc
ENV NODE_ENV=$NODE_ENV
ENV NODE_OPTIONS="--openssl-legacy-provider"
RUN npm run build && \
    cp public/design/icons.svg public/icons.svg && \
    mkdir -p public/images && \
    cp -r public/static/images/* public/images/
EXPOSE 8080
CMD ["node_modules/next/dist/bin/next", "start", "-p", "8080"]
