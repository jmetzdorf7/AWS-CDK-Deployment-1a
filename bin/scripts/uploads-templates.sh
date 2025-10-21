#!/usr/bin/env bash
set -euo pipefail

# Environment variables expected:
# BUCKET        - target S3 bucket name (required)
# GITHUB_SHA    - optional; if not present script will use git short SHA
# The script expects cdk.out to already exist (run 'npx cdk synth' first)

BUCKET="${BUCKET:?BUCKET environment variable is required}"
GIT_SHA="${GITHUB_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo local)}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

if [ ! -d cdk.out ]; then
  echo "cdk.out not found; run 'npx cdk synth' before uploading"
  exit 1
fi

shopt -s nullglob
for f in cdk.out/*; do
  [ -f "$f" ] || continue
  fname="$(basename "$f")"
  key="cloudformation/${fname}-${TS}-${GIT_SHA}"
  echo "Uploading $f -> s3://${BUCKET}/${key}"
  aws s3 cp "$f" "s3://${BUCKET}/${key}" --acl bucket-owner-full-control
done
