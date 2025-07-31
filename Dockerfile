# Stage 1: Build
FROM node:18 AS builder

# Accept NPM token for private packages
ARG NPM_TOKEN
ARG API_KEY

# Set working directory
WORKDIR /app

# Configure private access to GitHub Packages and NPM
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > /root/.npmrc \
 && echo "@oacore:registry=https://npm.pkg.github.com/" >> /root/.npmrc \
 && echo "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" >> /root/.npmrc

# Copy dependency declarations
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy the entire project
COPY . .

# Increase memory & fix OpenSSL issue
ENV NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=4096"

# Run build (fail if broken)
RUN npm run build

# Stage 2: Runtime
FROM node:18-alpine

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy built app from previous stage
COPY --from=builder /app /app

# Expose the app port
# EXPOSE 8080

EXPOSE 8080

# Entry point using dumb-init
ENTRYPOINT ["dumb-init", "--"]

# Start Next.js in production mode
# CMD ["node_modules/next/dist/bin/next", "start", "-p", "8080"]

CMD ["sh", "-c", "node_modules/next/dist/bin/next start -p 8080"]
