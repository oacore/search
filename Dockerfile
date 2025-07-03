# Stage 1: Build stage
FROM node:16 AS builder

# Accept tokens as build args
ARG NPM_TOKEN
ARG API_KEY

# Set working directory
WORKDIR /app

RUN printf "//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n" > .npmrc \
  && printf "@oacore:registry=https://npm.pkg.github.com/\n"   >> .npmrc \
  && printf "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}\n" >> .npmrc

# Set npm token for public npm registry
#RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc

# Copy only dependency-related files first
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy full source code
COPY . .

# Build the Next.js app
RUN npm run build

# Stage 2: Runtime stage
FROM node:16-alpine

# Add dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy built app from builder stage
COPY --from=builder /app /app

# Expose app port
EXPOSE 80

# Use dumb-init as entrypoint
ENTRYPOINT ["dumb-init", "--"]

# Start the Next.js server
CMD ["node_modules/next/dist/bin/next", "start", "-p", "80"]
