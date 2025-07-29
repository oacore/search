# Stage 1: Build stage
FROM node:16 AS builder

# Accept tokens as build args
ARG NPM_TOKEN
ARG API_KEY
ARG USE_MOCK_DATA=false

# Make sure the build environment knows about USE_MOCK_DATA
ENV USE_MOCK_DATA=$USE_MOCK_DATA
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Configure npm authentication
RUN printf "//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n" > .npmrc \
  && printf "@oacore:registry=https://npm.pkg.github.com/\n" >> .npmrc \
  && printf "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}\n" >> .npmrc

# Copy all files
COPY . .

# Install dependencies
RUN npm ci --legacy-peer-deps

# Build the Next.js app
RUN npm run build

# Stage 2: Runtime stage
FROM node:16-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy built app from builder
COPY --from=builder /app /app

# Set environment variables for runtime
# ENV NODE_ENV=production
ENV PORT=80

# Expose port 80 (Azure Container Apps expects this by default)
EXPOSE 80

# Use dumb-init as the entrypoint
ENTRYPOINT ["dumb-init", "--"]

# Start the Next.js server on port 80
CMD ["node_modules/next/dist/bin/next", "start", "-p", "80"]
