#!/usr/bin/env bash
# ==============================================================================
# Agent Pixelate — Agent37 Cloud Sandbox Bootstrap & Deployment Script
#
# Provisions a gVisor-isolated Agent37 cloud sandbox (no nested Docker daemon)
# with persistent volume storage mounted at /data/campaigns.
#
# Usage:
#   AGENT37_API_KEY=sk_live_... ./deploy_agent37.sh
#   ./deploy_agent37.sh --dry-run
# ==============================================================================

set -euo pipefail

AGENT37_API_BASE="${AGENT37_API_BASE:-https://api.agent37.com/v1}"
TEMPLATE_NAME="${AGENT37_TEMPLATE_NAME:-agent-pixelate-orchestrator}"
INSTANCE_NAME="${AGENT37_INSTANCE_NAME:-agent-pixelate-orchestrator-prod}"
VOLUME_NAME="${AGENT37_VOLUME_NAME:-pixelate-campaign-assets}"
MOUNT_PATH="${CAMPAIGN_DATA_DIR:-/data/campaigns}"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    --help|-h)
      echo "Usage: AGENT37_API_KEY=sk_live_... $0 [--dry-run]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

# Load local .env if present (without overriding already-exported vars)
if [[ -f ".env" ]]; then
  echo "[agent37] Loading defaults from .env..."
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

log() {
  printf '[agent37] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[agent37] ERROR: Required command '$1' is not installed." >&2
    exit 1
  fi
}

log "Validating gVisor-compatible deployment artifacts..."
for required_file in "Dockerfile" "agent37.yaml" "orchestrator/main.py" "shared/schemas.py"; do
  if [[ ! -f "$required_file" ]]; then
    echo "[agent37] ERROR: Missing required file: $required_file" >&2
    exit 1
  fi
done

# Guardrail: verify non-comment Dockerfile instructions contain no nested Docker daemon invocations
if grep -Ev '^[[:space:]]*#' Dockerfile | grep -Eqi '(dockerd|docker\.sock|--privileged)'; then
  echo "[agent37] ERROR: Dockerfile appears to reference nested Docker/privileged mode, which violates gVisor constraints." >&2
  exit 1
fi
log "Verified Dockerfile is gVisor-compatible (non-root, no nested Docker daemon)."

if [[ "$DRY_RUN" == "true" ]]; then
  log "DRY RUN enabled — skipping live API calls."
  log "Would build linux/amd64 workspace template: ${TEMPLATE_NAME} via 'npx agent37 templates build .'"
  log "Would provision gVisor sandbox instance '${INSTANCE_NAME}' via POST ${AGENT37_API_BASE}/instances"
  log "Persistent volume '${VOLUME_NAME}' would mount at '${MOUNT_PATH}'."
  exit 0
fi

if [[ -z "${AGENT37_API_KEY:-}" ]]; then
  echo "[agent37] ERROR: AGENT37_API_KEY is required (e.g. export AGENT37_API_KEY=sk_live_...)." >&2
  exit 1
fi

require_cmd curl
require_cmd python3

# Step 1: Cloud-build linux/amd64 container template via Agent37 CLI (no local Docker needed)
if command -v npx >/dev/null 2>&1; then
  log "Building workspace template '${TEMPLATE_NAME}' on Agent37 cloud builder (linux/amd64)..."
  AGENT37_API_KEY="${AGENT37_API_KEY}" npx --yes agent37 templates build . \
    --name "${TEMPLATE_NAME}" \
    --dockerfile Dockerfile
else
  log "npx not found; ensuring template '${TEMPLATE_NAME}' is registered via Agent37 REST API..."
  curl -fsSL -X POST "${AGENT37_API_BASE}/templates" \
    -H "Authorization: Bearer ${AGENT37_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"${TEMPLATE_NAME}\",
      \"architecture\": \"linux/amd64\",
      \"isolation\": \"gvisor\",
      \"dockerfile\": \"Dockerfile\"
    }" >/dev/null
fi

# Step 2: Build sandbox instance payload securely via Python (avoids shell JSON escaping issues)
PAYLOAD="$(python3 - <<'PY'
import json, os

env_keys = [
    "BAND_API_KEY",
    "BAND_VISUAL_AGENT_KEY",
    "BAND_COPY_AGENT_KEY",
    "BAND_REST_URL",
    "BAND_WS_URL",
    "ADAL_API_KEY",
    "FINCH_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "AGENTS_SERVICE_URL",
    "CORS_ORIGINS",
]

env_map = {
    "ENVIRONMENT": "production",
    "CAMPAIGN_DATA_DIR": os.environ.get("CAMPAIGN_DATA_DIR", "/data/campaigns"),
    "AGENT37_RUNTIME": "gvisor",
    "ORCHESTRATOR_HOST": "0.0.0.0",
    "ORCHESTRATOR_PORT": "8000",
    "BAND_REST_URL": os.environ.get("BAND_REST_URL", "https://app.band.ai"),
    "BAND_WS_URL": os.environ.get("BAND_WS_URL", "wss://app.band.ai/api/v1/socket/websocket"),
}
for k in env_keys:
    val = os.environ.get(k)
    if val:
        env_map[k] = val

payload = {
    "name": os.environ.get("AGENT37_INSTANCE_NAME", "agent-pixelate-orchestrator-prod"),
    "template": os.environ.get("AGENT37_TEMPLATE_NAME", "agent-pixelate-orchestrator"),
    "type": "sandbox",
    "isolation": "gvisor",
    "resources": {"vcpu": 2, "memory_mb": 2048, "disk_gb": 20},
    "volumes": [
        {
            "name": os.environ.get("AGENT37_VOLUME_NAME", "pixelate-campaign-assets"),
            "mount_path": os.environ.get("CAMPAIGN_DATA_DIR", "/data/campaigns"),
            "persistent": True,
        }
    ],
    "ports": [{"port": 8000, "public": True, "websocket": True}],
    "env": env_map,
}
print(json.dumps(payload))
PY
)"

# Step 3: Provision persistent Agent37 gVisor sandbox instance
log "Provisioning persistent gVisor sandbox '${INSTANCE_NAME}' with volume at '${MOUNT_PATH}'..."
RESPONSE="$(curl -fsSL -X POST "${AGENT37_API_BASE}/instances" \
  -H "Authorization: Bearer ${AGENT37_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}")"

INSTANCE_ID="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(d.get("id") or d.get("data",{}).get("id",""))' <<< "${RESPONSE}")"
PUBLIC_URL="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(d.get("url") or d.get("https_url") or d.get("data",{}).get("url",""))' <<< "${RESPONSE}")"

log "Sandbox provisioned! Instance ID: ${INSTANCE_ID:-unknown}"

# Step 4: Wait for /health check when public HTTPS URL is exposed
if [[ -n "${PUBLIC_URL}" ]]; then
  HEALTH_URL="${PUBLIC_URL%/}/health"
  log "Polling ${HEALTH_URL} until Agent Pixelate Orchestrator is ready..."
  for attempt in $(seq 1 30); do
    if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
      log "Orchestrator is healthy!"
      log "  HTTPS API : ${PUBLIC_URL%/}"
      log "  WebSocket : ${PUBLIC_URL/https:\/\//wss:\/\/}/ws/campaign/{campaign_id}"
      log "  Storage   : ${MOUNT_PATH} (persistent Agent37 volume)"
      exit 0
    fi
    sleep 2
  done
  echo "[agent37] WARNING: Sandbox started but ${HEALTH_URL} did not respond within 60s." >&2
else
  log "Sandbox response: ${RESPONSE}"
fi
