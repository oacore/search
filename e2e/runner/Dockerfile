# Playwright runner of the pixel and engine tiers (40 §5, 42 §3): the pinned Playwright image by digest
# (02 §3.5: mcr.microsoft.com/playwright:v1.64.1-noble-arm64) plus pinned Roboto and Noto fonts (the design
# font stack has no @font-face). Built in each job, never pushed. The digest and the font package versions
# are pinned when docker mode is enabled (DEFERRED in this run: owner, local mode only); the build fails
# until PLAYWRIGHT_DIGEST is given.
ARG PLAYWRIGHT_DIGEST
FROM mcr.microsoft.com/playwright:v1.64.1-noble-arm64@${PLAYWRIGHT_DIGEST}
ARG FONTS_ROBOTO_VERSION
ARG FONTS_NOTO_CORE_VERSION
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    "fonts-roboto=${FONTS_ROBOTO_VERSION:?pin fonts-roboto}" \
    "fonts-noto-core=${FONTS_NOTO_CORE_VERSION:?pin fonts-noto-core}" \
  && rm -rf /var/lib/apt/lists/* \
  && fc-cache -f
WORKDIR /repo/e2e
COPY e2e/package.json e2e/package-lock.json ./
RUN npm ci --no-audit --no-fund
WORKDIR /repo
ENV P2_IN_RUNNER=1
