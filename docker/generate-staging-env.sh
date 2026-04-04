#!/usr/bin/env bash
# Generate docker/.env.staging from docker/.env.staging.example using DOMAIN.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="$ROOT_DIR/docker/.env.staging.example"
OUTPUT="$ROOT_DIR/docker/.env.staging"

DOMAIN_VALUE="${1:-${DOMAIN:-not-replaced-yet.com}}"
FORCE="${FORCE:-0}"

if [ ! -f "$TEMPLATE" ]; then
  echo "Template not found: $TEMPLATE"
  exit 1
fi

if [ -f "$OUTPUT" ] && [ "$FORCE" != "1" ]; then
  echo "Target file already exists: $OUTPUT"
  echo "Set FORCE=1 to overwrite, e.g.:"
  echo "  FORCE=1 bash docker/generate-staging-env.sh $DOMAIN_VALUE"
  exit 1
fi

cp "$TEMPLATE" "$OUTPUT"

replace_or_append() {
  local key="$1"
  local value="$2"
  local tmp_file
  tmp_file="$(mktemp)"

  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $0 ~ "^" key "=" {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) {
        print key "=" value
      }
    }
  ' "$OUTPUT" > "$tmp_file"

  mv "$tmp_file" "$OUTPUT"
}

replace_or_append "DOMAIN" "$DOMAIN_VALUE"
replace_or_append "CORS_ORIGIN" "https://web.$DOMAIN_VALUE,https://admin.$DOMAIN_VALUE"
replace_or_append "SOCKET_CORS_ORIGIN" "https://web.$DOMAIN_VALUE,https://admin.$DOMAIN_VALUE"
replace_or_append "NEXT_PUBLIC_API_URL" "https://api.$DOMAIN_VALUE"
replace_or_append "EXPO_PUBLIC_API_URL" "https://api.$DOMAIN_VALUE"

if command -v openssl >/dev/null 2>&1; then
  current_jwt="$(grep '^JWT_SECRET=' "$OUTPUT" | head -n1 | cut -d'=' -f2-)"
  if [ "$current_jwt" = "CHANGE_ME_TO_RANDOM_VALUE_ON_LIGHTSAIL" ] || [ -z "$current_jwt" ]; then
    replace_or_append "JWT_SECRET" "$(openssl rand -base64 32)"
  fi
fi

echo "Generated: $OUTPUT"
echo "Domain: $DOMAIN_VALUE"
echo "Verify these values before deploy:"
echo "  DOMAIN"
echo "  CORS_ORIGIN"
echo "  SOCKET_CORS_ORIGIN"
echo "  NEXT_PUBLIC_API_URL"
echo "  EXPO_PUBLIC_API_URL"
