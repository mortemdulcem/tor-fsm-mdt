# Dockerfile for reproducing Shadow+Tor FSM experiments.
# Builds Shadow from source, installs Tor, runs FSM analysis.
#
# NOTE: Shadow 3.3.0 release tarball is no longer available on GitHub.
# This Dockerfile clones the Shadow repo at the v3.3.0 tag instead.
# Shadow requires Rust/Cargo for building.
#
# Usage:
#   docker build -t tor-fsm-mdt .
#   docker run --rm tor-fsm-mdt npm test
#   docker run --rm tor-fsm-mdt npx tsx experiments/reanalyze_fsm.mjs
#
# To run FSM re-analysis (no Shadow binary needed):
#   docker run --rm tor-fsm-mdt npx tsx experiments/reanalyze_fsm.mjs
#
# To run full Shadow simulations (requires Shadow binary):
#   docker run --rm tor-fsm-mdt npx tsx experiments/shadow_harness_v2.mjs

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# System dependencies (libclang-dev needed for Shadow's Rust bindgen)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    curl \
    git \
    libclang-dev \
    libglib2.0-dev \
    libigraph-dev \
    pkg-config \
    python3 \
    python3-pip \
    tor \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Rust (needed for Shadow build)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Build Shadow 3.3.0 from source
# NOTE: This step takes ~10-15 minutes and requires ~4GB RAM.
# If you only need FSM analysis (not full simulations), you can skip this
# by commenting out this block.
RUN cd /tmp \
    && git clone --depth 1 --branch v3.3.0 https://github.com/shadow/shadow.git \
    && cd shadow \
    && mkdir build && cd build \
    && cmake .. -DCMAKE_INSTALL_PREFIX=/usr/local -DSHADOW_TEST=OFF \
    && make -j$(nproc) \
    && make install \
    && cd / && rm -rf /tmp/shadow

# Application
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

# Verify setup
RUN npx tsc --noEmit \
    && npm test \
    && echo "Build OK"

# Default: run the re-analysis
CMD ["npx", "tsx", "experiments/reanalyze_fsm.mjs"]
