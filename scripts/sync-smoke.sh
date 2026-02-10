#!/usr/bin/env bash
set -euo pipefail

WORKER_BASE_URL="${1:-https://personal-console-sync-proxy.joel-personal-console.workers.dev/api}"
APPS_SCRIPT_EXEC="${2:-https://script.google.com/macros/s/AKfycbx05PRTxlEHqcofb14LnhqTDJR9JsD498nFDwJ4a3aMXBvYMjXsnWkdUa2tL7dgQq5mHg/exec}"

printf '\n[1/3] Worker meta: %s/meta\n' "$WORKER_BASE_URL"
curl -sSL "$WORKER_BASE_URL/meta" | tee /tmp/worker-meta.json

printf '\n[2/3] Worker sync: %s/sync\n' "$WORKER_BASE_URL"
curl -sSL -X POST "$WORKER_BASE_URL/sync" \
  -H 'Content-Type: application/x-www-form-urlencoded;charset=UTF-8' \
  --data-urlencode 'payload={"workspaceKey":"joel-main","clientId":"test","since":null,"ops":[]}' | tee /tmp/worker-sync.json

printf '\n[3/3] Apps Script meta: %s?route=meta\n' "$APPS_SCRIPT_EXEC"
curl -sSL "$APPS_SCRIPT_EXEC?route=meta" | tee /tmp/apps-meta.json

python - <<'PY'
import json
from pathlib import Path
checks = [
    ("worker meta", Path('/tmp/worker-meta.json')),
    ("worker sync", Path('/tmp/worker-sync.json')),
    ("apps meta", Path('/tmp/apps-meta.json')),
]
for label, path in checks:
    data = json.loads(path.read_text())
    if data.get('ok') is not True:
        raise SystemExit(f"{label} failed: {data}")
print('All sync smoke checks passed with ok:true')
PY
