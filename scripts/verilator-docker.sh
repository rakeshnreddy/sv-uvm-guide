#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

compiler_image="${VERILATOR_DOCKER_IMAGE:-verilator/verilator:5.050}"

exec docker run --rm \
  --network none \
  --user "$(id -u):$(id -g)" \
  --volume "${GITHUB_WORKSPACE}:${GITHUB_WORKSPACE}:ro" \
  --volume "${RUNNER_TEMP}:${RUNNER_TEMP}:ro" \
  --workdir "${PWD}" \
  "${compiler_image}" \
  "$@"
