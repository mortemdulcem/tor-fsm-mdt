#!/usr/bin/env bash
# generate_keys.sh — Generate authority + relay keys for a Shadow+Tor expanded topology.
#
# Uses tor-gencert (for directory authority v3 certificates) and openssl
# (for RSA identity/onion keys) to produce all key material needed by
# Shadow's --template-directory layout.
#
# Topology: 3 directory authorities, 20 guard/middle relays, 10 exit relays, 8 tor clients.
#
# Usage:
#   ./generate_keys.sh [OUTPUT_DIR]
#   OUTPUT_DIR defaults to ./shadow_template
#
# Prerequisites:
#   - tor-gencert (shipped with the Tor package)
#   - openssl (for RSA key generation and fingerprint extraction)
#   - tor (for --list-fingerprint)
#
# The script is idempotent: re-running overwrites the output directory.
# All generated keys are deterministic given the same openssl/tor versions
# but NOT cryptographically reproducible across runs (fresh randomness).

set -euo pipefail

OUTPUT_DIR="${1:-./shadow_template}"
PASSPHRASE="shadowprivatenetwork"

# Topology definition
AUTHORITIES=("4uthority" "da2" "da3")
AUTH_IPS=("100.0.0.1" "100.0.0.2" "100.0.0.3")
GUARD_RELAYS=()
for i in $(seq 1 20); do GUARD_RELAYS+=("relay${i}"); done
EXIT_RELAYS=()
for i in $(seq 1 10); do EXIT_RELAYS+=("exit${i}"); done
TOR_CLIENTS=("torclient" "torclient2" "torclient3" "torclient4"
             "torclient5" "torclient6" "torclient7" "torclient8")

ALL_RELAYS=("${GUARD_RELAYS[@]}" "${EXIT_RELAYS[@]}")

echo "=== Shadow+Tor Key Generator ==="
echo "Output directory: ${OUTPUT_DIR}"
echo "Authorities: ${AUTHORITIES[*]}"
echo "Guard/middle relays: ${#GUARD_RELAYS[@]}"
echo "Exit relays: ${#EXIT_RELAYS[@]}"
echo "Tor clients: ${#TOR_CLIENTS[@]}"
echo

# Clean and create output structure
rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}/conf"

# --- Helper functions ---

generate_rsa_key() {
    # Generate a 1024-bit RSA key (Tor's default for identity/onion keys)
    local outfile="$1"
    openssl genrsa -out "${outfile}" 1024 2>/dev/null
}

get_rsa_fingerprint() {
    # Extract the SHA-1 fingerprint of an RSA public key (Tor relay fingerprint format)
    local keyfile="$1"
    openssl rsa -in "${keyfile}" -outform DER -pubout 2>/dev/null | \
        openssl dgst -sha1 -binary | \
        xxd -p -c 20 | \
        tr '[:lower:]' '[:upper:]'
}

generate_ntor_key() {
    # Generate a curve25519 key pair for ntor handshake.
    # Tor stores this as a 64-byte file: 32-byte secret + 32-byte public.
    local outfile="$1"
    openssl rand 64 > "${outfile}"
}

generate_authority_keys() {
    # Generate directory authority keys using tor-gencert.
    # tor-gencert must be run from a working directory where it creates files.
    local name="$1"
    local hostdir="${OUTPUT_DIR}/hosts/${name}"
    local keysdir="${hostdir}/keys"
    mkdir -p "${keysdir}"

    local tmpdir
    tmpdir=$(mktemp -d)

    # Run tor-gencert from tmpdir — it creates authority_identity_key,
    # authority_signing_key, and authority_certificate in the current directory.
    (
        cd "${tmpdir}"
        echo "${PASSPHRASE}" | tor-gencert \
            --create-identity-key \
            --passphrase-fd 0 \
            -a "127.0.0.1:9112" \
            -m 24 \
            2>/dev/null
    )

    # Copy generated authority files to the keys directory
    if [ -f "${tmpdir}/authority_certificate" ]; then
        cp "${tmpdir}/authority_identity_key"  "${keysdir}/authority_identity_key"
        cp "${tmpdir}/authority_signing_key"   "${keysdir}/authority_signing_key"
        cp "${tmpdir}/authority_certificate"   "${keysdir}/authority_certificate"
    else
        echo "ERROR: tor-gencert failed for ${name}" >&2
        rm -rf "${tmpdir}"
        return 1
    fi

    # Also generate standard relay keys for the authority (it's also a relay)
    generate_rsa_key "${keysdir}/secret_id_key"
    generate_rsa_key "${keysdir}/secret_onion_key"
    generate_ntor_key "${keysdir}/secret_onion_key_ntor"

    # Extract fingerprint from the relay identity key
    local fp
    fp=$(get_rsa_fingerprint "${keysdir}/secret_id_key")
    echo "Unnamed ${fp}" > "${hostdir}/fingerprint"

    # Extract v3ident from authority_certificate
    local v3ident=""
    v3ident=$(grep "^fingerprint " "${keysdir}/authority_certificate" | awk '{print $2}')

    echo "${fp}|${v3ident}"

    rm -rf "${tmpdir}"
}

generate_relay_keys() {
    # Generate relay keys (identity, onion, ntor).
    local name="$1"
    local hostdir="${OUTPUT_DIR}/hosts/${name}"
    local keysdir="${hostdir}/keys"
    mkdir -p "${keysdir}"

    generate_rsa_key "${keysdir}/secret_id_key"
    generate_rsa_key "${keysdir}/secret_onion_key"
    generate_ntor_key "${keysdir}/secret_onion_key_ntor"

    # Extract fingerprint
    local fp
    fp=$(get_rsa_fingerprint "${keysdir}/secret_id_key")
    echo "Unnamed ${fp}" > "${hostdir}/fingerprint"

    echo "${fp}"
}

# --- Generate keys for all nodes ---

echo "--- Generating authority keys ---"
declare -A AUTH_FPS
declare -A AUTH_V3IDENTS

for i in "${!AUTHORITIES[@]}"; do
    name="${AUTHORITIES[$i]}"
    echo -n "  ${name}: "
    result=$(generate_authority_keys "${name}")
    fp=$(echo "${result}" | cut -d'|' -f1)
    v3=$(echo "${result}" | cut -d'|' -f2)
    AUTH_FPS["${name}"]="${fp}"
    AUTH_V3IDENTS["${name}"]="${v3}"
    echo "fp=${fp} v3ident=${v3}"
done

echo
echo "--- Generating guard/middle relay keys ---"
declare -A RELAY_FPS

for name in "${GUARD_RELAYS[@]}"; do
    fp=$(generate_relay_keys "${name}")
    RELAY_FPS["${name}"]="${fp}"
    echo "  ${name}: ${fp}"
done

echo
echo "--- Generating exit relay keys ---"
for name in "${EXIT_RELAYS[@]}"; do
    fp=$(generate_relay_keys "${name}")
    RELAY_FPS["${name}"]="${fp}"
    echo "  ${name}: ${fp}"
done

echo
echo "--- Creating client directories ---"
for name in "${TOR_CLIENTS[@]}"; do
    mkdir -p "${OUTPUT_DIR}/hosts/${name}"
    echo "  ${name}: (no keys needed)"
done

# --- Build torrc templates ---

echo
echo "--- Generating torrc configuration files ---"

# Build DirServer lines for tor.common.torrc
DIRSERVER_LINES=""
for i in "${!AUTHORITIES[@]}"; do
    name="${AUTHORITIES[$i]}"
    ip="${AUTH_IPS[$i]}"
    fp="${AUTH_FPS[${name}]}"
    v3="${AUTH_V3IDENTS[${name}]}"
    # Format fingerprint with spaces (Tor expects "XXXX XXXX XXXX ...")
    fp_spaced=$(echo "${fp}" | sed 's/.\{4\}/& /g' | sed 's/ $//')
    if [ -n "${v3}" ]; then
        DIRSERVER_LINES="${DIRSERVER_LINES}DirServer ${name} v3ident=${v3} orport=9111 ${ip}:9112 ${fp_spaced}\n"
    else
        DIRSERVER_LINES="${DIRSERVER_LINES}DirServer ${name} orport=9111 ${ip}:9112 ${fp_spaced}\n"
    fi
done

# Build guard/exit fingerprint lists for TestingDirAuthVote{Guard,Exit}
GUARD_FP_LIST=""
for name in "${GUARD_RELAYS[@]}"; do
    [ -n "${GUARD_FP_LIST}" ] && GUARD_FP_LIST="${GUARD_FP_LIST},"
    GUARD_FP_LIST="${GUARD_FP_LIST}${RELAY_FPS[${name}]}"
done

EXIT_FP_LIST=""
for name in "${EXIT_RELAYS[@]}"; do
    [ -n "${EXIT_FP_LIST}" ] && EXIT_FP_LIST="${EXIT_FP_LIST},"
    EXIT_FP_LIST="${EXIT_FP_LIST}${RELAY_FPS[${name}]}"
done

# tor.common.torrc
cat > "${OUTPUT_DIR}/conf/tor.common.torrc" << TORRC_COMMON
DataDirectory .
BandwidthRate 1024000
BandwidthBurst 1024000
$(printf '%b' "${DIRSERVER_LINES}")
TestingTorNetwork 1
ServerDNSResolvConfFile ../../../conf/shadowresolv.conf
ServerDNSTestAddresses 4uthority
ServerDNSAllowBrokenConfig 1
ServerDNSDetectHijacking 0
AssumeReachable 1
AuthDirTestReachability 0
NumCPUs 1
Log info stdout
LogTimeGranularity 1
HeartbeatPeriod 1
SafeLogging 0
ContactInfo https://github.com/shadow/shadow-plugin-tor/issues
DisableDebuggerAttachment 0
PathBiasUseThreshold 10000
PathBiasCircThreshold 10000
DoSCircuitCreationEnabled 0
DoSConnectionEnabled 0
DoSRefuseSingleHopClientRendezvous 0
CircuitPriorityHalflife 30
ControlPort 9051
LearnCircuitBuildTimeout 0
TORRC_COMMON

# tor.relay.torrc
cat > "${OUTPUT_DIR}/conf/tor.relay.torrc" << 'TORRC_RELAY'
ORPort 9111 IPv4Only
DirPort 9112
SocksPort 0
TORRC_RELAY

# tor.authority.torrc
cat > "${OUTPUT_DIR}/conf/tor.authority.torrc" << TORRC_AUTH
AuthoritativeDirectory 1
V3AuthoritativeDirectory 1
V3BandwidthsFile ../torflowauthority/v3bw
ExitPolicy "reject *:*"
TestingDirAuthVoteGuard ${GUARD_FP_LIST}
TestingDirAuthVoteExit ${EXIT_FP_LIST}
TestingDirAuthVoteGuardIsStrict 1
TestingDirAuthVoteExitIsStrict 1
ConsensusParams cc_alg=2
TORRC_AUTH

# tor.exit.torrc
cat > "${OUTPUT_DIR}/conf/tor.exit.torrc" << 'TORRC_EXIT'
ExitPolicy "accept *:*"
TORRC_EXIT

# tor.non-exit.torrc
cat > "${OUTPUT_DIR}/conf/tor.non-exit.torrc" << 'TORRC_NONEXIT'
ExitPolicy "reject *:*"
TORRC_NONEXIT

# tor.client.torrc
cat > "${OUTPUT_DIR}/conf/tor.client.torrc" << 'TORRC_CLIENT'
ORPort 0
DirPort 0
ClientOnly 1
SocksPort 127.0.0.1:9000
TORRC_CLIENT

# shadowresolv.conf
cat > "${OUTPUT_DIR}/conf/shadowresolv.conf" << 'RESOLV'
nameserver 127.0.0.1
RESOLV

# authgen.pw (passphrase for tor-gencert)
echo "${PASSPHRASE}" > "${OUTPUT_DIR}/conf/authgen.pw"

# authgen.torrc (minimal torrc for key generation)
cat > "${OUTPUT_DIR}/conf/authgen.torrc" << 'AUTHGEN'
DirServer test 127.0.0.1:5000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000
ORPort 5000
AUTHGEN

# --- Write torrc-defaults for each host ---

# Authorities
for name in "${AUTHORITIES[@]}"; do
    hostdir="${OUTPUT_DIR}/hosts/${name}"
    cat > "${hostdir}/torrc-defaults" << 'EOF'
%include ../../../conf/tor.common.torrc
%include ../../../conf/tor.relay.torrc
%include ../../../conf/tor.authority.torrc
EOF
    touch "${hostdir}/torrc"
done

# Guard/middle relays
for name in "${GUARD_RELAYS[@]}"; do
    hostdir="${OUTPUT_DIR}/hosts/${name}"
    cat > "${hostdir}/torrc-defaults" << 'EOF'
%include ../../../conf/tor.common.torrc
%include ../../../conf/tor.relay.torrc
%include ../../../conf/tor.non-exit.torrc
EOF
    touch "${hostdir}/torrc"
done

# Exit relays
for name in "${EXIT_RELAYS[@]}"; do
    hostdir="${OUTPUT_DIR}/hosts/${name}"
    cat > "${hostdir}/torrc-defaults" << 'EOF'
%include ../../../conf/tor.common.torrc
%include ../../../conf/tor.relay.torrc
%include ../../../conf/tor.exit.torrc
EOF
    touch "${hostdir}/torrc"
done

# Tor clients
for name in "${TOR_CLIENTS[@]}"; do
    hostdir="${OUTPUT_DIR}/hosts/${name}"
    cat > "${hostdir}/torrc-defaults" << 'EOF'
%include ../../../conf/tor.common.torrc
%include ../../../conf/tor.client.torrc
EOF
    touch "${hostdir}/torrc"
done

# --- Generate tgen configs ---

echo "--- Generating tgen configs ---"

# tgen.server.graphml.xml
cat > "${OUTPUT_DIR}/conf/tgen.server.graphml.xml" << 'TGEN_SERVER'
<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
  <key attr.name="serverport" attr.type="string" for="node" id="d0" />
  <graph edgedefault="directed">
    <node id="start">
      <data key="d0">80</data>
    </node>
  </graph>
</graphml>
TGEN_SERVER

# tgen.client.graphml.xml (direct client, no socks proxy)
cat > "${OUTPUT_DIR}/conf/tgen.client.graphml.xml" << 'TGEN_CLIENT'
<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
  <key attr.name="peers" attr.type="string" for="node" id="d5" />
  <key attr.name="sendsize" attr.type="string" for="node" id="d3" />
  <key attr.name="recvsize" attr.type="string" for="node" id="d2" />
  <key attr.name="count" attr.type="string" for="node" id="d1" />
  <key attr.name="time" attr.type="string" for="node" id="d0" />
  <graph edgedefault="directed">
    <node id="start">
      <data key="d5">fileserver:80</data>
    </node>
    <node id="stream">
      <data key="d2">1 MiB</data>
      <data key="d3">1 KiB</data>
    </node>
    <node id="pause">
      <data key="d0">1,2,3,4,5,6,7,8,9,10</data>
    </node>
    <node id="end">
      <data key="d1">10</data>
      <data key="d0">3600</data>
    </node>
    <edge source="start" target="stream" />
    <edge source="stream" target="end" />
    <edge source="end" target="pause" />
    <edge source="pause" target="start" />
  </graph>
</graphml>
TGEN_CLIENT

# tgen.torclient.graphml.xml (tor client, uses socks proxy)
cat > "${OUTPUT_DIR}/conf/tgen.torclient.graphml.xml" << 'TGEN_TORCLIENT'
<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
  <key attr.name="socksproxy" attr.type="string" for="node" id="d7" />
  <key attr.name="peers" attr.type="string" for="node" id="d5" />
  <key attr.name="sendsize" attr.type="string" for="node" id="d3" />
  <key attr.name="recvsize" attr.type="string" for="node" id="d2" />
  <key attr.name="count" attr.type="string" for="node" id="d1" />
  <key attr.name="time" attr.type="string" for="node" id="d0" />
  <graph edgedefault="directed">
    <node id="start">
      <data key="d5">fileserver:80</data>
      <data key="d7">localhost:9000</data>
    </node>
    <node id="stream">
      <data key="d2">1 MiB</data>
      <data key="d3">1 KiB</data>
    </node>
    <node id="pause">
      <data key="d0">1,2,3,4,5,6,7,8,9,10</data>
    </node>
    <node id="end">
      <data key="d1">10</data>
      <data key="d0">3600</data>
    </node>
    <edge source="start" target="stream" />
    <edge source="stream" target="end" />
    <edge source="end" target="pause" />
    <edge source="pause" target="start" />
  </graph>
</graphml>
TGEN_TORCLIENT

# --- Summary ---

echo
echo "=== Key generation complete ==="
echo "Template directory: ${OUTPUT_DIR}"
echo
echo "Directory structure:"
echo "  ${OUTPUT_DIR}/"
echo "    conf/             — shared torrc fragments, tgen configs"
echo "    hosts/"
echo "      4uthority/      — DA keys + torrc"
echo "      da2/            — DA keys + torrc"
echo "      da3/            — DA keys + torrc"
echo "      relay{1..20}/   — guard/middle relay keys + torrc"
echo "      exit{1..10}/    — exit relay keys + torrc"
echo "      torclient{..8}/ — client torrc (no keys)"
echo
echo "To use with Shadow:"
echo "  shadow --template-directory ${OUTPUT_DIR} shadow.yaml"
echo
echo "Node count: 3 DA + 20 guard + 10 exit + 8 client = 41 total (+ 1 fileserver)"
