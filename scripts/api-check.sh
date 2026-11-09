#!/usr/bin/env bash
# Regenerates the client from the committed openapi.yaml and fails if it differs from the committed client.
set -euo pipefail

generated=src/features/api/generated
snapshot="$(mktemp -d)"
trap 'rm -rf "$snapshot"' EXIT

cp -R "$generated/." "$snapshot"
env -u API_SPEC pnpm exec orval

if ! diff -rq "$snapshot" "$generated"; then
	rm -rf "$generated"
	cp -R "$snapshot" "$generated"
	echo "api:check: $generated differs from what openapi.yaml generates (files above). Run pnpm api:generate, or edit openapi.yaml, never the generated files." >&2
	exit 1
fi
