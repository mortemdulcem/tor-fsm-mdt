#!/bin/bash
# Build patched Tor binaries for attack scenarios
# Requires: Tor 0.4.6.10 source code, patch files
# Outputs: 4 patched binaries in /opt/tor-attack-*/

set -e

TOR_VERSION="tor-0.4.6.10"
TOR_REPO="https://gitlab.torproject.org/tpo/core/tor.git"
TOR_SOURCE="/tmp/tor-source"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Building Patched Tor Binaries for Attack Scenarios ==="
echo "Tor version: $TOR_VERSION"
echo "Patch directory: $PATCH_DIR"
echo ""

# Clone Tor source
if [ ! -d "$TOR_SOURCE" ]; then
  echo "[1/4] Cloning Tor source..."
  git clone --depth 1 --branch "$TOR_VERSION" "$TOR_REPO" "$TOR_SOURCE"
else
  echo "[1/4] Tor source already cloned"
fi

cd "$TOR_SOURCE"

# List of attacks
ATTACKS=(
  "handshake-skip:HANDSHAKE_SKIP"
  "replay:REPLAY_ATTACK"
  "premature-data:PREMATURE_DATA"
  "circuit-bypass:CIRCUIT_BYPASS"
)

# Build each patched binary
for attack_info in "${ATTACKS[@]}"; do
  IFS=: read -r attack_name attack_label <<< "$attack_info"
  
  echo ""
  echo "[2/4] Applying patch: $attack_name"
  
  # Reset to clean state
  git checkout src/ > /dev/null 2>&1 || true
  
  # Apply patch
  patch_file="$PATCH_DIR/attack-${attack_name}.patch"
  if [ ! -f "$patch_file" ]; then
    echo "ERROR: Patch file not found: $patch_file"
    exit 1
  fi
  
  git apply "$patch_file"
  
  # Configure and build
  echo "[3/4] Configuring and building: $attack_name"
  install_prefix="/opt/tor-attack-${attack_name}"
  
  ./configure \
    --prefix="$install_prefix" \
    --enable-fragile-hardening \
    --disable-asciidoc \
    > /dev/null 2>&1
  
  make clean > /dev/null 2>&1
  make -j4 > /dev/null 2>&1
  
  echo "[4/4] Installing to: $install_prefix"
  sudo make install > /dev/null 2>&1
  
  echo "✓ Successfully built: tor-attack-${attack_name}"
done

echo ""
echo "=== Build Complete ==="
echo "Binaries installed to:"
for attack_info in "${ATTACKS[@]}"; do
  IFS=: read -r attack_name _ <<< "$attack_info"
  echo "  /opt/tor-attack-${attack_name}/src/app/tor"
done

echo ""
echo "Use in Shadow YAML:"
echo "  relay-evil:"
echo "    processes:"
echo "    - path: /opt/tor-attack-<attack-name>/src/app/tor"
echo "      args: --defaults-torrc relay.torrc -f relay-evil.torrc"
