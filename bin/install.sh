#!/usr/bin/env bash
main() {
set -Eeuo pipefail
trap 'printf "\nAborted.\n" >&2; exit 130' INT
trap 'rm -rf "${_TMPDIR:-}" 2>/dev/null' EXIT

REPO="LavX/arrstack-installer"
VERSION="${ARRSTACK_VERSION:-latest}"

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

if [[ "$VERSION" == "latest" ]]; then
  DL_BASE="https://github.com/$REPO/releases/latest/download"
else
  DL_BASE="https://github.com/$REPO/releases/download/$VERSION"
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
