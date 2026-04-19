#!/usr/bin/env bash
main() {
set -Eeuo pipefail
trap 'printf "\nAborted.\n" >&2; exit 130' INT
trap 'rm -rf "${_TMPDIR:-}" 2>/dev/null' EXIT

REPO="LavX/arrstack"
# Do not name this VERSION: /etc/os-release (sourced below) defines its own
# VERSION (e.g. Fedora "43 (KDE Plasma Desktop Edition)") that would overwrite
# ours, making DL_BASE include literal spaces and parens and trip
# "curl: (3) URL rejected: Malformed input to a URL function".
REQUESTED_VERSION="${ARRSTACK_VERSION:-latest}"

ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  BINARY="arrstack-linux-x64" ;;
  aarch64) BINARY="arrstack-linux-arm64" ;;
  *) printf "Unsupported architecture: %s\n" "$ARCH" >&2; exit 1 ;;
esac

if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  case "${ID:-}" in
    alpine) printf "Alpine Linux is not supported.\n" >&2; exit 1 ;;
  esac
fi

_TMPDIR=$(mktemp -d)
printf "Downloading arrstack...\n"

if [[ "$REQUESTED_VERSION" == "latest" ]]; then
  DL_BASE="https://github.com/$REPO/releases/latest/download"
else
  DL_BASE="https://github.com/$REPO/releases/download/$REQUESTED_VERSION"
fi

curl -fsSL "$DL_BASE/$BINARY" -o "$_TMPDIR/arrstack"
curl -fsSL "$DL_BASE/checksums.txt" -o "$_TMPDIR/checksums.txt"

(cd "$_TMPDIR" && grep "$BINARY" checksums.txt | sha256sum -c --quiet) || {
  printf "Checksum verification failed.\n" >&2; exit 1
}
printf "Verified.\n"

chmod +x "$_TMPDIR/arrstack"

if [[ -d "$HOME/.local/bin" ]] && echo "$PATH" | grep -q "$HOME/.local/bin"; then
  cp "$_TMPDIR/arrstack" "$HOME/.local/bin/arrstack"
  printf "Installed to %s/.local/bin/arrstack\n" "$HOME"
else
  sudo cp "$_TMPDIR/arrstack" "/usr/local/bin/arrstack"
  printf "Installed to /usr/local/bin/arrstack\n"
fi

exec arrstack "$@"
}
main "$@"
