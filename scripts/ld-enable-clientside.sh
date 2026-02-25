#!/bin/bash
#
# Bulk-enable "SDKs using Client-side ID" on ALL flags in a LaunchDarkly project.
#
# Usage:
#   export LD_API_TOKEN="api-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
#   export LD_PROJECT_KEY="your-project-key"
#   ./scripts/ld-enable-clientside.sh
#
# To get an API token: LaunchDarkly > Account settings > Authorization > Create token
# The token needs at least "Writer" role permissions.

set -euo pipefail

if [ -z "${LD_API_TOKEN:-}" ]; then
  echo "Error: Set LD_API_TOKEN environment variable first."
  echo "  Go to: LaunchDarkly > Account settings > Authorization > Create token"
  exit 1
fi

if [ -z "${LD_PROJECT_KEY:-}" ]; then
  echo "Error: Set LD_PROJECT_KEY environment variable first."
  echo "  This is the project key from your LaunchDarkly project settings."
  exit 1
fi

API_BASE="https://app.launchdarkly.com/api/v2"

echo "Fetching all flags for project: ${LD_PROJECT_KEY}..."

FLAGS_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: ${LD_API_TOKEN}" \
  "${API_BASE}/flags/${LD_PROJECT_KEY}?summary=true")

HTTP_CODE=$(echo "$FLAGS_RESPONSE" | tail -n1)
BODY=$(echo "$FLAGS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "Error: Failed to fetch flags (HTTP ${HTTP_CODE})"
  echo "$BODY"
  exit 1
fi

FLAG_KEYS=$(echo "$BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data.get('items', []):
    print(item['key'])
")

if [ -z "$FLAG_KEYS" ]; then
  echo "No flags found in project ${LD_PROJECT_KEY}."
  exit 0
fi

TOTAL=$(echo "$FLAG_KEYS" | wc -l | tr -d ' ')
echo "Found ${TOTAL} flags. Enabling client-side SDK availability on each..."
echo ""

SUCCESS=0
SKIPPED=0
FAILED=0

while IFS= read -r FLAG_KEY; do
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X PATCH \
    -H "Authorization: ${LD_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '[
      { "op": "replace", "path": "/clientSideAvailability/usingEnvironmentId", "value": true },
      { "op": "replace", "path": "/clientSideAvailability/usingMobileKey", "value": false }
    ]' \
    "${API_BASE}/flags/${LD_PROJECT_KEY}/${FLAG_KEY}")

  RESP_CODE=$(echo "$RESPONSE" | tail -n1)

  if [ "$RESP_CODE" = "200" ]; then
    echo "  ✓ ${FLAG_KEY}"
    SUCCESS=$((SUCCESS + 1))
  elif [ "$RESP_CODE" = "409" ]; then
    echo "  - ${FLAG_KEY} (already enabled)"
    SKIPPED=$((SKIPPED + 1))
  else
    RESP_BODY=$(echo "$RESPONSE" | sed '$d')
    echo "  ✗ ${FLAG_KEY} (HTTP ${RESP_CODE})"
    echo "    ${RESP_BODY}" | head -c 200
    echo ""
    FAILED=$((FAILED + 1))
  fi

  sleep 0.2
done <<< "$FLAG_KEYS"

echo ""
echo "Done! ${SUCCESS} updated, ${SKIPPED} skipped, ${FAILED} failed."
